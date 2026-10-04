/**
 * Year lock and marks locks.
 *
 * The rule (product decisions D2 and D4):
 *   - nothing locked      → normal role rules apply
 *   - locked, staff       → refused (423 Locked)
 *   - locked, admin       → allowed only with a reason in the X-Lock-Override-Reason
 *                           header; the reason is written to the audit log
 *
 * 423 responses carry `requiresReason: true` for admins, so the frontend can ask
 * for a reason and retry the same request.
 */
const { getYearDb } = require('../db/connection');
const { getYearSettingsModel } = require('../models/YearSettings');
const { recordAudit } = require('./audit');

const OVERRIDE_HEADER = 'x-lock-override-reason';
const MIN_REASON_LENGTH = 5;

const getYearSettings = async (year) => {
  const YearSettings = getYearSettingsModel(getYearDb(year));
  const settings = await YearSettings.findOne({ key: 'default' }).lean();
  return settings || { locked: false, marksLocks: [] };
};

/**
 * Decides whether this caller may change something that is locked.
 * Returns null when allowed (and notes the override on req), otherwise the refusal.
 */
const lockDecision = (req, what) => {
  if (req.user?.role !== 'admin') {
    return {
      locked: true,
      message: `${what} is locked, so it can no longer be changed. Ask an administrator if a correction is needed.`,
    };
  }

  // Header values are ASCII-only, so the frontend URI-encodes the reason.
  let reason = '';
  try {
    reason = decodeURIComponent(String(req.headers[OVERRIDE_HEADER] || '')).trim();
  } catch {
    reason = String(req.headers[OVERRIDE_HEADER] || '').trim();
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      locked: true,
      requiresReason: true,
      message: `${what} is locked. To change it anyway, give a reason; it will be recorded in the audit log.`,
    };
  }

  req.lockOverride = { what, reason: reason.slice(0, 500) };
  return null;
};

// POSTs that only read or compute: allowed even when the year is locked.
const READ_ONLY_POSTS = new Set([
  '/groups/export',
  '/groups/export-single',
  '/groups/export-random',
  '/groups/check-assignment',
  '/groups/random-pick',
  '/upload/excel', // parse only
]);

const isReadOnlyRequest = (req) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.method !== 'POST') return false;
  if (READ_ONLY_POSTS.has(req.path)) return true;
  if (req.path === '/groups/generate' && !req.body?.assignToGroups) return true; // preview
  if (req.path === '/upload/import' && req.body?.dryRun) return true; // preview
  return false;
};

// Not year data: lock management itself, and the shared sender-email list.
const EXEMPT_PREFIXES = ['/year-settings', '/sender-emails'];

/** Mounted on /api after authentication: refuses writes to a locked year. */
const enforceYearLock = async (req, res, next) => {
  if (isReadOnlyRequest(req) || EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  try {
    const settings = await getYearSettings(req.year);
    if (!settings.locked) return next();

    const refusal = lockDecision(req, `Academic year ${req.year}`);
    if (refusal) return res.status(423).json({ success: false, ...refusal });

    recordAudit(req, res, 'lock.override', { lock: 'year' });
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * For routes that change marks. Returns true if the write may go ahead; otherwise it
 * has already sent the 423 response.
 */
const ensureMarksWritable = async (req, res, fields) => {
  const settings = await getYearSettings(req.year);
  const locked = fields.filter((field) => (settings.marksLocks || []).some((l) => l.field === field));
  if (locked.length === 0) return true;

  const refusal = lockDecision(req, `Marks for ${locked.join(', ')}`);
  if (refusal) {
    res.status(423).json({ success: false, lockedFields: locked, ...refusal });
    return false;
  }

  recordAudit(req, res, 'lock.override', { lock: 'marks', fields: locked });
  return true;
};

module.exports = {
  OVERRIDE_HEADER,
  getYearSettings,
  lockDecision,
  isReadOnlyRequest,
  enforceYearLock,
  ensureMarksWritable,
};
