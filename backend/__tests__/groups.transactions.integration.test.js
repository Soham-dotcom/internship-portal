/**
 * Group operations are all-or-nothing.
 *
 * Runs against an in-memory MongoDB *replica set*, since transactions need one
 * (Atlas always is one). Each "fails halfway" test makes the second write throw and
 * then checks that the first write was rolled back.
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
const { getMentorModel } = require('../models/Mentor');
const { errorHandler } = require('../middleware/errorHandler');
const groupRoutes = require('../routes/groups');

jest.setTimeout(180000);

let replSet;
let Internship;
let Group;
let Mentor;

const buildApp = (role = 'admin') => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'u1', username: 'tester', role };
    req.year = '2026';
    next();
  });
  app.use('/api/groups', groupRoutes);
  app.use(errorHandler);
  return app;
};

const assignedCount = () => Internship.countDocuments({ assignedGroup: { $nin: [null, ''] } });

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const db = getYearDb('2026');
  Internship = getInternshipModel(db);
  Group = getGroupModel(db);
  Mentor = getMentorModel(db);
  // Create collections and indexes up front, as they exist in production.
  await Promise.all([Internship.init(), Group.init(), Mentor.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([Internship.deleteMany({}), Group.deleteMany({}), Mentor.deleteMany({})]);
  await Internship.create(Array.from({ length: 10 }, (_, i) => ({ uid: `S${i}`, name: `Student ${i}` })));
});

describe('POST /api/groups/generate', () => {
  it('saves groups and assignments together', async () => {
    const res = await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, assignToGroups: true });
    expect(res.status).toBe(200);
    expect(await Group.countDocuments()).toBe(2);
    expect(await assignedCount()).toBe(10);
  });

  it('a preview (assignToGroups false) writes nothing', async () => {
    const res = await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.totalGroups).toBe(2);
    expect(await Group.countDocuments()).toBe(0);
    expect(await assignedCount()).toBe(0);
  });

  it('fails halfway → no student is left marked as assigned', async () => {
    jest.spyOn(Group, 'insertMany').mockRejectedValueOnce(new Error('simulated failure'));
    const res = await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, assignToGroups: true });
    expect(res.status).toBe(500);
    expect(await assignedCount()).toBe(0);
    expect(await Group.countDocuments()).toBe(0);
  });

  it('never names a new group the same as an existing one', async () => {
    await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, numGroups: 1, assignToGroups: true });
    await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, numGroups: 1, assignToGroups: true });
    const names = (await Group.find().lean()).map((g) => g.name).sort();
    expect(names).toEqual(['Group 1', 'Group 2']);
  });

  it('explains when the requested groups need more students than exist', async () => {
    const res = await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, numGroups: 3, assignToGroups: true });
    expect(res.status).toBe(400);
    expect(res.body.suggestion).toBeTruthy();
  });
});

describe('POST /api/groups/unassign', () => {
  beforeEach(async () => {
    await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, randomize: false, assignToGroups: true });
  });

  it('unassigns students, removes them from groups and deletes emptied groups', async () => {
    const firstGroup = await Group.findOne({ name: 'Group 1' }).populate('students', 'uid');
    const uids = firstGroup.students.map((s) => s.uid);

    const res = await request(buildApp()).post('/api/groups/unassign').send({ uids });
    expect(res.status).toBe(200);
    expect(res.body.groupsDeleted).toBe(1);
    expect(await Group.countDocuments()).toBe(1);
    expect(await assignedCount()).toBe(5);
  });

  it('fails halfway → students stay assigned and in their group', async () => {
    jest.spyOn(Group, 'updateMany').mockRejectedValueOnce(new Error('simulated failure'));
    const res = await request(buildApp()).post('/api/groups/unassign').send({ uids: ['S0', 'S1'] });
    expect(res.status).toBe(500);
    expect(await assignedCount()).toBe(10);
  });

  it('rejects a request with no UIDs', async () => {
    const res = await request(buildApp()).post('/api/groups/unassign').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/groups/clear-all', () => {
  beforeEach(async () => {
    await request(buildApp()).post('/api/groups/generate').send({ groupSize: 5, assignToGroups: true });
    const mentor = await Mentor.create({ name: 'M', email: 'm@example.com', isAssigned: true });
    await Group.updateOne({ name: 'Group 1' }, { $set: { externalMentor: mentor._id } });
  });

  it('clears everything in one go', async () => {
    const res = await request(buildApp()).post('/api/groups/clear-all');
    expect(res.status).toBe(200);
    expect(await Group.countDocuments()).toBe(0);
    expect(await assignedCount()).toBe(0);
    expect(await Mentor.countDocuments({ isAssigned: true })).toBe(0);
  });

  it('fails halfway → groups, assignments and mentors are all untouched', async () => {
    jest.spyOn(Mentor, 'updateMany').mockRejectedValueOnce(new Error('simulated failure'));
    const res = await request(buildApp()).post('/api/groups/clear-all');
    expect(res.status).toBe(500);
    expect(await Group.countDocuments()).toBe(2);
    expect(await assignedCount()).toBe(10);
    expect(await Mentor.countDocuments({ isAssigned: true })).toBe(1);
  });

  it('is refused for staff', async () => {
    const res = await request(buildApp('staff')).post('/api/groups/clear-all');
    expect(res.status).toBe(403);
    expect(await Group.countDocuments()).toBe(2);
  });
});
