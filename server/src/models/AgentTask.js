import mongoose from 'mongoose';

const agentTaskSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
    kind: { type: String, enum: ['stale-report', 'possible-match', 'pending-claim'], required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 1200 },
    status: { type: String, enum: ['pending', 'completed', 'dismissed'], default: 'pending' },
    generatedByAgent: { type: Boolean, default: true },
    actionLog: [
      new mongoose.Schema(
        { action: String, note: { type: String, default: '' }, at: { type: Date, default: Date.now } },
        { _id: false }
      )
    ]
  },
  { timestamps: true }
);

export default mongoose.model('AgentTask', agentTaskSchema);
