import AuditLog from '../models/AuditLog.js';

function getIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export async function logAuditEvent(req, payload) {
  try {
    await AuditLog.create({
      userId: req.user?.id || null,
      userEmail: req.user?.email || payload.userEmail || null,
      userName: req.user?.name || payload.userName || null,
      action: payload.action,
      entityType: payload.entityType || 'system',
      entityId: payload.entityId || null,
      entityName: payload.entityName || null,
      metadata: payload.metadata || {},
      ipAddress: getIpAddress(req),
      userAgent: req.headers['user-agent'] || null,
      createdAt: payload.createdAt || new Date(),
    });
  } catch (error) {
    console.error('[audit/log]', error);
  }
}
