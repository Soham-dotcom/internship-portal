const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');
const { parseYears } = require('../config/years');

const router = express.Router();

// Per-account lockout. The IP rate limiter stops a single host hammering the
// endpoint; this stops a distributed attempt against one known username.
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

const INVALID_CREDENTIALS = 'Invalid username or password';

router.get('/config', (req, res) => {
  const years = parseYears();
  res.json({ success: true, data: { years } });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password, year } = req.body || {};
    if (!username || !password || !year) {
      return res.status(400).json({ success: false, message: 'Username, password, and year are required' });
    }

    const years = parseYears();
    if (!years.includes(String(year))) {
      return res.status(400).json({ success: false, message: 'Invalid year selection' });
    }

    const User = getUserModel(getSharedDb());
    const user = await User.findOne({ username: String(username).trim() });

    // Same generic response whether or not the username exists.
    if (!user) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'This account has been disabled. Please contact an administrator.',
      });
    }

    if (user.isLocked()) {
      const minutesLeft = Math.max(1, Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000));
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked after too many failed sign-in attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    let passwordMatch = false;
    if (user.passwordHash) {
      passwordMatch = await bcrypt.compare(String(password), user.passwordHash);
    } else if (user.password) {
      // Legacy plaintext record: verify, then upgrade to a hash immediately.
      passwordMatch = String(password) === String(user.password);
      if (passwordMatch) {
        user.passwordHash = await bcrypt.hash(String(password), 12);
        user.password = undefined;
      }
    }

    if (!passwordMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    // The year is no longer taken on trust from the login form — it must be one
    // this account is permitted to open.
    const allowedYears = user.resolveAllowedYears(years);
    if (!allowedYears.includes(String(year))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this academic year.',
      });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        username: user.username,
        role: user.role,
        year: String(year),
        allowedYears,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      data: {
        token,
        username: user.username,
        role: user.role,
        year: String(year),
        allowedYears,
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
