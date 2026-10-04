/**
 * Validation for evaluation weights.
 *
 * These numbers decide every student's final mark, so a save is all-or-nothing:
 * every weight must be present, non-negative, and the total must be exactly 100%.
 * The previous handler silently filled missing or invalid values with defaults,
 * which meant a bad request could quietly change marks for the whole year.
 */

const WEIGHT_KEYS = ['meeting', 'weekly', 'final', 'external', 'external_viva', 'internal_viva'];

const DEFAULT_SETTINGS = {
  totalWeeks: 8,
  weights: { meeting: 10, weekly: 30, final: 10, external: 25, external_viva: 12.5, internal_viva: 12.5 },
};

const toNumber = (value) => (value === '' || value === null || value === undefined ? NaN : Number(value));

/** Returns { value, error }. Exactly one of them is null. */
const validateEvaluationSettings = (body) => {
  const fail = (error) => ({ value: null, error });

  if (!body || typeof body !== 'object' || !body.weights || typeof body.weights !== 'object') {
    return fail('Request must include totalWeeks and a weights object.');
  }

  const totalWeeks = toNumber(body.totalWeeks);
  if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 52) {
    return fail('Total weeks must be a whole number between 1 and 52.');
  }

  const weights = {};
  for (const key of WEIGHT_KEYS) {
    const value = toNumber(body.weights[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return fail(`Weight "${key}" must be a number between 0 and 100.`);
    }
    weights[key] = value;
  }

  const sum = WEIGHT_KEYS.reduce((acc, key) => acc + weights[key], 0);
  // Small tolerance for decimal weights such as 12.5 + 12.5.
  if (Math.abs(sum - 100) > 0.01) {
    return fail(`Weights must add up to 100%. They currently add up to ${Math.round(sum * 100) / 100}%.`);
  }

  return { value: { totalWeeks, weights }, error: null };
};

module.exports = {
  WEIGHT_KEYS,
  DEFAULT_SETTINGS,
  validateEvaluationSettings,
};
