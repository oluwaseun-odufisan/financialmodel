import mongoose from 'mongoose';

const Mixed = mongoose.Schema.Types.Mixed;

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  userEmail: { type: String, default: null },
  userName: { type: String, default: null },
  action: { type: String, required: true, index: true },
  entityType: { type: String, default: 'system' },
  entityId: { type: String, default: null },
  entityName: { type: String, default: null },
  metadata: { type: Mixed, default: {} },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
