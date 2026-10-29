import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const validId = (id) => mongoose.isValidObjectId(id);

// GET /api/admin/stats  — dashboard numbers for moderators
router.get('/stats', async (_req, res) => {
  const [users, items, lost, found, returned, hidden, flagged, pendingClaims, byCategory] = await Promise.all([
    User.countDocuments(),
    Item.countDocuments(),
    Item.countDocuments({ type: 'lost' }),
    Item.countDocuments({ type: 'found' }),
    Item.countDocuments({ status: 'returned' }),
    Item.countDocuments({ hidden: true }),
    Item.countDocuments({ 'flags.0': { $exists: true } }),
    Claim.countDocuments({ status: 'pending' }),
    Item.find().select('category').lean()
  ]);
  const categories = {};
  for (const i of byCategory) categories[i.category] = (categories[i.category] || 0) + 1;
  res.json({
    users, items, lost, found, returned, hidden, flagged, pendingClaims,
    recoveryRate: items ? Math.round((returned / items) * 100) : 0,
    categories
  });
});

// GET /api/admin/items?filter=flagged|hidden|all
router.get('/items', async (req, res) => {
  const filter = req.query.filter === 'hidden' ? { hidden: true }
    : req.query.filter === 'all' ? {}
    : { 'flags.0': { $exists: true } };
  const items = await Item.find(filter).sort({ updatedAt: -1 }).limit(100).populate('owner', 'name email').lean();
  res.json({ items });
});

// PATCH /api/admin/items/:id  { action: 'hide' | 'unhide' | 'clear-flags' }
router.patch('/items/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  const { action } = req.body;
  if (action === 'hide') item.hidden = true;
  else if (action === 'unhide') item.hidden = false;
  else if (action === 'clear-flags') { item.flags = []; item.hidden = false; }
  else return res.status(400).json({ message: 'Action must be hide, unhide or clear-flags.' });

  await item.save();
  if (item.owner && action !== 'clear-flags') {
    await notify(item.owner, {
      type: 'moderation',
      title: action === 'hide' ? 'A moderator hid your report' : 'Your report is visible again',
      body: `“${item.title}”${action === 'hide' ? ' was hidden after review. Edit it and contact campus staff if you think this is a mistake.' : ' was restored by a moderator.'}`,
      link: '/my'
    });
  }
  res.json({ item });
});

// DELETE /api/admin/items/:id
router.delete('/items/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  await Claim.deleteMany({ item: item._id });
  await item.deleteOne();
  res.json({ message: 'Report removed by moderator.' });
});

// GET /api/admin/users
router.get('/users', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200).select('name email role program year createdAt').lean();
  const counts = await Item.aggregate([{ $group: { _id: '$owner', reports: { $sum: 1 } } }]);
  const byOwner = new Map(counts.map((c) => [String(c._id), c.reports]));
  res.json({ users: users.map((u) => ({ ...u, reports: byOwner.get(String(u._id)) || 0 })) });
});

// PATCH /api/admin/users/:id/role  { role: 'student' | 'admin' }
router.patch('/users/:id/role', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
  if (!['student', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Role must be student or admin.' });
  if (req.params.id === req.user.sub) return res.status(400).json({ message: 'You cannot change your own role.' });
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role: req.body.role } }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: user.toClient() });
});

export default router;
