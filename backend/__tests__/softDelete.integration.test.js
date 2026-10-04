/**
 * Soft delete + Recycle Bin, end to end on an in-memory replica set.
 *
 * The key property: once "deleted", a student disappears from EVERY read path
 * (lists, counts, aggregates, group member lists, edits), yet nothing is lost and an
 * admin can restore them exactly as they were.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.SHARED_DB_NAME = 'test-common';
process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');
const { errorHandler } = require('../middleware/errorHandler');
const internshipRoutes = require('../routes/internships');
const groupRoutes = require('../routes/groups');

jest.setTimeout(180000);

let replSet;
let Internship;
let Group;

const buildApp = (role = 'staff') => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'u1', username: `test-${role}`, role };
    req.year = '2026';
    next();
  });
  app.use('/api/internships', internshipRoutes);
  app.use('/api/groups', groupRoutes);
  app.use(errorHandler);
  return app;
};
const staff = () => request(buildApp('staff'));
const admin = () => request(buildApp('admin'));

let asha;
let bilal;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const db = getYearDb('2026');
  Internship = getInternshipModel(db);
  Group = getGroupModel(db);
  await Promise.all([Internship.init(), Group.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([Internship.deleteMany({}), Group.deleteMany({})]);
  [asha, bilal] = await Internship.create([
    { uid: 'A1', name: 'Asha', branch: 'COMPS', external_marks: 90, assignedGroup: 'g1', assignedGroupName: 'Group 1' },
    { uid: 'B2', name: 'Bilal', branch: 'COMPS', assignedGroup: 'g1', assignedGroupName: 'Group 1' },
  ]);
  await Group.create({ name: 'Group 1', students: [asha._id, bilal._id] });
});

const softDeleteAsha = () => staff().delete(`/api/internships/${asha._id}`);

describe('soft delete hides the student everywhere', () => {
  it('staff can delete; the record still exists with who and when', async () => {
    const res = await softDeleteAsha();
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Recycle Bin/);

    const raw = await Internship.collection.findOne({ uid: 'A1' });
    expect(raw.deletedAt).toBeInstanceOf(Date);
    expect(raw.deletedBy).toBe('test-staff');
    expect(raw.external_marks).toBe(90); // nothing lost
  });

  it('is hidden from the list, single fetch, counts and aggregates', async () => {
    await softDeleteAsha();

    const list = await staff().get('/api/internships');
    expect(list.body.data.map((s) => s.uid)).toEqual(['B2']);

    expect((await staff().get(`/api/internships/${asha._id}`)).status).toBe(404);

    const stats = await staff().get('/api/internships/stats/summary');
    expect(stats.body.data.totalStudents).toBe(1);

    const overview = await staff().get('/api/internships/evaluation-overview');
    expect(overview.body.data.map((s) => s.uid)).toEqual(['B2']);
  });

  it('is hidden from group member lists', async () => {
    await softDeleteAsha();
    const res = await staff().get('/api/groups/list');
    expect(res.body.data[0].students.map((s) => s.uid)).toEqual(['B2']);
  });

  it('cannot be edited, and its marks cannot be changed', async () => {
    await softDeleteAsha();
    expect((await staff().put(`/api/internships/${asha._id}`).send({ name: 'X' })).status).toBe(404);
    expect((await staff().put(`/api/internships/${asha._id}/marks`).send({ external_marks: 10 })).status).toBe(404);
  });

  it('deleting twice gives 404, not a second delete', async () => {
    await softDeleteAsha();
    expect((await softDeleteAsha()).status).toBe(404);
  });

  it('creating a new student with the same UID explains the Recycle Bin', async () => {
    await softDeleteAsha();
    const res = await staff().post('/api/internships').send({ uid: 'A1', name: 'Someone' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Recycle Bin/);
  });
});

describe('Recycle Bin (admin only)', () => {
  it('lists deleted students for an admin and refuses staff', async () => {
    await softDeleteAsha();
    const bin = await admin().get('/api/internships/recycle-bin');
    expect(bin.status).toBe(200);
    expect(bin.body.data.map((s) => s.uid)).toEqual(['A1']);
    expect(bin.body.data[0].deletedBy).toBe('test-staff');

    expect((await staff().get('/api/internships/recycle-bin')).status).toBe(403);
  });

  it('restore brings the student back exactly, group included', async () => {
    await softDeleteAsha();
    expect((await staff().post(`/api/internships/${asha._id}/restore`)).status).toBe(403);

    const res = await admin().post(`/api/internships/${asha._id}/restore`);
    expect(res.status).toBe(200);

    const back = await Internship.findById(asha._id).lean();
    expect(back.deletedAt).toBeNull();
    expect(back.external_marks).toBe(90);
    expect(back.assignedGroupName).toBe('Group 1');
    const group = await staff().get('/api/groups/list');
    expect(group.body.data[0].students.map((s) => s.uid).sort()).toEqual(['A1', 'B2']);
  });

  it('restore unassigns the student if their group no longer exists', async () => {
    await softDeleteAsha();
    await Group.deleteMany({});
    const res = await admin().post(`/api/internships/${asha._id}/restore`);
    expect(res.body.message).toMatch(/no longer exists/);
    const back = await Internship.findById(asha._id).lean();
    expect(back.assignedGroupName).toBeNull();
  });

  it('permanent delete only works from the bin, only for admins', async () => {
    // Not in the bin yet: refused, so nothing is ever erased in one step.
    expect((await admin().delete(`/api/internships/${asha._id}/permanent`)).status).toBe(404);

    await softDeleteAsha();
    expect((await staff().delete(`/api/internships/${asha._id}/permanent`)).status).toBe(403);

    const res = await admin().delete(`/api/internships/${asha._id}/permanent`);
    expect(res.status).toBe(200);
    expect(await Internship.collection.countDocuments({ uid: 'A1' })).toBe(0);
    const group = await Group.findOne({ name: 'Group 1' }).lean();
    expect(group.students.map(String)).toEqual([String(bilal._id)]);
  });
});
