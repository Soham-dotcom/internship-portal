/**
 * Per-student history (A16) and the admin audit-log search (A15), on an in-memory
 * replica set, driven through the real routes so the audit entries are real.
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
const { getImportBatchModel } = require('../models/ImportBatch');
const { getAuditLogModel } = require('../models/AuditLog');
const { errorHandler } = require('../middleware/errorHandler');

jest.setTimeout(180000);

let replSet;
let Internship;
let AuditLog;

const app = (() => {
  const a = express();
  a.use(express.json());
  a.use((req, res, next) => {
    const role = req.headers['x-test-role'] || 'staff';
    req.user = { id: role, username: `test-${role}`, role };
    req.year = '2026';
    next();
  });
  a.use('/api/internships', require('../routes/internships'));
  a.use('/api/upload', require('../routes/upload'));
  a.use('/api/audit-logs', require('../routes/audit-logs'));
  a.use(errorHandler);
  return a;
})();
const as = (role) => ({
  get: (url) => request(app).get(url).set('x-test-role', role),
  post: (url) => request(app).post(url).set('x-test-role', role),
  put: (url) => request(app).put(url).set('x-test-role', role),
  delete: (url) => request(app).delete(url).set('x-test-role', role),
});

const sheet = (rows) => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

// Audit writes happen just after each response; wait until they have all landed.
const waitForAuditCount = async (count) => {
  for (let i = 0; i < 100; i += 1) {
    if (await AuditLog.countDocuments() >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const db = getYearDb('2026');
  Internship = getInternshipModel(db);
  AuditLog = getAuditLogModel(getSharedDb());
  await Promise.all([Internship.init(), getImportBatchModel(db).init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

let studentId;
beforeAll(async () => {
  // A realistic life of one student record, through the real routes.
  const created = await as('staff').post('/api/internships').send({ uid: 'H1', name: 'Hema', companyName: 'Acme' });
  studentId = created.body.data._id;
  await as('staff').put(`/api/internships/${studentId}`).send({ companyName: 'Globex' });
  await as('staff').put(`/api/internships/${studentId}/marks`).send({ external_marks: 70 });
  await as('staff').post('/api/upload/evaluation/internal-viva-marks')
    .attach('file', sheet([{ uid: 'H1', internal_viva_marks: 33 }, { uid: 'OTHER', internal_viva_marks: 20 }]), 'm.xlsx');
  await as('staff').post('/api/upload/import').send({ internships: [{ uid: 'H1', remarks: 'late joiner' }], mode: 'update' });
  await as('staff').delete(`/api/internships/${studentId}`);
  await as('admin').post(`/api/internships/${studentId}/restore`);
  await waitForAuditCount(6);
});

describe('GET /api/internships/:id/history', () => {
  it('lists every change to this student, newest first, with old and new values', async () => {
    const res = await as('staff').get(`/api/internships/${studentId}/history`);
    expect(res.status).toBe(200);
    const { history } = res.body.data;
    const actions = history.map((h) => h.action);

    expect(actions[0]).toBe('Restored from Recycle Bin');
    expect(actions).toEqual(expect.arrayContaining([
      'Record created',
      'Details edited',
      'Marks edited',
      'Internal viva marks imported',
      'Details updated by spreadsheet import',
      'Moved to Recycle Bin',
    ]));

    const edit = history.find((h) => h.action === 'Details edited');
    expect(edit.by).toBe('test-staff');
    expect(edit.changes).toEqual([{ field: 'companyName', from: 'Acme', to: 'Globex' }]);

    const marks = history.find((h) => h.action === 'Marks edited');
    expect(marks.changes).toEqual([{ field: 'external_marks', from: 0, to: 70 }]);

    // From a bulk import, only this student's line, with the field name filled in.
    const imported = history.find((h) => h.action === 'Internal viva marks imported');
    expect(imported.changes).toEqual([{ field: 'internal_viva_marks', from: 0, to: 33 }]);

    const sheetUpdate = history.find((h) => h.action === 'Details updated by spreadsheet import');
    expect(sheetUpdate.changes).toEqual([{ field: 'remarks', from: '', to: 'late joiner' }]);
  });

  it('returns 404 for an unknown student', async () => {
    const res = await as('staff').get(`/api/internships/${new mongoose.Types.ObjectId()}/history`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/audit-logs', () => {
  it('is for admins only', async () => {
    expect((await as('staff').get('/api/audit-logs')).status).toBe(403);
    expect((await as('admin').get('/api/audit-logs')).status).toBe(200);
  });

  it('filters by action prefix, by actor and by student UID', async () => {
    const marks = await as('admin').get('/api/audit-logs?action=marks');
    expect(marks.body.data.length).toBeGreaterThan(0);
    expect(marks.body.data.every((e) => e.action.startsWith('marks'))).toBe(true);

    const byAdmin = await as('admin').get('/api/audit-logs?actor=test-admin');
    expect(byAdmin.body.data.map((e) => e.action)).toEqual(['internships.restore']);

    const byUid = await as('admin').get('/api/audit-logs?uid=H1');
    expect(byUid.body.total).toBeGreaterThanOrEqual(4);
  });

  it('paginates', async () => {
    const res = await as('admin').get('/api/audit-logs?limit=2&page=2');
    expect(res.body.page).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pages).toBe(Math.ceil(res.body.total / 2));
  });

  it('records browser-side exports for any signed-in user, and rejects unknown kinds', async () => {
    const ok = await as('staff').post('/api/audit-logs/export').send({ kind: 'student-records', rows: 409 });
    expect(ok.status).toBe(200);
    expect((await as('staff').post('/api/audit-logs/export').send({ kind: 'everything' })).status).toBe(400);

    let entry = null;
    for (let i = 0; i < 50 && !entry; i += 1) {
      entry = await AuditLog.findOne({ action: 'export.client', success: true }).lean();
      if (!entry) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(entry.actorUsername).toBe('test-staff');
    expect(entry.details).toEqual({ kind: 'student-records', rows: 409 });
  });

  it('lists the distinct actions for the filter', async () => {
    const res = await as('admin').get('/api/audit-logs/actions');
    expect(res.body.data).toEqual(expect.arrayContaining(['internships.create', 'internships.restore']));
  });
});
