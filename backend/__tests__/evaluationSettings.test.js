const { validateEvaluationSettings } = require('../utils/evaluationSettings');

const VALID_WEIGHTS = { meeting: 10, weekly: 30, final: 10, external: 25, external_viva: 12.5, internal_viva: 12.5 };

describe('validateEvaluationSettings', () => {
  it('accepts weights summing to exactly 100', () => {
    const result = validateEvaluationSettings({ totalWeeks: 8, weights: VALID_WEIGHTS });
    expect(result.error).toBeNull();
    expect(result.value).toEqual({ totalWeeks: 8, weights: VALID_WEIGHTS });
  });

  it('accepts numeric strings and converts them', () => {
    const weights = Object.fromEntries(Object.entries(VALID_WEIGHTS).map(([k, v]) => [k, String(v)]));
    const result = validateEvaluationSettings({ totalWeeks: '10', weights });
    expect(result.error).toBeNull();
    expect(result.value.totalWeeks).toBe(10);
    expect(result.value.weights.weekly).toBe(30);
  });

  it('rejects weights that do not sum to 100', () => {
    const result = validateEvaluationSettings({ totalWeeks: 8, weights: { ...VALID_WEIGHTS, meeting: 20 } });
    expect(result.error).toMatch(/100/);
  });

  it('rejects a missing weight instead of silently using a default', () => {
    // The old handler filled gaps with defaults, so a partial request could quietly
    // change weights the admin never touched.
    const { internal_viva, ...partial } = VALID_WEIGHTS;
    const result = validateEvaluationSettings({ totalWeeks: 8, weights: partial });
    expect(result.error).toMatch(/internal_viva/);
  });

  it('rejects negative weights', () => {
    const result = validateEvaluationSettings({
      totalWeeks: 8,
      weights: { ...VALID_WEIGHTS, meeting: -10, weekly: 50 },
    });
    expect(result.error).toMatch(/meeting/);
  });

  it('rejects non-numeric weights', () => {
    const result = validateEvaluationSettings({ totalWeeks: 8, weights: { ...VALID_WEIGHTS, final: 'ten' } });
    expect(result.error).toMatch(/final/);
  });

  it.each([0, 53, 2.5, 'abc', undefined])('rejects totalWeeks = %p', (totalWeeks) => {
    const result = validateEvaluationSettings({ totalWeeks, weights: VALID_WEIGHTS });
    expect(result.error).toMatch(/weeks/i);
  });

  it('rejects a body with no weights object', () => {
    expect(validateEvaluationSettings({ totalWeeks: 8 }).error).toBeTruthy();
    expect(validateEvaluationSettings(null).error).toBeTruthy();
  });

  it('ignores unknown keys rather than storing them', () => {
    const result = validateEvaluationSettings({ totalWeeks: 8, weights: { ...VALID_WEIGHTS, bonus: 50 } });
    expect(result.error).toBeNull();
    expect(result.value.weights.bonus).toBeUndefined();
  });
});
