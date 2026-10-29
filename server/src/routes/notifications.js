import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications  — latest 30 + unread count
router.get('/', async (req, res) => {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user.sub }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user.sub, read: false })
  ]);
  res.json({ notifications, unread });
});

// PATCH /api/notifications/read-all   (declared before /:id/read)
router.patch('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user.sub, read: false }, { $set: { read: true } });
  res.json({ message: 'All notifications marked as read.' });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid notification ID.' });
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.sub }, { $set: { read: true } }, { new: true });
  if (!n) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ notification: n });
});

export default router;
