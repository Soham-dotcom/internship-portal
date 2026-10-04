const mongoose = require('mongoose');

/**
 * Append-only record of actions that change or expose data.
 *
 * With more than one person able to write, "who deleted these students?" has to be
 * answerable. Stored in the shared database so the trail survives per-year databases
 * being created, migrated or dropped.
 */
const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, default: null },
  actorUsername: { type: String, default: 'unknown' },
  actorRole: { type: String, default: 'unknown' },

  action: { type: String, required: true },   // e.g. 'groups.clear-all'
  method: { type: String, default: '' },
  path: { type: String, default: '' },
  year: { type: String, default: '' },

  statusCode: { type: Number, default: 0 },
  success: { type: Boolean, default: false },

  // Small, redacted summary of what was targeted. Never store full request bodies:
  // they contain student PII.
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUsername: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const getAuditLogModel = (conn) => conn.models.AuditLog || conn.model('AuditLog', auditLogSchema);

module.exports = {
  auditLogSchema,
  getAuditLogModel,
};
