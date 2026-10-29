import mongoose from 'mongoose';
import { CATEGORIES, ITEM_STATUSES } from '../config.js';

const historySchema = new mongoose.Schema(
  {
    status: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const flagSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 300 },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    type: { type: String, enum: ['lost', 'found'], required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, default: Date.now },
    coordinates: { lat: Number, lng: Number },
    photos: [{ _id: false, url: { type: String, required: true }, originalName: { type: String, default: '' } }],
    contactName: { type: String, default: '', maxlength: 80 },
    contactEmail: { type: String, default: '', maxlength: 160 },
    contactPhone: { type: String, default: '', maxlength: 20 },
    safeMeetingPoint: { type: String, default: 'MIT-WPU main gate', maxlength: 120 },
    status: { type: String, enum: ITEM_STATUSES, default: 'open' },
    statusHistory: [historySchema],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    // Moderation: community flags and an admin/auto "hidden" switch.
    flags: [flagSchema],
    hidden: { type: Boolean, default: false }
  },
  { timestamps: true }
);

itemSchema.index({ type: 1, status: 1, createdAt: -1 });
itemSchema.index({ category: 1 });

export default mongoose.model('Item', itemSchema);
