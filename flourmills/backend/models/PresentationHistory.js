import mongoose from 'mongoose';

const Mixed = mongoose.Schema.Types.Mixed;

const PresentationHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userEmail: { type: String, default: null },
  userName: { type: String, default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  projectName: { type: String, default: '' },
  title: { type: String, required: true },
  status: { type: String, enum: ['draft', 'exported'], default: 'draft', index: true },
  presetId: { type: String, default: 'fundco-classic' },
  presetName: { type: String, default: 'FundCo Classic' },
  audience: { type: String, default: 'Investment Committee' },
  aiAssisted: { type: Boolean, default: false },
  slideCount: { type: Number, default: 0 },
  draft: { type: Mixed, default: {} },
  metrics: { type: Mixed, default: {} },
  modelRunAt: { type: Date, default: null },
  exportedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

PresentationHistorySchema.index({ userId: 1, projectId: 1, createdAt: -1 });

PresentationHistorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.PresentationHistory || mongoose.model('PresentationHistory', PresentationHistorySchema);
