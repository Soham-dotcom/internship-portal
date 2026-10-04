/**
 * Tests for the authentication and authorization middleware.
 *
 * These cover the rules that must never silently regress: who is allowed to call
 * what, and which academic year a token may open. They run against real Express
 * routes via supertest. The user lookup is replaced by an in-memory fixture, so no
 * database is needed.
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.ACADEMIC_YEARS = '2025,2026,2027';

const { createAuthRequired, requireRole, requireYearAccess } = require('../middleware/auth');

// The database is the source of truth for role, status, years and token version.
const USERS = {
  admin1: { _id: 'admin1', username: 'root', role: 'admin', status: 'active', allowedYears: [], tokenVersion: 0 },
  staff1: { _id: 'staff1', username: 'helper', role: 'staff', status: 'active', allowedYears: [], tokenVersion: 0 },
  staff2026: { _id: 'staff2026', username: 'bob', role: 'staff', status: 'active', allowedYears: ['2026'], tokenVersion: 0 },
  disabled1: { _id: 'disabled1', username: 'gone', role: 'admin', status: 'disabled', allowedYears: [], tokenVersion: 0 },
  bumped: { _id: 'bumped', username: 'loggedout', role: 'staff', status: 'active', allowedYears: [], tokenVersion: 3 },
  legacy: { _id: 'legacy', username: 'old', role: 'admin', status: 'active', allowedYears: [] }, // no tokenVersion field yet
};

const findUser = async (id) => USERS[id] || null;

const sign = (payload, options = { expiresIn: '1h' }) => jwt.sign(payload, process.env.JWT_SECRET, options);

const buildApp = (lookup = findUser) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createAuthRequired({ findUser: lookup }));
  app.use('/api', requireYearAccess);

  app.get('/api/anyone', (req, res) => res.json({ ok: true, role: req.user.role }));
  app.post('/api/admin-only', requireRole('admin'), (req, res) => res.json({ ok: true }));

  // Same shape as the real error handler: never leak the message.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).json({ success: false }));

  return app;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('authRequired: token checks', () => {
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
    const forged = jwt.sign({ sub: 'admin1', year: '2026' }, 'wrong-secret');
    const res = await request(buildApp()).get('/api/anyone').set(bearer(forged));
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = sign({ sub: 'staff1', year: '2026' }, { expiresIn: -10 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(expired));
    expect(res.status).toBe(401);
  });

  it('accepts a valid token for an active user', async () => {
    const token = sign({ sub: 'staff1', year: '2026', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });
});

describe('authRequired: account checks on every request', () => {
  it('rejects a token whose account no longer exists', async () => {
    const token = sign({ sub: 'deleted-user', year: '2026', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(401);
  });

  it('rejects a disabled account immediately, even with an unexpired token', async () => {
    const token = sign({ sub: 'disabled1', year: '2026', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(401);
  });

  it('rejects a token issued before the last logout or password change', async () => {
    const stale = sign({ sub: 'bumped', year: '2026', tv: 2 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(stale));
    expect(res.status).toBe(401);
  });

  it('accepts a token carrying the current token version', async () => {
    const fresh = sign({ sub: 'bumped', year: '2026', tv: 3 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(fresh));
    expect(res.status).toBe(200);
  });

  it('accepts tokens issued before token versions existed (both sides default to 0)', async () => {
    const old = sign({ sub: 'legacy', year: '2026' });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(old));
    expect(res.status).toBe(200);
  });

  it('fails closed with 500 when the user lookup itself errors', async () => {
    const broken = async () => { throw new Error('db down'); };
    const token = sign({ sub: 'staff1', year: '2026', tv: 0 });
    const res = await request(buildApp(broken)).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(500);
  });
});

describe('requireRole', () => {
  it('allows an admin through an admin-only route', async () => {
    const token = sign({ sub: 'admin1', year: '2026', tv: 0 });
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks staff from an admin-only route with 403', async () => {
    const token = sign({ sub: 'staff1', year: '2026', tv: 0 });
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('takes the role from the database, ignoring an admin claim in the token', async () => {
    // A demoted user's old token still says "admin"; it must not keep admin power.
    const token = sign({ sub: 'staff1', role: 'admin', year: '2026', tv: 0 });
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('blocks a forged admin claim signed with the wrong key', async () => {
    const forged = jwt.sign({ sub: 'admin1', role: 'admin', year: '2026' }, 'attacker-key');
    const res = await request(buildApp()).post('/api/admin-only').set(bearer(forged));
    expect(res.status).toBe(401);
  });
});

describe('requireYearAccess', () => {
  it('allows a year that is in the account\'s allowed list', async () => {
    const token = sign({ sub: 'staff2026', year: '2026', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks a year the account is not permitted to open', async () => {
    // The year used to come straight from the login form, so any account could
    // reach any year's database. It is now pinned to the account.
    const token = sign({ sub: 'staff2026', year: '2025', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('treats an empty allowed list as access to every configured year', async () => {
    const token = sign({ sub: 'staff1', year: '2027', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('blocks a year that is not configured for this deployment', async () => {
    const token = sign({ sub: 'admin1', year: '1999', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('rejects a token carrying no year at all', async () => {
    const token = sign({ sub: 'staff1', tv: 0 });
    const res = await request(buildApp()).get('/api/anyone').set(bearer(token));
    expect(res.status).toBe(400);
  });
});
