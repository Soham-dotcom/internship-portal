/**
 * Year lock and marks locks, end to end on an in-memory replica set.
 *
 * Rules under test (decisions D2 and D4):
 *   locked + staff → 423 · locked + admin without reason → 423 asking for one ·
 *   locked + admin with reason → allowed and recorded in the audit log.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb, getSharedDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getYearSettingsModel } = require('../models/YearSettings');
const { getAuditLogModel } = require('../models/AuditLog');
const { enforceYearLock } = require('../middleware/locks');
const { errorHandler } = require('../middleware/errorHandler');

jest.setTimeout(180000);

let replSet;
let Internship;
let YearSettings;
let AuditLog;
let student;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // Stand-in for authRequired: role comes from a test header.
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'] || 'staff';
    req.user = { id: role, username: `test-${role}`, role };
    req.year = '2026';
    next();
  });
  app.use('/api', enforceYearLock);
  app.use('/api/internships', require('../routes/internships'));
  app.use('/api/upload', require('../routes/upload'));
  app.use('/api/groups', require('../routes/groups'));
  app.use('/api/year-settings', require('../routes/year-settings'));
  app.use(errorHandler);
  return app;
};
const app = buildApp();
const as = (role, reason) => {
  const headers = { 'x-test-role': role };
  if (reason) headers['x-lock-override-reason'] = encodeURIComponent(reason);
  return {
    get: (url) => request(app).get(url).set(headers),
    post: (url) => request(app).post(url).set(headers),
    put: (url) => request(app).put(url).set(headers),
  };
};

const sheet = (rows) => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

const waitForAudit = async (filter) => {
  for (let i = 0; i < 50; i += 1) {
    const entry = await AuditLog.findOne(filter).lean();
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return null;
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const db = getYearDb('2026');
  Internship = getInternshipModel(db);
  YearSettings = getYearSettingsModel(db);
  AuditLog = getAuditLogModel(getSharedDb());
  await Promise.all([Internship.init(), YearSettings.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([Internship.deleteMany({}), YearSettings.deleteMany({}), AuditLog.deleteMany({})]);
  student = await Internship.create({ uid: 'A1', name: 'Asha', external_marks: 50, internal_viva_marks: 20 });
});

const editName = (role, reason) => as(role, reason).put(`/api/internships/${student._id}`).send({ name: 'Changed' });

describe('year lock', () => {
  it('only an admin can lock or unlock a year', async () => {
    expect((await as('staff').post('/api/year-settings/lock').send({ reason: 'results out' })).status).toBe(403);
    expect((await as('admin').post('/api/year-settings/lock').send({ reason: 'results out' })).status).toBe(200);
    expect((await as('staff').get('/api/year-settings')).body.data.locked).toBe(true);
  });

  it('when locked: staff are refused, reads still work', async () => {
    await as('admin').post('/api/year-settings/lock').send({ reason: 'results out' });

    const res = await editName('staff');
    expect(res.status).toBe(423);
    expect(res.body.requiresReason).toBeUndefined();
    expect((await Internship.findById(student._id).lean()).name).toBe('Asha');

    expect((await as('staff').get('/api/internships')).status).toBe(200);

    const refused = await waitForAudit({ action: 'lock.refused' });
    expect(refused.actorUsername).toBe('test-staff');
    expect(refused.success).toBe(false);
  });

  it('when locked: previews and exports are still allowed', async () => {
    await as('admin').post('/api/year-settings/lock').send({ reason: 'results out' });
    expect((await as('staff').post('/api/groups/generate').send({ groupSize: 1 })).status).toBe(200);
    expect((await as('staff').post('/api/upload/import').send({ internships: [{ uid: 'N1' }], dryRun: true })).status).toBe(200);
    // ...but the same calls that would write are refused.
    expect((await as('staff').post('/api/groups/generate').send({ groupSize: 1, assignToGroups: true })).status).toBe(423);
    expect((await as('staff').post('/api/upload/import').send({ internships: [{ uid: 'N1' }] })).status).toBe(423);
  });

  it('when locked: an admin must give a reason, which is audited', async () => {
    await as('admin').post('/api/year-settings/lock').send({ reason: 'results out' });

    const noReason = await editName('admin');
    expect(noReason.status).toBe(423);
    expect(noReason.body.requiresReason).toBe(true);

    const withReason = await editName('admin', 'Fixing a typo in the name');
    expect(withReason.status).toBe(200);
    expect((await Internship.findById(student._id).lean()).name).toBe('Changed');

    const override = await waitForAudit({ action: 'lock.override' });
    expect(override.details.lockOverride.reason).toBe('Fixing a typo in the name');
    const edit = await waitForAudit({ action: 'internships.update' });
    expect(edit.details.lockOverride.reason).toBe('Fixing a typo in the name');
  });

  it('unlocking needs a reason, and then staff can edit again', async () => {
    await as('admin').post('/api/year-settings/lock').send({ reason: 'results out' });
    expect((await as('admin').post('/api/year-settings/unlock').send({})).status).toBe(400);
    expect((await as('admin').post('/api/year-settings/unlock').send({ reason: 'Re-evaluation requested' })).status).toBe(200);
    expect((await editName('staff')).status).toBe(200);
  });
});

describe('marks locks', () => {
  const lockMarks = (field) => as('admin').put('/api/year-settings/marks-locks').send({ field, locked: true });

  it('a locked component refuses staff edits; other components stay editable', async () => {
    await lockMarks('external_marks');

    const locked = await as('staff').put(`/api/internships/${student._id}/marks`).send({ external_marks: 90 });
    expect(locked.status).toBe(423);
    expect(locked.body.lockedFields).toEqual(['external_marks']);

    const open = await as('staff').put(`/api/internships/${student._id}/marks`).send({ internal_viva_marks: 30 });
    expect(open.status).toBe(200);

    const stored = await Internship.findById(student._id).lean();
    expect(stored.external_marks).toBe(50);
    expect(stored.internal_viva_marks).toBe(30);
  });

  it('a locked component also refuses that marks import', async () => {
    await lockMarks('external_marks');
    const res = await as('staff')
      .post('/api/upload/evaluation/external-marks')
      .attach('file', sheet([{ uid: 'A1', external_marks: 99 }]), 'marks.xlsx');
    expect(res.status).toBe(423);
    expect((await Internship.findById(student._id).lean()).external_marks).toBe(50);
  });

  it('an admin can correct a locked mark with a reason', async () => {
    await lockMarks('external_marks');
    const res = await as('admin', 'Evaluator corrected their sheet')
      .put(`/api/internships/${student._id}/marks`).send({ external_marks: 55 });
    expect(res.status).toBe(200);
    const override = await waitForAudit({ action: 'lock.override' });
    expect(override.details.fields).toEqual(['external_marks']);
  });

  it('unlocking a component needs a reason; locking twice is harmless', async () => {
    await lockMarks('external_marks');
    await lockMarks('external_marks');
    const settings = await as('staff').get('/api/year-settings');
    expect(settings.body.data.marksLocks).toHaveLength(1);

    const noReason = await as('admin').put('/api/year-settings/marks-locks').send({ field: 'external_marks', locked: false });
    expect(noReason.status).toBe(400);
    const ok = await as('admin').put('/api/year-settings/marks-locks')
      .send({ field: 'external_marks', locked: false, reason: 'Re-evaluation' });
    expect(ok.body.data.marksLocks).toHaveLength(0);
  });
});
