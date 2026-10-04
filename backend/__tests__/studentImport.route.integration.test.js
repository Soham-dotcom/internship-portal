/**
 * Student import: preview → apply → undo, on an in-memory replica set.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getImportBatchModel } = require('../models/ImportBatch');
const { errorHandler } = require('../middleware/errorHandler');
const uploadRoutes = require('../routes/upload');

jest.setTimeout(180000);

let replSet;
let Internship;
let ImportBatch;

const api = () => {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use((req, res, next) => {
    req.user = { id: 'u1', username: 'tester', role: 'staff' };
    req.year = '2026';
    next();
  });
  app.use('/api/upload', uploadRoutes);
  app.use(errorHandler);
  return request(app);
};

const importRows = (internships, extra = {}) => api().post('/api/upload/import').send({ internships, ...extra });

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const db = getYearDb('2026');
  Internship = getInternshipModel(db);
  ImportBatch = getImportBatchModel(db);
  await Promise.all([Internship.init(), ImportBatch.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([Internship.deleteMany({}), ImportBatch.deleteMany({})]);
  await Internship.create([
    { uid: 'A1', name: 'Asha', branch: 'COMPS', companyName: 'Acme', remarks: 'keep me', external_marks: 80 },
    { uid: 'Z9', name: 'Binned', deletedAt: new Date(), deletedBy: 'someone' },
  ]);
});

const SHEET = [
  { uid: 'A1', name: 'Asha', companyName: 'Globex' },        // changed
  { uid: 'N1', name: 'Neha', branch: 'EXTC' },               // new
  { uid: 'Z9', name: 'Binned again' },                        // in the Recycle Bin
];

describe('preview (dryRun)', () => {
  it('classifies every row and writes nothing', async () => {
    const res = await importRows(SHEET, { dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ total: 3, new: 1, changed: 1, willUpdate: 0, inRecycleBin: 1, errors: 0 });
    expect(res.body.changedStudents[0].diffs).toEqual([{ field: 'companyName', from: 'Acme', to: 'Globex' }]);
    expect(await Internship.countDocuments()).toBe(1);
    expect(await ImportBatch.countDocuments()).toBe(0);
  });

  it('reports invalid values per row', async () => {
    const res = await importRows([{ uid: 'N2', branch: 'Comps' }], { dryRun: true });
    expect(res.body.summary.errors).toBe(1);
    expect(res.body.errors[0].message).toMatch(/branch/);
  });
});

describe('apply', () => {
  it('add-only (default) inserts new students and leaves existing ones untouched', async () => {
    const res = await importRows(SHEET);
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    expect(res.body.updated).toBe(0);
    const asha = await Internship.findOne({ uid: 'A1' }).lean();
    expect(asha.companyName).toBe('Acme');
    expect((await Internship.findOne({ uid: 'N1' }).lean()).internshipType).toBe('8th Sem');
  });

  it('update mode changes only the fields in the sheet; blanks and marks are never touched', async () => {
    await importRows([{ uid: 'A1', companyName: 'Globex', remarks: '', external_marks: 0 }], { mode: 'update' });
    const asha = await Internship.findOne({ uid: 'A1' }).lean();
    expect(asha.companyName).toBe('Globex');
    expect(asha.standardized_company_name).toBe('globex');
    expect(asha.remarks).toBe('keep me');
    expect(asha.external_marks).toBe(80);
  });

  it('refuses to apply a sheet with errors unless the user accepts skipping them', async () => {
    const rows = [{ uid: 'N1', name: 'Neha' }, { uid: 'N2', branch: 'Comps' }];
    const refused = await importRows(rows);
    expect(refused.status).toBe(400);
    expect(await Internship.countDocuments({ uid: 'N1' })).toBe(0);

    const accepted = await importRows(rows, { acceptErrors: true });
    expect(accepted.status).toBe(200);
    expect(await Internship.countDocuments({ uid: 'N1' })).toBe(1);
    expect(await Internship.countDocuments({ uid: 'N2' })).toBe(0);
  });
});

describe('undo', () => {
  it('moves added students to the Recycle Bin and restores changed fields', async () => {
    const applied = await importRows(SHEET, { mode: 'update' });
    const latest = await api().get('/api/upload/import/latest');
    expect(String(latest.body.data._id)).toBe(String(applied.body.batchId));

    const res = await api().post(`/api/upload/import/${applied.body.batchId}/undo`);
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);

    expect((await Internship.findOne({ uid: 'A1' }).lean()).companyName).toBe('Acme');
    expect(await Internship.countDocuments({ uid: 'N1' })).toBe(0); // hidden...
    const neha = await Internship.collection.findOne({ uid: 'N1' });
    expect(neha.deletedAt).toBeInstanceOf(Date); // ...but recoverable from the bin
  });

  it('keeps edits made after the import and reports them as conflicts', async () => {
    const applied = await importRows([{ uid: 'A1', companyName: 'Globex' }], { mode: 'update' });
    await Internship.updateOne({ uid: 'A1' }, { $set: { companyName: 'Initech' } });

    const res = await api().post(`/api/upload/import/${applied.body.batchId}/undo`);
    expect(res.body.conflicts[0]).toMatch(/A1: companyName/);
    expect((await Internship.findOne({ uid: 'A1' }).lean()).companyName).toBe('Initech');
  });

  it('only the most recent import can be undone, and only once', async () => {
    const first = await importRows([{ uid: 'N1', name: 'Neha' }]);
    const second = await importRows([{ uid: 'N2', name: 'Om' }]);

    expect((await api().post(`/api/upload/import/${first.body.batchId}/undo`)).status).toBe(409);
    expect((await api().post(`/api/upload/import/${second.body.batchId}/undo`)).status).toBe(200);
    expect((await api().post(`/api/upload/import/${second.body.batchId}/undo`)).status).toBe(409);
  });
});
