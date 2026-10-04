const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getEvaluationSettingsModel } = require('../models/EvaluationSettings');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { validateEvaluationSettings, DEFAULT_SETTINGS } = require('../utils/evaluationSettings');

router.get('/', async (req, res) => {
  try {
    const EvaluationSettings = getEvaluationSettingsModel(getYearDb(req.year));
    const settings = await EvaluationSettings.findOne({ key: 'default' });
    if (!settings) {
      // isDefault tells the UI nothing has been saved for this year yet.
      return res.json({ success: true, data: DEFAULT_SETTINGS, isDefault: true });
    }

    return res.json({
      success: true,
      data: {
        totalWeeks: settings.totalWeeks,
        weights: settings.weights
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin only: these weights determine every student's final mark.
router.put('/', requireRole('admin'), audit('evaluation-settings.update', (req) => ({
  totalWeeks: req.body?.totalWeeks,
  weights: req.body?.weights,
})), async (req, res) => {
  try {
    const EvaluationSettings = getEvaluationSettingsModel(getYearDb(req.year));
    // All-or-nothing: every weight present, non-negative, summing to 100%.
    const { value, error } = validateEvaluationSettings(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const { totalWeeks, weights } = value;

    const settings = await EvaluationSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: { totalWeeks, weights } },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      data: {
        totalWeeks: settings.totalWeeks,
        weights: settings.weights
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
