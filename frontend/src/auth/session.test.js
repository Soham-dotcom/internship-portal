import { getTokenExpiry, safeNextPath, loginUrl } from './session';

// Builds an unsigned JWT-shaped string; only the payload matters client-side.
const tokenWith = (payload) => {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.signature`;
};

describe('getTokenExpiry', () => {
  it('reads exp (seconds) as a millisecond timestamp', () => {
    expect(getTokenExpiry(tokenWith({ exp: 1700000000 }))).toBe(1700000000 * 1000);
  });

  it('returns null for missing, malformed or exp-less tokens', () => {
    expect(getTokenExpiry(null)).toBeNull();
    expect(getTokenExpiry('not-a-jwt')).toBeNull();
    expect(getTokenExpiry(tokenWith({ sub: 'x' }))).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('keeps an in-app path with its query string', () => {
    expect(safeNextPath('/all-mentors?type=internal')).toBe('/all-mentors?type=internal');
  });

  it('refuses anything that could leave the app (open redirect)', () => {
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('never sends you back to the login page itself', () => {
    expect(safeNextPath('/login?next=/x')).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('loginUrl', () => {
  it('carries the reason and where to return to', () => {
    expect(loginUrl('expired', '/evaluation-overview?x=1'))
      .toBe('/login?reason=expired&next=%2Fevaluation-overview%3Fx%3D1');
  });

  it('omits next when it would just be the home page', () => {
    expect(loginUrl('expired', '/')).toBe('/login?reason=expired');
  });
});
