const { checkPassword } = require('../utils/password');

describe('checkPassword', () => {
  it('accepts a long passphrase', () => {
    expect(checkPassword('correct horse battery staple', 'alice')).toBeNull();
  });

  it('requires at least 12 characters', () => {
    expect(checkPassword('short-pass', 'alice')).toMatch(/12/);
  });

  it('rejects absurdly long input (bcrypt only uses the first 72 bytes)', () => {
    expect(checkPassword('x'.repeat(129), 'alice')).toMatch(/128/);
  });

  it('rejects a password containing the username', () => {
    expect(checkPassword('alice-is-great-2026', 'Alice')).toMatch(/username/);
  });

  it('rejects missing or non-string input', () => {
    expect(checkPassword(undefined, 'alice')).toBeTruthy();
    expect(checkPassword(123456789012, 'alice')).toBeTruthy();
  });
});
