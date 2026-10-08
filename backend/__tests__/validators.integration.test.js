/**
 * MongoDB-enforced rules for student records. Writes go through the raw driver
 * on purpose: these rules exist to stop writes that bypass the app.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.YEAR_DB_PREFIX = 'test-year-';

const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { countViolations, applyValidator } = require('../db/validators');

jest.setTimeout(120000);

let mongo;
let raw;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  raw = mongoose.connection.useDb('test-year-2026').db;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await raw.dropDatabase();
  await raw.createCollection('internships');
});

describe('before the rules are applied', () => {
  it('counts existing documents that would break them, without changing anything', async () => {
    await raw.collection('internships').insertMany([
      { uid: 'A1', external_marks: 80 },
      { uid: 'B2', external_marks: 500 }, // out of range
      { name: 'no uid at all' },           // missing uid
    ]);
    expect(await countViolations(raw, 'internships')).toBe(2);
    expect(await raw.collection('internships').countDocuments()).toBe(3);
  });
});

describe('once applied', () => {
  beforeEach(async () => {
    await applyValidator(raw, 'internships');
  });

  it.each([
    ['a missing UID', { name: 'Ghost' }],
    ['an out-of-range mark', { uid: 'X1', external_viva_marks: 41 }],
    ['a negative mark', { uid: 'X2', internal_viva_marks: -1 }],
    ['a mark stored as text', { uid: 'X3', external_marks: '90' }],
    ['a branch not in the list', { uid: 'X4', branch: 'Comps' }],
    ['a date stored as text', { uid: 'X5', startDate: '2026-01-05' }],
  ])('rejects %s, even from a raw script', async (label, doc) => {
    await expect(raw.collection('internships').insertOne(doc)).rejects.toThrow(/validation/i);
  });

  it('accepts everything the app itself writes: model saves, marks, soft delete, nulls', async () => {
    const Internship = getInternshipModel(getYearDb('2026'));
    const student = await Internship.create({ uid: 'OK1', name: 'Valid', branch: 'CSE - AIML', startDate: new Date() });
    await Internship.updateOne({ _id: student._id }, { $set: { external_marks: 87.5, internal_viva_marks: 40 } });
    await Internship.updateOne({ _id: student._id }, { $set: { deletedAt: new Date(), deletedBy: 'tester' } });
    await raw.collection('internships').updateOne({ _id: student._id }, { $set: { deletedAt: null, deletedBy: null } });
    await raw.collection('internships').insertOne({ uid: 'OK2', branch: '', startDate: null, extraField: 'allowed' });
    // A mark that has not been entered yet is stored as null in production.
    await raw.collection('internships').updateOne({ uid: 'OK2' }, { $set: { external_viva_marks: null } });
    expect(await raw.collection('internships').countDocuments()).toBe(2);
  });

  it('does not block updates to legacy documents that already broke a rule (moderate level)', async () => {
    await raw.command({ collMod: 'internships', validationLevel: 'off' });
    await raw.collection('internships').insertOne({ uid: 'OLD', external_marks: 500 });
    await applyValidator(raw, 'internships');
    await expect(raw.collection('internships').updateOne({ uid: 'OLD' }, { $set: { name: 'still editable' } }))
      .resolves.toMatchObject({ modifiedCount: 1 });
  });
});
