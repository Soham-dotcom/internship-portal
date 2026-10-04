/**
 * The marks-import routes against a real (in-memory) MongoDB, with real .xlsx uploads.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb, getSharedDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getAuditLogModel } = require('../models/AuditLog');
const uploadRoutes = require('../routes/upload');

jest.setTimeout(120000);

let mongo;
let Internship;
let AuditLog;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'u1', username: 'tester', role: 'staff' };
    req.year = '2026';
    next();
  });
  app.use('/api/upload', uploadRoutes);
  return app;
};

const sheet = (rows) => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

const upload = (type, rows) => request(buildApp())
  .post(`/api/upload/evaluation/${type}`)
  .attach('file', sheet(rows), 'marks.xlsx');

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

beforeEach(async () => {
  await Internship.deleteMany({});
  await AuditLog.deleteMany({});
  await Internship.create([
    { uid: 'A1', name: 'Asha', external_viva_marks: 10 },
    { uid: 'B2', name: 'Bilal', external_viva_marks: 20 },
  ]);
});

const marksOf = async (uid) => (await Internship.findOne({ uid }).lean()).external_viva_marks;

describe('POST /api/upload/evaluation/external-viva-marks', () => {
  it('applies valid marks, keeps decimals, and reports unknown UIDs', async () => {
    const res = await upload('external-viva-marks', [
      { UID: 'A1', 'External Viva Marks': 32.5 },
      { UID: 'B2', 'External Viva Marks': 20 },
      { UID: 'ZZ9', 'External Viva Marks': 30 },
    ]);

    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(1);
    expect(res.body.unchanged).toBe(1);
    expect(res.body.errors.join(' ')).toMatch(/ZZ9/);
    expect(await marksOf('A1')).toBe(32.5);
  });

  it('rejects the whole file when any mark is invalid, changing nothing', async () => {
    const res = await upload('external-viva-marks', [
      { UID: 'A1', 'External Viva Marks': 35 },
      { UID: 'B2', 'External Viva Marks': 99 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/B2/);
    expect(await marksOf('A1')).toBe(10);
    expect(await marksOf('B2')).toBe(20);
  });

  it('audits every changed mark with its old and new value', async () => {
    await upload('external-viva-marks', [{ UID: 'A1', 'External Viva Marks': 33 }]);
    const entry = await waitForAudit('marks-import.external-viva-marks');
    expect(entry.details.changes).toEqual([{ uid: 'A1', from: 10, to: 33 }]);
  });

  it('explains which columns are needed when the sheet has none of them', async () => {
    const res = await upload('external-viva-marks', [{ UID: 'A1', Score: 30 }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/external_viva_marks/);
  });
});

describe('POST /api/upload/evaluation/meeting-attendance', () => {
  it('accepts yes/no and numeric 0/1', async () => {
    const res = await upload('meeting-attendance', [
      { uid: 'A1', meeting_attended: 'Yes' },
      { uid: 'B2', meeting_attended: 0 },
    ]);
    expect(res.status).toBe(200);
    expect((await Internship.findOne({ uid: 'A1' }).lean()).meeting_attended).toBe(1);
    expect((await Internship.findOne({ uid: 'B2' }).lean()).meeting_attended).toBe(0);
  });
});
