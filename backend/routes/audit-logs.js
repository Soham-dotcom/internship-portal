const express = require('express');
const { getSharedDb } = require('../db/connection');
const { getAuditLogModel } = require('../models/AuditLog');
const { requireRole } = require('../middleware/auth');
const { escapeRegex } = require('../utils/escapeRegex');
const { audit } = require('../middleware/audit');

const router = express.Router();

const EXPORT_KINDS = new Set(['student-records', 'evaluation-scores', 'generated-groups']);

// POST /api/audit-logs/export  { kind, rows }
// Some exports are built entirely in the browser, so the server never sees them.
// The page reports each one here, so "who downloaded student data, and when?" has
// an answer. Any signed-in user may record their own export.
router.post('/export', audit('export.client', (req) => ({
  kind: String(req.body?.kind || ''),
  rows: Number(req.body?.rows) || 0,
})), (req, res) => {
  if (!EXPORT_KINDS.has(String(req.body?.kind || ''))) {
    return res.status(400).json({ success: false, message: 'Unknown export kind' });
  }
  return res.json({ success: true });
});

// Everything below is for administrators only: it shows who did what across the year.
router.use(requireRole('admin'));

const PAGE_SIZE_MAX = 100;

/**
 * GET /api/audit-logs?action=marks&actor=alice&uid=2022300002&from=2026-10-01&to=2026-10-31&page=1
 *
 * Shows this academic year's entries plus year-independent ones (sign-ins, sender
 * emails). `action` matches by prefix, so "marks" finds every marks-related action.
 */
router.get('/', async (req, res, next) => {
  try {
    const AuditLog = getAuditLogModel(getSharedDb());
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const filter = { year: { $in: [String(req.year), ''] } };
    const action = String(req.query.action || '').trim();
    const actor = String(req.query.actor || '').trim();
    const uid = String(req.query.uid || '').trim();
    if (action) filter.action = new RegExp(`^${escapeRegex(action)}`, 'i');
    if (actor) filter.actorUsername = new RegExp(escapeRegex(actor), 'i');
    if (uid) filter.$or = [{ 'details.uid': uid }, { 'details.changes.uid': uid }];

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      filter.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      if (to && !Number.isNaN(to.getTime())) {
        // Include the whole "to" day.
        filter.createdAt.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
    }

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({ success: true, data: entries, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    return next(error);
  }
});

// GET the distinct action names, for the filter dropdown.
router.get('/actions', async (req, res, next) => {
  try {
    const AuditLog = getAuditLogModel(getSharedDb());
    const actions = await AuditLog.distinct('action', { year: { $in: [String(req.year), ''] } });
    return res.json({ success: true, data: actions.sort() });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
