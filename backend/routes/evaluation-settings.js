const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getEvaluationSettingsModel } = require('../models/EvaluationSettings');

const sanitizeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

router.get('/', async (req, res) => {
  try {
    const EvaluationSettings = getEvaluationSettingsModel(getYearDb(req.year));
    const settings = await EvaluationSettings.findOne({ key: 'default' });
    if (!settings) {
      return res.json({
        success: true,
        data: {
          totalWeeks: 8,
          weights: { meeting: 10, weekly: 30, final: 10, external: 25, external_viva: 12.5, internal_viva: 12.5 }
        }
      });
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

router.put('/', async (req, res) => {
  try {
    const EvaluationSettings = getEvaluationSettingsModel(getYearDb(req.year));
    const totalWeeks = sanitizeNumber(req.body.totalWeeks, 8);
    const legacyViva = sanitizeNumber(req.body.weights?.viva, 25);
    const weights = {
      meeting: sanitizeNumber(req.body.weights?.meeting, 10),
      weekly: sanitizeNumber(req.body.weights?.weekly, 30),
      final: sanitizeNumber(req.body.weights?.final, 10),
      external: sanitizeNumber(req.body.weights?.external, 25),
      external_viva: sanitizeNumber(req.body.weights?.external_viva, legacyViva / 2),
      internal_viva: sanitizeNumber(req.body.weights?.internal_viva, legacyViva / 2),
    };

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
