const rateLimit = require('express-rate-limit');

const jsonLimitResponse = (message) => (req, res) => {
  res.status(429).json({ success: false, message });
};

/**
 * Login throttle. Deliberately strict: this portal has a handful of accounts,
 * so a legitimate user never approaches this ceiling, while an automated
 * guessing attempt hits it almost immediately.
 *
 * This is per-IP. Per-account lockout is handled separately on the User document
 * so that an attacker rotating IPs still cannot brute-force a single account.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonLimitResponse('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});

/** Broad ceiling for the rest of the API — high enough to never affect real use. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonLimitResponse('Too many requests. Please slow down and try again shortly.'),
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
