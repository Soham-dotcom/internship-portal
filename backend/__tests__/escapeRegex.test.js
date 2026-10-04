/**
 * Tests for user-input escaping before it reaches a RegExp.
 *
 * Search filters interpolate query parameters into regular expressions. Without
 * escaping, a crafted value causes catastrophic backtracking (CPU denial of
 * service) or widens a filter past what the caller should see.
 */
const { escapeRegex, containsRegex, exactRegex } = require('../utils/escapeRegex');

describe('escapeRegex', () => {
  it('escapes every regex metacharacter', () => {
    expect(escapeRegex('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeRegex('Infosys Pvt Ltd')).toBe('Infosys Pvt Ltd');
  });

  it('handles null and undefined without throwing', () => {
    expect(escapeRegex(null)).toBe('');
    expect(escapeRegex(undefined)).toBe('');
  });
});

describe('containsRegex', () => {
  it('returns null for empty or whitespace-only input so the filter is skipped', () => {
    expect(containsRegex('')).toBeNull();
    expect(containsRegex('   ')).toBeNull();
    expect(containsRegex(null)).toBeNull();
  });

  it('matches a plain substring case-insensitively', () => {
    expect(containsRegex('info').test('Infosys')).toBe(true);
  });

  it('treats a wildcard as literal text, so it cannot widen the filter', () => {
    // Before escaping, `.*` matched every company name.
    const re = containsRegex('.*');
    expect(re.test('Infosys')).toBe(false);
    expect(re.test('literally .* here')).toBe(true);
  });

  it('neutralises a catastrophic-backtracking payload', () => {
    const re = containsRegex('(a+)+$');
    const started = Date.now();
    // Against an unescaped pattern this input hangs for seconds.
    re.test('a'.repeat(40) + 'X');
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('does not throw on input that is not a valid regex', () => {
    expect(() => containsRegex('C++ (unclosed')).not.toThrow();
    expect(containsRegex('C++ (unclosed').test('C++ (unclosed')).toBe(true);
  });
});

describe('exactRegex', () => {
  it('anchors the match at both ends', () => {
    const re = exactRegex('COMPS');
    expect(re.test('COMPS')).toBe(true);
    expect(re.test('COMPS-A')).toBe(false);
    expect(re.test('X COMPS')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(exactRegex('comps').test('COMPS')).toBe(true);
  });

  it('returns null for empty input', () => {
    expect(exactRegex('')).toBeNull();
  });
});
