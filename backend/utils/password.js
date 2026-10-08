/**
 * Password rules shared by change-password, admin reset and account creation.
 * Length beats complexity rules: a 12+ character passphrase is both stronger and
 * easier to remember than "P@ssw0rd!". Returns an error message, or null if fine.
 */
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

const checkPassword = (password, username = '') => {
  if (typeof password !== 'string') return 'A password is required.';
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters (a short phrase works well).`;
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  const name = String(username || '').trim().toLowerCase();
  if (name && password.toLowerCase().includes(name)) return 'The password must not contain the username.';
  return null;
};

// bcrypt cost: ~250 ms per hash on a small server, slow enough to hurt guessing.
const BCRYPT_ROUNDS = 12;

module.exports = {
  MIN_LENGTH,
  BCRYPT_ROUNDS,
  checkPassword,
};
