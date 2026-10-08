/**
 * End-to-end session tests against a real (in-memory) MongoDB.
 *
 * Proves the full lifecycle through the real login route, the real user model and
 * the real per-request account check: sign in, use the token, sign out, and the
 * old token stops working immediately.
 */
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.ACADEMIC_YEARS = '2025,2026';
process.env.SHARED_DB_NAME = 'test-common';

const { getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');
const { authRequired, requireYearAccess, requireRole } = require('../middleware/auth');
const authRoutes = require('../routes/auth');

jest.setTimeout(120000);

let mongo;
let User;
const PASSWORD = 'correct horse battery staple';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api', authRequired, requireYearAccess);
  app.get('/api/me', (req, res) => res.json({ role: req.user.role }));
  app.post('/api/admin-only', requireRole('admin'), (req, res) => res.json({ ok: true }));
  return app;
};

const login = (app, username = 'alice') => request(app)
  .post('/api/auth/login')
  .send({ username, password: PASSWORD, year: '2026' });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  User = getUserModel(getSharedDb());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await User.create({
    username: 'alice',
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: 'admin',
  });
});

describe('session lifecycle', () => {
  it('a freshly issued token works', async () => {
    const app = buildApp();
    const { body } = await login(app);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('logout invalidates the token immediately', async () => {
    const app = buildApp();
    const { body } = await login(app);
    const auth = { Authorization: `Bearer ${body.data.token}` };

    const out = await request(app).post('/api/auth/logout').set(auth);
    expect(out.status).toBe(200);

    const after = await request(app).get('/api/me').set(auth);
    expect(after.status).toBe(401);
  });

  it('logging in again after logout gives a working token', async () => {
    const app = buildApp();
    const first = await login(app);
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first.body.data.token}`);

    const second = await login(app);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${second.body.data.token}`);
    expect(res.status).toBe(200);
  });

  it('disabling an account cuts off its existing token on the next request', async () => {
    const app = buildApp();
    const { body } = await login(app);
    await User.updateOne({ username: 'alice' }, { $set: { status: 'disabled' } });

    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(401);
  });

  describe('change password', () => {
    const NEW_PASSWORD = 'a brand new long passphrase';
    const change = (app, token, body) => request(app)
      .post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);

    it('refuses a wrong current password and changes nothing', async () => {
      const app = buildApp();
      const { body } = await login(app);
      const res = await change(app, body.data.token, { currentPassword: 'wrong guess here', newPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect((await login(app)).status).toBe(200); // old password still works
    });

    it('refuses a weak new password', async () => {
      const app = buildApp();
      const { body } = await login(app);
      const res = await change(app, body.data.token, { currentPassword: PASSWORD, newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/12/);
    });

    it('changes the password and signs out every existing session', async () => {
      const app = buildApp();
      const { body } = await login(app);
      const res = await change(app, body.data.token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);

      expect((await request(app).get('/api/me').set('Authorization', `Bearer ${body.data.token}`)).status).toBe(401);
      expect((await login(app)).status).toBe(401); // old password no longer works
      const fresh = await request(app).post('/api/auth/login').send({ username: 'alice', password: NEW_PASSWORD, year: '2026' });
      expect(fresh.status).toBe(200);
    });

    it('requires being signed in', async () => {
      const res = await request(buildApp()).post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
    });
  });

  it('demoting an admin removes admin access without waiting for token expiry', async () => {
    const app = buildApp();
    const { body } = await login(app);
    const auth = { Authorization: `Bearer ${body.data.token}` };
    expect((await request(app).post('/api/admin-only').set(auth)).status).toBe(200);

    await User.updateOne({ username: 'alice' }, { $set: { role: 'staff' } });
    expect((await request(app).post('/api/admin-only').set(auth)).status).toBe(403);
  });
});
