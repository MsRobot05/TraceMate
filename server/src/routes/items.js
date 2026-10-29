import { Router } from 'express';
import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { CATEGORIES as categories, ITEM_STATUSES as statuses } from '../config.js';
import { scoreMatch } from '../utils/matching.js';
import { str, cleanPhone, cleanPhotos } from '../utils/validate.js';
import { notify } from '../services/notify.js';

const router = Router();

/** Number of distinct community flags that automatically hides a report until a moderator reviews it. */
const FLAG_AUTO_HIDE = 3;
/** Minimum similarity score that triggers a "possible match" notification. */
const ALERT_SCORE = 50;

const validId = (id) => mongoose.isValidObjectId(id);

/**
 * Public-safe version of an item.
 * - The owner's id is never exposed.
 * - Contact name, email and phone are only returned to the report owner.
 * - Flag details are only counted, never listed; `isOwner` lets the UI show Edit/Delete.
 */
function safeItem(item, userId = null) {
  const o = item.toObject ? item.toObject() : { ...item };
  const isOwner = Boolean(userId && o.owner && String(o.owner) === String(userId));
  const alreadyFlagged = Boolean(userId && (o.flags || []).some((f) => String(f.by) === String(userId)));
  o.flagCount = (o.flags || []).length;
  delete o.flags;
  delete o.owner;
  if (!isOwner) {
    delete o.contactName;
    delete o.contactEmail;
    delete o.contactPhone;
    delete o.statusHistory;
  }
  o.isOwner = isOwner;
  o.alreadyFlagged = alreadyFlagged;
  return o;
}

/** After a report is created, tell owners of strongly similar opposite-type reports. */
async function sendMatchAlerts(item, userId) {
  try {
    const candidates = await Item.find({
      type: item.type === 'lost' ? 'found' : 'lost',
      status: { $in: ['open', 'matched'] },
      hidden: { $ne: true },
      _id: { $ne: item._id }
    }).limit(150);
    const strong = candidates
      .map((c) => ({ c, ...scoreMatch(item, c) }))
      .filter((m) => m.score >= ALERT_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    for (const m of strong) {
      if (m.c.owner && String(m.c.owner) !== String(userId)) {
        await notify(m.c.owner, {
          type: 'possible-match',
          title: 'Possible match for your report',
          body: `A new ${item.type} report “${item.title}” looks ${m.score}% similar to “${m.c.title}”. ${m.reasons.slice(0, 2).join(' · ')}`,
          link: '/reports'
        });
      }
    }
    return strong.length;
  } catch (error) {
    console.error('Match alert failed:', error.message);
    return 0;
  }
}

// GET /api/items  — public feed with optional filters
router.get('/', optionalAuth, async (req, res) => {
  const { type, category, status, search } = req.query;
  const filter = { hidden: { $ne: true } };

  if (['lost', 'found'].includes(type)) filter.type = type;
  if (categories.includes(category)) filter.category = category;
  if (statuses.includes(status)) filter.status = status;

  if (search?.trim()) {
    const escaped = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { location: { $regex: escaped, $options: 'i' } }
    ];
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const [items, total] = await Promise.all([
    Item.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Item.countDocuments(filter)
  ]);
  res.json({ items: items.map((i) => safeItem(i, req.user?.sub)), total, page, pages: Math.ceil(total / limit) || 1 });
});

// GET /api/items/mine  — the signed-in user's own reports (must be before /:id)
router.get('/mine', requireAuth, async (req, res) => {
  const items = await Item.find({ owner: req.user.sub }).sort({ createdAt: -1 });
  res.json({ items: items.map((i) => safeItem(i, req.user.sub)), total: items.length });
});

// GET /api/items/:id/matches  — explainable similarity suggestions
router.get('/:id/matches', optionalAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });

  const candidates = await Item.find({
    type: item.type === 'lost' ? 'found' : 'lost',
    status: { $in: ['open', 'matched', 'claim-pending'] },
    hidden: { $ne: true },
    _id: { $ne: item._id }
  }).limit(150);

  const matches = candidates
    .map((c) => ({ ...safeItem(c, req.user?.sub), ...scoreMatch(item, c) }))
    .filter((c) => c.score >= 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({ matches, note: 'Local explainable similarity, not proof of ownership. Verify privately before handover.' });
});

// GET /api/items/:id
router.get('/:id', optionalAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  const isOwner = item && req.user && String(item.owner) === req.user.sub;
  if (!item || (item.hidden && !isOwner)) return res.status(404).json({ message: 'Item not found.' });
  res.json({ item: safeItem(item, req.user?.sub) });
});

