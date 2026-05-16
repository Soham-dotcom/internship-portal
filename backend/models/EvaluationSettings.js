const mongoose = require('mongoose');

const evaluationSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  totalWeeks: { type: Number, default: 8 },
  weights: {
    meeting: { type: Number, default: 10 },
    weekly: { type: Number, default: 30 },
    final: { type: Number, default: 10 },
    external: { type: Number, default: 25 },
    external_viva: { type: Number, default: 12.5 },
    internal_viva: { type: Number, default: 12.5 },
  },
}, { timestamps: true });

evaluationSettingsSchema.index({ key: 1 }, { unique: true });

const getEvaluationSettingsModel = (conn) => conn.models.EvaluationSettings || conn.model('EvaluationSettings', evaluationSettingsSchema);

module.exports = {
  evaluationSettingsSchema,
  getEvaluationSettingsModel,
};
