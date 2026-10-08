/**
 * Account administration (admin only): list, create, change role / status / years,
 * reset a password. Replaces running scripts/manage-users.js from a terminal.
 *
 * Safety rules:
 *   - the portal always keeps at least one active admin
 *   - admins cannot disable or demote themselves (ask another admin)
 *   - disabling or resetting a password signs that user out everywhere
 *   - password hashes and session internals never leave the server
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { getSharedDb } = require('../db/connection');
const { getUserModel, ROLES } = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { parseYears } = require('../config/years');
const { checkPassword, BCRYPT_ROUNDS } = require('../utils/password');

const router = express.Router();
router.use(requireRole('admin'));

const USERNAME = /^[A-Za-z0-9._@-]{3,64}$/;
const PUBLIC_FIELDS = 'username role status allowedYears name email lastLoginAt lockUntil createdAt';

const model = () => getUserModel(getSharedDb());

const toPublic = (user) => {
  const u = user.toObject ? user.toObject() : user;
  return {
    _id: u._id,
    username: u.username,
    role: u.role,
    status: u.status,
    allowedYears: u.allowedYears || [],
    name: u.name || '',
    email: u.email || '',
    lastLoginAt: u.lastLoginAt || null,
    locked: Boolean(u.lockUntil && new Date(u.lockUntil) > new Date()),
    createdAt: u.createdAt,
  };
};

/** Returns an error message for a bad allowedYears value, or null. */
const checkYears = (years) => {
  if (years === undefined) return null;
  if (!Array.isArray(years)) return 'allowedYears must be a list (empty = every year).';
  const configured = parseYears();
  const unknown = years.map(String).filter((y) => !configured.includes(y));
  return unknown.length > 0 ? `Unknown academic year(s): ${unknown.join(', ')}` : null;
};

// Second line of defence behind the "not yourself" rule. Only real accounts count:
// production holds a legacy record with role "admin" but no username, which can
// never sign in and must not be mistaken for a working administrator.
const activeAdminCount = (exceptId) => model().countDocuments({
  role: 'admin', status: 'active', username: { $exists: true }, _id: { $ne: exceptId },
});

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    // Legacy records from an older schema have no username and cannot sign in.
    const users = await model().find({ username: { $exists: true } }).select(PUBLIC_FIELDS).sort({ username: 1 }).lean();
    return res.json({ success: true, data: users.map(toPublic) });
  } catch (error) {
    return next(error);
  }
});

// POST /api/users  { username, password, role?, allowedYears?, name?, email? }
router.post('/', audit('users.create', (req, res) => ({
  username: String(req.body?.username || '').trim(),
  role: req.body?.role || 'staff',
  outcome: res.statusCode < 400 ? 'created' : `failed (${res.statusCode})`,
})), async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const role = req.body?.role || 'staff';
    const { password, allowedYears, name = '', email = '' } = req.body || {};

    if (!USERNAME.test(username)) {
      return res.status(400).json({ success: false, message: 'Username: 3–64 characters, letters, numbers and . _ @ - only.' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
    }
    const problem = checkPassword(password, username) || checkYears(allowedYears);
    if (problem) return res.status(400).json({ success: false, message: problem });

    if (await model().exists({ username })) {
      return res.status(409).json({ success: false, message: 'That username is already taken.' });
    }

    const user = await model().create({
      username,
      role,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      allowedYears: (allowedYears || []).map(String),
      name: String(name).slice(0, 100),
      email: String(email).slice(0, 200),
    });
    return res.status(201).json({ success: true, message: `Account "${username}" created.`, data: toPublic(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'That username is already taken.' });
    return next(error);
  }
});

// PATCH /api/users/:id  { role?, status?, allowedYears? }
router.patch('/:id', audit('users.update', (req, res) => res.locals.auditDetails || { userId: req.params.id }), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const user = await model().findById(req.params.id);
    if (!user || !user.username) return res.status(404).json({ success: false, message: 'User not found' });

    const { role, status, allowedYears } = req.body || {};
    const isSelf = String(user._id) === String(req.user.id);

    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
    }
    if (status !== undefined && !['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "active" or "disabled".' });
    }
    const yearProblem = checkYears(allowedYears);
    if (yearProblem) return res.status(400).json({ success: false, message: yearProblem });

    const losingAdmin = user.role === 'admin' && user.status === 'active'
      && ((role !== undefined && role !== 'admin') || status === 'disabled');
    if (losingAdmin && isSelf) {
      return res.status(400).json({ success: false, message: 'You cannot demote or disable your own account. Ask another administrator.' });
    }
    if (losingAdmin && (await activeAdminCount(user._id)) === 0) {
      return res.status(400).json({ success: false, message: 'This is the only active administrator. Make someone else an admin first.' });
    }

    const changes = [];
    const set = (field, value) => {
      const from = user[field];
      if (JSON.stringify(from) === JSON.stringify(value)) return;
      changes.push({ field, from, to: value });
      user[field] = value;
    };
    if (role !== undefined) set('role', role);
    if (allowedYears !== undefined) set('allowedYears', allowedYears.map(String));
    if (status !== undefined) {
      set('status', status);
      // Disabling signs them out everywhere; re-enabling clears any lockout.
      if (status === 'disabled') user.tokenVersion = (user.tokenVersion || 0) + 1;
      if (status === 'active') { user.failedLoginAttempts = 0; user.lockUntil = null; }
    }
    await user.save();

    res.locals.auditDetails = { userId: String(user._id), username: user.username, changes };
    return res.json({ success: true, message: `Account "${user.username}" updated.`, data: toPublic(user) });
  } catch (error) {
    return next(error);
  }
});

// POST /api/users/:id/reset-password  { newPassword }
router.post('/:id/reset-password', audit('users.reset-password', (req, res) => res.locals.auditDetails || { userId: req.params.id }), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const user = await model().findById(req.params.id);
    if (!user || !user.username) return res.status(404).json({ success: false, message: 'User not found' });

    const problem = checkPassword(req.body?.newPassword, user.username);
    if (problem) return res.status(400).json({ success: false, message: problem });

    user.passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // whoever had the old password is cut off
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    res.locals.auditDetails = { userId: String(user._id), username: user.username };
    return res.json({ success: true, message: `Password reset for "${user.username}". They have been signed out everywhere.` });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
