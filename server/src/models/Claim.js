import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 1200 },
    privateProof: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
    history: [
      new mongoose.Schema(
        {
          status: String,
          by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          note: { type: String, default: '' },
          at: { type: Date, default: Date.now }
        },
        { _id: false }
      )
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Claim', claimSchema);
