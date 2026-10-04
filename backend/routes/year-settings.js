const express = require('express');
const { getYearDb } = require('../db/connection');
const { getYearSettingsModel } = require('../models/YearSettings');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { getYearSettings } = require('../middleware/locks');
const { MARK_FIELDS } = require('../utils/marks');

const router = express.Router();

const model = (req) => getYearSettingsModel(getYearDb(req.year));

const view = (settings) => ({
  locked: Boolean(settings.locked),
  lockedAt: settings.lockedAt || null,
  lockedBy: settings.lockedBy || null,
  lockReason: settings.lockReason || '',
  marksLocks: settings.marksLocks || [],
});

const readReason = (req) => String(req.body?.reason || '').trim();

// GET lock status of the current year (everyone: the UI shows a banner when locked)
router.get('/', async (req, res, next) => {
  try {
    return res.json({ success: true, data: view(await getYearSettings(req.year)) });
  } catch (error) {
    return next(error);
  }
});

// POST lock the whole year (admin)
router.post('/lock', requireRole('admin'), audit('year.lock', (req) => ({ reason: readReason(req) })), async (req, res, next) => {
  try {
    const settings = await model(req).findOneAndUpdate(
      { key: 'default' },
      { $set: { locked: true, lockedAt: new Date(), lockedBy: req.user.username, lockReason: readReason(req) } },
      { new: true, upsert: true }
    ).lean();
    return res.json({ success: true, message: `Academic year ${req.year} is now locked.`, data: view(settings) });
  } catch (error) {
    return next(error);
  }
});

// POST unlock the year (admin, reason required: unlocking reopens published results)
router.post('/unlock', requireRole('admin'), audit('year.unlock', (req) => ({ reason: readReason(req) })), async (req, res, next) => {
  try {
    if (readReason(req).length < 5) {
      return res.status(400).json({ success: false, message: 'Give a reason for unlocking the year; it is recorded in the audit log.' });
    }
    const settings = await model(req).findOneAndUpdate(
      { key: 'default' },
      { $set: { locked: false, lockedAt: null, lockedBy: null, lockReason: '' } },
      { new: true, upsert: true }
    ).lean();
    return res.json({ success: true, message: `Academic year ${req.year} is unlocked.`, data: view(settings) });
  } catch (error) {
    return next(error);
  }
});

// PUT lock or unlock one marks component (admin): { field, locked, reason }
router.put('/marks-locks', requireRole('admin'), audit('marks.lock-change', (req) => ({
  field: req.body?.field,
  locked: Boolean(req.body?.locked),
  reason: readReason(req),
})), async (req, res, next) => {
  try {
    const { field } = req.body || {};
    const lock = Boolean(req.body?.locked);
    if (!MARK_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, message: `field must be one of: ${MARK_FIELDS.join(', ')}` });
    }
    if (!lock && readReason(req).length < 5) {
      return res.status(400).json({ success: false, message: 'Give a reason for unlocking these marks; it is recorded in the audit log.' });
    }

    const update = lock
      ? { $push: { marksLocks: { field, lockedAt: new Date(), lockedBy: req.user.username } } }
      : { $pull: { marksLocks: { field } } };
    // Locking is idempotent: only push when not already locked.
    const filter = lock ? { key: 'default', 'marksLocks.field': { $ne: field } } : { key: 'default' };

    await model(req).updateOne({ key: 'default' }, { $setOnInsert: { key: 'default' } }, { upsert: true });
    await model(req).updateOne(filter, update);

    return res.json({
      success: true,
      message: `${field} is now ${lock ? 'locked' : 'unlocked'}.`,
      data: view(await getYearSettings(req.year)),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
