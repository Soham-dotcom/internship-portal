const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { parseYears } = require('../config/years');
const { getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');

const SESSION_ENDED = 'Your session has ended. Please sign in again.';

const defaultFindUser = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return getUserModel(getSharedDb())
    .findById(id)
    .select('username role status allowedYears tokenVersion')
    .lean();
};

/**
 * Builds the authentication middleware.
 *
 * The JWT only proves WHO the caller is. Role, account status, allowed years and
 * token version are re-read from the user record on every request, so that
 * disabling an account, demoting it, or logging out takes effect immediately
 * instead of when the 12-hour token expires. At this portal's scale the extra
 * lookup (one indexed read on a tiny collection) is negligible.
 *
 * `findUser` is injectable so tests can run without a database.
 */
const createAuthRequired = ({ findUser = defaultFindUser } = {}) => async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authorization token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  let user;
  try {
    user = await findUser(payload.sub);
  } catch (error) {
    // Fail closed: if we cannot confirm the account, do not let the request through.
    return next(error);
  }

  if (!user || user.status === 'disabled') {
    return res.status(401).json({ success: false, message: SESSION_ENDED });
  }

  // Logout and password changes increment tokenVersion, which invalidates every
  // token issued before that moment. Missing values on either side mean 0, so
  // tokens issued before this check existed keep working.
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
    return res.status(401).json({ success: false, message: SESSION_ENDED });
  }

  req.user = {
    id: String(user._id),
    username: user.username,
    role: user.role === 'admin' ? 'admin' : 'staff',
    year: payload.year,
    allowedYears: Array.isArray(user.allowedYears) ? user.allowedYears.map(String) : [],
  };
  req.year = payload.year;

  return next();
};

const authRequired = createAuthRequired();

/**
 * Restricts a route to specific roles.
 *
 *   router.post('/clear-all', requireRole('admin'), handler)
 *
 * This is the single hook to extend when more roles are introduced later.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action. Please contact an administrator.',
    });
  }

  return next();
};

/**
 * Ensures the academic year encoded in the token is one this user may access.
 *
 * The year used to come straight from a dropdown on the login form, so any account
 * could reach any year's database simply by picking a different option. The allowed
 * list now comes from the user record and is baked into the token at sign-in.
 */
const requireYearAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const year = String(req.year || '');
  if (!year) {
    return res.status(400).json({ success: false, message: 'No academic year selected' });
  }

  // The year must still be one the deployment knows about.
  if (!parseYears().includes(year)) {
    return res.status(403).json({ success: false, message: 'This academic year is no longer available.' });
  }

  const allowed = req.user.allowedYears || [];
  if (allowed.length > 0 && !allowed.includes(year)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this academic year.',
    });
  }

  return next();
};

module.exports = {
  createAuthRequired,
  authRequired,
  requireRole,
  requireYearAccess,
};
