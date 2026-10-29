import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['claim-received', 'claim-approved', 'claim-rejected', 'claim-completed', 'claim-withdrawn', 'possible-match', 'moderation'],
      required: true
    },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 400 },
    link: { type: String, default: '/my', maxlength: 120 },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
