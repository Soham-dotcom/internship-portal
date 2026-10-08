const { redact } = require('../utils/redact');

describe('redact', () => {
  it('masks email addresses anywhere in a message', () => {
    expect(redact('E11000 duplicate key error dup key: { email: "asha.k@student.spit.ac.in" }'))
      .toBe('E11000 duplicate key error dup key: { email: "<email>" }');
    expect(redact('550 5.1.1 <mentor@example.com>: user unknown, cc x_y+z@a.co.in'))
      .toBe('550 5.1.1 <<email>>: user unknown, cc <email>');
  });

  it('leaves ordinary text alone and tolerates non-strings', () => {
    expect(redact('Group 7 not found')).toBe('Group 7 not found');
    expect(redact(undefined)).toBe('');
    expect(redact(404)).toBe('404');
  });
});
