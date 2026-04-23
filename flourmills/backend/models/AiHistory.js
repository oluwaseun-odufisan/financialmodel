// AI FEATURE - GROK
import mongoose from 'mongoose';

const Mixed = mongoose.Schema.Types.Mixed;

const AiHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userEmail: { type: String, default: null },
  userName: { type: String, default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  projectName: { type: String, default: '' },
  type: { type: String, enum: ['summary', 'scenarios', 'optimize', 'insights', 'explain', 'chat'], required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  prompt: { type: String, default: '' },
  payload: { type: Mixed, default: {} },
  metrics: { type: Mixed, default: {} },
  modelRunAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

AiHistorySchema.index({ userId: 1, projectId: 1, createdAt: -1 });
AiHistorySchema.index({ userId: 1, projectId: 1, type: 1, createdAt: -1 });

export default mongoose.models.AiHistory || mongoose.model('AiHistory', AiHistorySchema);
