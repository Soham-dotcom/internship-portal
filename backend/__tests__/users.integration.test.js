/**
 * Admin user management (/api/users) against a real (in-memory) MongoDB.
 * Abuse cases first: staff escalation, locking everyone out, leaking hashes.
 */
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.ACADEMIC_YEARS = '2025,2026';

const { getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');
const { errorHandler } = require('../middleware/errorHandler');
const userRoutes = require('../routes/users');

jest.setTimeout(120000);

let mongo;
let User;
let admin;
let staff;

const app = (() => {
  const a = express();
  a.use(express.json());
  // Stand-in for authRequired: the caller's id and role come from test headers.
  a.use((req, res, next) => {
    req.user = { id: req.headers['x-test-id'], username: req.headers['x-test-name'], role: req.headers['x-test-role'] };
    next();
  });
  a.use('/api/users', userRoutes);
  a.use(errorHandler);
  return a;
})();
const as = (user) => {
  const h = { 'x-test-id': String(user._id), 'x-test-name': user.username, 'x-test-role': user.role };
  return {
    get: (u) => request(app).get(u).set(h),
    post: (u) => request(app).post(u).set(h),
    patch: (u) => request(app).patch(u).set(h),
  };
};

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
  const hash = await bcrypt.hash('an initial long passphrase', 4);
  [admin, staff] = await User.create([
    { username: 'root', passwordHash: hash, role: 'admin' },
    { username: 'helper', passwordHash: hash, role: 'staff' },
  ]);
  // Legacy records from an older schema (no username) exist in production. One has
  // role "admin": it cannot sign in, so it must never count as an active admin.
  await User.collection.insertOne({ email: 'older@example.com', role: 'admin', status: 'active' });
});

describe('access', () => {
  it('is admin only, for every action', async () => {
    expect((await as(staff).get('/api/users')).status).toBe(403);
    expect((await as(staff).post('/api/users').send({ username: 'x', password: 'long enough passphrase' })).status).toBe(403);
    expect((await as(staff).patch(`/api/users/${staff._id}`).send({ role: 'admin' })).status).toBe(403);
  });
});

describe('list', () => {
  it('lists real accounts without password hashes or lockout internals', async () => {
    const res = await as(admin).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.username).sort()).toEqual(['helper', 'root']);
    for (const u of res.body.data) {
      expect(u.passwordHash).toBeUndefined();
      expect(u.tokenVersion).toBeUndefined();
    }
  });
});

describe('create', () => {
  it('creates an account with a hashed password, defaulting to staff', async () => {
    const res = await as(admin).post('/api/users').send({ username: 'newbie', password: 'a perfectly long passphrase' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('staff');
    expect(res.body.data.passwordHash).toBeUndefined();
    const stored = await User.findOne({ username: 'newbie' });
    expect(await bcrypt.compare('a perfectly long passphrase', stored.passwordHash)).toBe(true);
  });

  it('rejects duplicates, weak passwords, bad usernames, unknown roles and unknown years', async () => {
    const bad = [
      { username: 'helper', password: 'a perfectly long passphrase' },
      { username: 'weakling', password: 'short' },
      { username: 'has spaces!', password: 'a perfectly long passphrase' },
      { username: 'boss', password: 'a perfectly long passphrase', role: 'superuser' },
      { username: 'timetraveller', password: 'a perfectly long passphrase', allowedYears: ['1999'] },
    ];
    for (const body of bad) {
      const res = await as(admin).post('/api/users').send(body);
      expect([400, 409]).toContain(res.status);
    }
    expect(await User.countDocuments({ username: { $exists: true } })).toBe(2);
  });
});

describe('update', () => {
  it('changes role, status and years, and revokes sessions when disabling', async () => {
    const res = await as(admin).patch(`/api/users/${staff._id}`).send({ role: 'admin', allowedYears: ['2026'] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'admin', allowedYears: ['2026'] });

    const before = (await User.findById(staff._id)).tokenVersion || 0;
    await as(admin).patch(`/api/users/${staff._id}`).send({ status: 'disabled' });
    const after = await User.findById(staff._id);
    expect(after.status).toBe('disabled');
    expect(after.tokenVersion).toBe(before + 1);
  });

  it('never leaves the portal without an active admin', async () => {
    const res = await as(admin).patch(`/api/users/${admin._id}`).send({ role: 'staff' });
    expect(res.status).toBe(400);
    expect((await User.findById(admin._id)).role).toBe('admin');
  });

  it('does not let an admin disable or demote themselves, even if another admin exists', async () => {
    await User.updateOne({ _id: staff._id }, { $set: { role: 'admin' } });
    expect((await as(admin).patch(`/api/users/${admin._id}`).send({ status: 'disabled' })).status).toBe(400);
    expect((await as(admin).patch(`/api/users/${admin._id}`).send({ role: 'staff' })).status).toBe(400);
  });

  it('re-enabling clears a lockout', async () => {
    await User.updateOne({ _id: staff._id }, { $set: { status: 'disabled', lockUntil: new Date(Date.now() + 60000), failedLoginAttempts: 5 } });
    await as(admin).patch(`/api/users/${staff._id}`).send({ status: 'active' });
    const u = await User.findById(staff._id);
    expect(u.lockUntil).toBeNull();
    expect(u.failedLoginAttempts).toBe(0);
  });
});

describe('reset password', () => {
  it('sets a new password and signs the user out everywhere', async () => {
    const before = (await User.findById(staff._id)).tokenVersion || 0;
    const res = await as(admin).post(`/api/users/${staff._id}/reset-password`).send({ newPassword: 'admin chosen passphrase' });
    expect(res.status).toBe(200);
    const u = await User.findById(staff._id);
    expect(await bcrypt.compare('admin chosen passphrase', u.passwordHash)).toBe(true);
    expect(u.tokenVersion).toBe(before + 1);
  });

  it('applies the same password rules', async () => {
    const res = await as(admin).post(`/api/users/${staff._id}/reset-password`).send({ newPassword: 'helper-and-more' });
    expect(res.status).toBe(400);
  });
});