// POST /api/items
router.post('/', requireAuth, async (req, res) => {
  const { type, category, coordinates, photos } = req.body;
  const title = str(req.body.title, 100);
  const description = str(req.body.description, 1000);
  const location = str(req.body.location, 120);

  if (!title || !type || !categories.includes(category) || !description || !location) {
    return res.status(400).json({ message: 'Complete title, type, category, description and location.' });
  }
  if (!['lost', 'found'].includes(type)) {
    return res.status(400).json({ message: 'Type must be lost or found.' });
  }
  if (title.length < 3) return res.status(400).json({ message: 'Title must be at least 3 characters.' });
  if (description.length < 10) return res.status(400).json({ message: 'Description must be at least 10 characters.' });

  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'Date is not valid.' });
  if (date.getTime() > Date.now() + 86400000) return res.status(400).json({ message: 'Date cannot be in the future.' });

  const item = await Item.create({
    title, type, category, description, location, date, coordinates,
    photos: cleanPhotos(photos),
    contactName: str(req.body.contactName, 80),
    contactEmail: str(req.body.contactEmail, 160),
    contactPhone: cleanPhone(req.body.contactPhone),
    safeMeetingPoint: str(req.body.safeMeetingPoint || 'MIT-WPU main gate', 120),
    owner: req.user.sub,
    statusHistory: [{ status: 'open', by: req.user.sub, note: 'Report created' }]
  });

  const alerts = await sendMatchAlerts(item, req.user.sub);
  res.status(201).json({ item: safeItem(item, req.user.sub), possibleMatches: alerts });
});

// PATCH /api/items/:id  — owner only
router.patch('/:id', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (!item.owner || String(item.owner) !== req.user.sub) {
    return res.status(403).json({ message: 'Only the report owner can edit this item.' });
  }

  const textFields = { title: 100, description: 1000, location: 120, contactName: 80, contactEmail: 160, safeMeetingPoint: 120 };
  for (const [f, max] of Object.entries(textFields)) if (req.body[f] !== undefined) item[f] = str(req.body[f], max);
  for (const f of ['type', 'category', 'date', 'coordinates']) if (req.body[f] !== undefined) item[f] = req.body[f];
  if (req.body.photos !== undefined) item.photos = cleanPhotos(req.body.photos);
  if (req.body.contactPhone !== undefined) item.contactPhone = cleanPhone(req.body.contactPhone);

  await item.save();
  res.json({ item: safeItem(item, req.user.sub) });
});

// PATCH /api/items/:id/status  — owner only
router.patch('/:id/status', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (!item.owner || String(item.owner) !== req.user.sub) {
    return res.status(403).json({ message: 'Only the report owner can change status.' });
  }
  if (!statuses.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status.' });

  item.status = req.body.status;
  item.statusHistory.push({ status: item.status, by: req.user.sub, note: String(req.body.note || '').slice(0, 300) });
  await item.save();
  res.json({ item: safeItem(item, req.user.sub) });
});

// POST /api/items/:id/flag  — any signed-in user can report an inappropriate or fake listing
router.post('/:id/flag', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const reason = str(req.body.reason, 300);
  if (reason.length < 5) return res.status(400).json({ message: 'Please say briefly why this report is a problem (at least 5 characters).' });

  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (String(item.owner || '') === req.user.sub) return res.status(400).json({ message: 'You cannot flag your own report.' });
  if (item.flags.some((f) => String(f.by) === req.user.sub)) {
    return res.status(409).json({ message: 'You have already flagged this report.' });
  }

  item.flags.push({ by: req.user.sub, reason });
  const autoHidden = !item.hidden && item.flags.length >= FLAG_AUTO_HIDE;
  if (autoHidden) item.hidden = true;
  await item.save();

  if (autoHidden && item.owner) {
    await notify(item.owner, {
      type: 'moderation',
      title: 'Your report is under review',
      body: `“${item.title}” was flagged by several members and is hidden until a moderator reviews it.`,
      link: '/my'
    });
  }
  res.json({ message: autoHidden ? 'Thanks. This report is now hidden pending moderator review.' : 'Thanks. A moderator will review this report.', autoHidden });
});

// DELETE /api/items/:id  — owner only; also removes the item's claims
router.delete('/:id', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid item ID.' });
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (!item.owner || String(item.owner) !== req.user.sub) {
    return res.status(403).json({ message: 'Only the report owner can delete this item.' });
  }

  await Claim.deleteMany({ item: item._id });
  await item.deleteOne();
  res.json({ message: 'Report deleted.' });
});

export default router;
