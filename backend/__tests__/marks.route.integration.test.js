/**
 * PUT /api/internships/:id/marks against a real (in-memory) MongoDB.
 *
 * Checks that marks are saved, invalid marks change nothing, other fields cannot
 * be smuggled through, and every change lands in the audit log with old and new values.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb, getSharedDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getAuditLogModel } = require('../models/AuditLog');
const internshipRoutes = require('../routes/internships');

jest.setTimeout(120000);

let mongo;
let Internship;
let AuditLog;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // Stand-in for authRequired: these tests are about the route, not the token.
  app.use((req, res, next) => {
    req.user = { id: 'u1', username: 'tester', role: 'staff' };
    req.year = '2026';
    next();
  });
  app.use('/api/internships', internshipRoutes);
  return app;
};

// The audit write happens after the response is sent; poll briefly for it.
const waitForAudit = async (action) => {
  for (let i = 0; i < 50; i += 1) {
    const entry = await AuditLog.findOne({ action }).lean();
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return null;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  Internship = getInternshipModel(getYearDb('2026'));
  AuditLog = getAuditLogModel(getSharedDb());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

let student;
beforeEach(async () => {
  await Internship.deleteMany({});
  await AuditLog.deleteMany({});
  student = await Internship.create({ uid: '2022300002', name: 'Test Student', external_marks: 40 });
});

describe('PUT /api/internships/:id/marks', () => {
  it('saves valid marks and returns the stored values', async () => {
    const res = await request(buildApp())
      .put(`/api/internships/${student._id}/marks`)
      .send({ external_marks: 85, internal_viva_marks: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.external_marks).toBe(85);
    const stored = await Internship.findById(student._id).lean();
    expect(stored.external_marks).toBe(85);
    expect(stored.internal_viva_marks).toBe(30);
  });

  it('records old and new values in the audit log', async () => {
    await request(buildApp())
      .put(`/api/internships/${student._id}/marks`)
      .send({ external_marks: 85 });

    const entry = await waitForAudit('internships.marks-update');
    expect(entry).not.toBeNull();
    expect(entry.actorUsername).toBe('tester');
    expect(entry.details.uid).toBe('2022300002');
    expect(entry.details.changes).toEqual([{ field: 'external_marks', from: 40, to: 85 }]);
  });

  it('rejects an out-of-range mark and changes nothing', async () => {
    const res = await request(buildApp())
      .put(`/api/internships/${student._id}/marks`)
      .send({ external_marks: 70, external_viva_marks: 99 });

    expect(res.status).toBe(400);
    const stored = await Internship.findById(student._id).lean();
    expect(stored.external_marks).toBe(40);
  });

  it('cannot be used to change identity or group fields', async () => {
    await request(buildApp())
      .put(`/api/internships/${student._id}/marks`)
      .send({ external_marks: 60, uid: 'HACKED', name: 'Changed', assignedGroup: 'x' });

    const stored = await Internship.findById(student._id).lean();
    expect(stored.uid).toBe('2022300002');
    expect(stored.name).toBe('Test Student');
    expect(stored.assignedGroup).toBeNull();
  });

  it('returns 404 for an unknown student and 400 for a malformed id', async () => {
    const missing = await request(buildApp())
      .put(`/api/internships/${new mongoose.Types.ObjectId()}/marks`)
      .send({ external_marks: 50 });
    expect(missing.status).toBe(404);

    const malformed = await request(buildApp()).put('/api/internships/not-an-id/marks').send({ external_marks: 50 });
    expect(malformed.status).toBe(400);
  });
});
