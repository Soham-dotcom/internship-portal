/**
 * Escapes a user-supplied string so it can be safely embedded in a RegExp.
 *
 * Without this, a value like `(a+)+$` from a query parameter causes catastrophic
 * backtracking (CPU denial of service), and a value like `.*` lets a caller widen
 * a filter beyond what the UI intends.
 */
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive "contains" matcher for a user-supplied value.
 * Returns null for empty input so callers can skip the filter entirely.
 */
const containsRegex = (value) => {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) return null;
  return new RegExp(escapeRegex(cleaned), 'i');
};

/**
 * Case-insensitive exact-match matcher for a user-supplied value.
 */
const exactRegex = (value) => {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) return null;
  return new RegExp(`^${escapeRegex(cleaned)}$`, 'i');
};

module.exports = {
  escapeRegex,
  containsRegex,
  exactRegex,
};
