const mongoose = require('mongoose');

const ROLES = ['admin', 'staff'];

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },

  /**
   * Two roles only, deliberately.
   *
   *   admin — everything, including destructive bulk operations, evaluation weights
   *           and mail sender credentials.
   *   staff — all day-to-day work: imports, records, groups, mentor allocation,
   *           mail sending, evaluation imports, analytics, exports.
   *
   * The default is the LESS privileged role so that any account created without an
   * explicit role fails closed rather than open.
   */
  role: { type: String, enum: ROLES, default: 'staff', required: true },

  status: { type: String, enum: ['active', 'disabled'], default: 'active' },

  /**
   * Academic year databases this user may access.
   * An empty array means "every year configured in ACADEMIC_YEARS".
   */
  allowedYears: { type: [String], default: [] },

  name: { type: String, default: '' },
  email: { type: String, default: '' },

  // Per-account brute-force protection. The IP rate limiter alone cannot stop an
  // attacker who rotates addresses against a single known username.
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },

  /**
   * Copied into every token as `tv`. Incrementing it (logout, password change)
   * instantly invalidates all tokens issued before, on every device.
   */
  tokenVersion: { type: Number, default: 0 },
}, {
  timestamps: true,
});

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

/** Years this user may actually use, given the globally configured list. */
userSchema.methods.resolveAllowedYears = function resolveAllowedYears(configuredYears) {
  if (!this.allowedYears || this.allowedYears.length === 0) return configuredYears;
  return configuredYears.filter((year) => this.allowedYears.includes(String(year)));
};

const getUserModel = (conn) => conn.models.User || conn.model('User', userSchema);

module.exports = {
  ROLES,
  userSchema,
  getUserModel,
};
