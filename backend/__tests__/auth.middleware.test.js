/**
 * Tests for the authentication and authorization middleware.
 *
 * These cover the rules that must never silently regress: who is allowed to call
 * what, and which academic year a token may open. They run against real Express
 * routes via supertest, but need no database.
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.ACADEMIC_YEARS = '2025,2026,2027';

const { authRequired, requireRole, requireYearAccess } = require('../middleware/auth');

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', authRequired);
  app.use('/api', requireYearAccess);

  app.get('/api/anyone', (req, res) => res.json({ ok: true, role: req.user.role }));
  app.post('/api/admin-only', requireRole('admin'), (req, res) => res.json({ ok: true }));

  return app;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('authRequired', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(buildApp()).get('/api/anyone');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(buildApp())
      .get('/api/anyone')
      .set({ Authorization: 'NotBearer abc.def.ghi' });
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: '1', username: 'mallory', role: 'admin', year: '2026' }, 'wrong-secret');
    const res = await request(buildApp()).get('/api/anyone').set(bearer(forged));
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: '1', username: 'bob', role: 'staff', year: '2026' },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const res = await request(buildApp()).get('/api/anyone').set(bearer(expired));
    expect(res.status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const token = sign({ sub: '1', username: 'bob', role: 'staff', year: '2026', allowedYears: [] });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('treats a token with no role claim as staff, never admin', async () => {
    // Tokens issued before roles existed must not grant administrator access.
    const legacy = sign({ sub: '1', username: 'legacy', year: '2026' });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(legacy));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('staff');
  });

  it('treats an unrecognised role claim as staff', async () => {
    const weird = sign({ sub: '1', username: 'x', role: 'superuser', year: '2026' });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(weird));
    expect(res.body.role).toBe('staff');
  });
});

describe('requireRole', () => {
  it('allows an admin through an admin-only route', async () => {
    const token = sign({ sub: '1', username: 'root', role: 'admin', year: '2026', allowedYears: [] });
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks staff from an admin-only route with 403', async () => {
    const token = sign({ sub: '2', username: 'helper', role: 'staff', year: '2026', allowedYears: [] });
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('blocks a forged admin claim signed with the wrong key', async () => {
    const forged = jwt.sign({ sub: '3', username: 'mallory', role: 'admin', year: '2026' }, 'attacker-key');
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(forged));
    expect(res.status).toBe(401);
  });
});

describe('requireYearAccess', () => {
  it('allows a year that is in the account\'s allowed list', async () => {
    const token = sign({ sub: '1', username: 'bob', role: 'staff', year: '2026', allowedYears: ['2026'] });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks a year the account is not permitted to open', async () => {
    // The year used to come straight from the login form, so any account could
    // reach any year's database. It is now pinned to the account.
    const token = sign({ sub: '1', username: 'bob', role: 'staff', year: '2025', allowedYears: ['2026'] });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('treats an empty allowed list as access to every configured year', async () => {
    const token = sign({ sub: '1', username: 'bob', role: 'staff', year: '2027', allowedYears: [] });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks a year that is not configured for this deployment', async () => {
    const token = sign({ sub: '1', username: 'bob', role: 'admin', year: '1999', allowedYears: [] });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('rejects a token carrying no year at all', async () => {
    const token = sign({ sub: '1', username: 'bob', role: 'staff' });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(400);
  });
});
