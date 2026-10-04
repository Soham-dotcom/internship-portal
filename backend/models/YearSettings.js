const mongoose = require('mongoose');
const { MARK_FIELDS } = require('../utils/marks');

/**
 * Per-academic-year switches that protect finished work.
 *
 *   locked      the whole year is read-only (results published)
 *   marksLocks  individual marks components that are final, e.g. external marks
 *               once the industry evaluators' sheet has been verified
 *
 * While something is locked, staff cannot change it; an admin can, but only by
 * giving a reason, which is written to the audit log.
 */
const yearSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },

  locked: { type: Boolean, default: false },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: String, default: null },
  lockReason: { type: String, default: '' },

  marksLocks: [{
    _id: false,
    field: { type: String, enum: MARK_FIELDS, required: true },
    lockedAt: { type: Date, required: true },
    lockedBy: { type: String, required: true },
  }],
}, {
  timestamps: true,
});

const getYearSettingsModel = (conn) => conn.models.YearSettings || conn.model('YearSettings', yearSettingsSchema);

module.exports = {
  yearSettingsSchema,
  getYearSettingsModel,
};
