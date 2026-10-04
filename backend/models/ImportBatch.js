const mongoose = require('mongoose');

/**
 * One applied student-records import, kept so it can be undone.
 *
 * Stores exactly what the import did: which students it created, and for each
 * student it changed, every field's value before and after. Undo uses this to put
 * things back; it is also a permanent record of what each import changed.
 */
const importBatchSchema = new mongoose.Schema({
  createdBy: { type: String, default: 'unknown' },
  mode: { type: String, enum: ['add-only', 'update'], required: true },

  insertedIds: [{ type: mongoose.Schema.Types.ObjectId }],
  updates: [{
    _id: false,
    internshipId: { type: mongoose.Schema.Types.ObjectId, required: true },
    uid: { type: String, required: true },
    diffs: [{ _id: false, field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
  }],

  counts: {
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },

  undoneAt: { type: Date, default: null },
  undoneBy: { type: String, default: null },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

importBatchSchema.index({ createdAt: -1 });

const getImportBatchModel = (conn) => conn.models.ImportBatch || conn.model('ImportBatch', importBatchSchema);

module.exports = {
  importBatchSchema,
  getImportBatchModel,
};
