import { Router } from 'express';
import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const ACTIVE_STATUSES = ['pending', 'approved'];

// Allowed review transitions: current status -> statuses the item owner may set.
const transitions = {
  pending: ['approved', 'rejected'],
  approved: ['completed', 'rejected']
};

/**
 * Keep the item's status in sync with its claims:
 * completed -> returned, approved -> claimed, pending -> claim-pending, none -> open.
 */
async function syncItemStatus(item, userId, note) {
  const claims = await Claim.find({ item: item._id }).select('status');
  let next = 'open';
  if (claims.some((c) => c.status === 'completed')) next = 'returned';
  else if (claims.some((c) => c.status === 'approved')) next = 'claimed';
  else if (claims.some((c) => c.status === 'pending')) next = 'claim-pending';

  if (item.status !== next) {
    item.status = next;
    item.statusHistory.push({ status: next, by: userId, note });
    await item.save();
  }
}

// POST /api/claims  — submit a claim on someone else's report
router.post('/', async (req, res) => {
  const { itemId, message, privateProof = '' } = req.body;

  if (!validId(itemId)) return res.status(400).json({ message: 'Valid itemId is required.' });
  const text = String(message || '').trim();
  if (!text || text.length > 1200) {
    return res.status(400).json({ message: 'Claim message is required (max 1200 characters).' });
  }

  const item = await Item.findById(itemId);
  if (!item) return res.status(404).json({ message: 'Item not found.' });
  if (String(item.owner || '') === req.user.sub) {
    return res.status(400).json({ message: 'You cannot claim your own report.' });
  }
  if (['claimed', 'returned'].includes(item.status)) {
    return res.status(409).json({ message: 'This item has already been claimed or returned.' });
  }

  const existing = await Claim.findOne({ item: itemId, claimant: req.user.sub, status: { $in: ACTIVE_STATUSES } });
  if (existing) return res.status(409).json({ message: 'You already have an active claim on this item.' });

  const claim = await Claim.create({
    item: itemId,
    claimant: req.user.sub,
    message: text,
    privateProof: String(privateProof).trim().slice(0, 500),
    history: [{ status: 'pending', by: req.user.sub, note: 'Claim submitted' }]
  });
  await syncItemStatus(item, req.user.sub, 'Claim submitted');
  await notify(item.owner, {
    type: 'claim-received',
    title: 'New claim on your report',
    body: `Someone submitted a claim on “${item.title}”. Review their private proof under My activity.`,
    link: '/my'
  });

  res.status(201).json({ claim: { _id: claim._id, item: claim.item, status: claim.status, createdAt: claim.createdAt } });
});

// GET /api/claims/mine  — claims I made. Owner contact details appear only after approval.
router.get('/mine', async (req, res) => {
  const claims = await Claim.find({ claimant: req.user.sub })
    .populate('item', 'title type category location status safeMeetingPoint contactName contactEmail contactPhone')
    .sort({ createdAt: -1 });

  const result = claims.map((c) => {
    const o = c.toObject();
    const approved = ['approved', 'completed'].includes(o.status);
    if (o.item) {
      o.handover = approved
        ? {
            contactName: o.item.contactName || '',
            contactEmail: o.item.contactEmail || '',
            contactPhone: o.item.contactPhone || '',
            safeMeetingPoint: o.item.safeMeetingPoint || ''
          }
        : null;
      delete o.item.contactName;
      delete o.item.contactEmail;
      delete o.item.contactPhone;
    }
    return o;
  });

  res.json({ claims: result });
});

// GET /api/claims/received  — claims on reports I own. Claimant contact appears only after approval.
router.get('/received', async (req, res) => {
  const ownIds = (await Item.find({ owner: req.user.sub }).select('_id').lean()).map((i) => i._id);
  const claims = await Claim.find({ item: { $in: ownIds } })
    .populate('item', 'title type category location status')
    .populate('claimant', 'name email phone program year')
    .sort({ createdAt: -1 });

  const result = claims.map((c) => {
    const o = c.toObject();
    if (o.claimant && !['approved', 'completed'].includes(o.status)) {
      delete o.claimant.email;
      delete o.claimant.phone;
    }
    return o;
  });

  res.json({ claims: result });
});

// PATCH /api/claims/:id/status  — report owner reviews a claim
router.patch('/:id/status', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid claim ID.' });

  const claim = await Claim.findById(req.params.id).populate('item');
  if (!claim || !claim.item) return res.status(404).json({ message: 'Claim not found.' });
  if (String(claim.item.owner || '') !== req.user.sub) {
    return res.status(403).json({ message: 'Only the report owner can review this claim.' });
  }

  const status = req.body.status;
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Unsupported claim status.' });
  }
  if (!transitions[claim.status]?.includes(status)) {
    return res.status(409).json({ message: `A ${claim.status} claim cannot be changed to ${status}.` });
  }

  const note = String(req.body.note || '').slice(0, 300);
  claim.status = status;
  claim.history.push({ status, by: req.user.sub, note });
  await claim.save();
  await syncItemStatus(claim.item, req.user.sub, `Claim ${status}`);
  const copy = {
    approved: ['claim-approved', 'Your claim was approved', 'The owner approved your claim. Open My activity to see the handover details.'],
    rejected: ['claim-rejected', 'Your claim was not approved', 'The owner could not verify your claim. You can add more detail in a new claim if appropriate.'],
    completed: ['claim-completed', 'Handover completed', 'The owner marked this item as returned. Glad it found its way home!']
  }[status];
  await notify(claim.claimant, { type: copy[0], title: copy[1], body: `“${claim.item.title}”: ${copy[2]}`, link: '/my' });

  res.json({ claim: { _id: claim._id, status: claim.status, history: claim.history } });
});

// DELETE /api/claims/:id  — claimant withdraws a pending claim
router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid claim ID.' });

  const claim = await Claim.findById(req.params.id);
  if (!claim) return res.status(404).json({ message: 'Claim not found.' });
  if (String(claim.claimant) !== req.user.sub) {
    return res.status(403).json({ message: 'Only the claimant can withdraw this claim.' });
  }
  if (claim.status !== 'pending') {
    return res.status(409).json({ message: 'Only pending claims can be withdrawn.' });
  }

  const item = await Item.findById(claim.item);
  await claim.deleteOne();
  if (item) {
    await syncItemStatus(item, req.user.sub, 'Claim withdrawn');
    await notify(item.owner, { type: 'claim-withdrawn', title: 'A claim was withdrawn', body: `A claimant withdrew their claim on “${item.title}”.`, link: '/my' });
  }

  res.json({ message: 'Claim withdrawn.' });
});

export default router;
