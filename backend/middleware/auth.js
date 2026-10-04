const jwt = require('jsonwebtoken');
const { parseYears } = require('../config/years');

/**
 * Verifies the bearer token and populates req.user.
 *
 * This only establishes WHO the caller is. What they may do is decided by
 * requireRole() and requireYearAccess() below — never by the frontend.
 */
const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      username: payload.username,
      // Tokens issued before roles existed have no `role` claim. Treat them as the
      // LESS privileged role so an old token can never grant admin powers.
      role: payload.role === 'admin' ? 'admin' : 'staff',
      year: payload.year,
      allowedYears: Array.isArray(payload.allowedYears) ? payload.allowedYears : [],
    };
    req.year = payload.year;

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

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
  authRequired,
  requireRole,
  requireYearAccess,
};
