/**
 * After a restart (every deploy, every Render cold start) no models are registered
 * yet. Routes that populate group members must work even when they are the very
 * first request, before any other route has touched the Internship model.
 *
 * Runs in its own Jest worker, so models registered by other test files can't hide
 * the problem.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.YEAR_DB_PREFIX = 'cold-';

jest.setTimeout(120000);

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Seed with the raw driver so no Mongoose model gets registered here.
  const db = mongoose.connection.getClient().db('cold-2026');
  const { insertedId: studentId } = await db.collection('internships').insertOne({ uid: 'C1', name: 'Cold' });
  const { insertedId: mentorId } = await db.collection('mentors').insertOne({ name: 'M', email: 'm@example.com', isAssigned: true });
  await db.collection('groups').insertOne({ name: 'Group 1', students: [studentId], externalMentor: mentorId });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

it('the evaluator directory works as the first request after a restart', async () => {
  const { buildMentorDetails } = require('../routes/mentors');
  const mentors = await buildMentorDetails('external', { year: '2026' });
  expect(mentors).toHaveLength(1);
  expect(mentors[0].studentsHandled).toBe(1);
  expect(mentors[0].assignedGroups[0]).toMatchObject({ name: 'Group 1', studentCount: 1 });
});

it('does not count students who are in the Recycle Bin', async () => {
  const db = mongoose.connection.getClient().db('cold-2026');
  await db.collection('internships').updateOne({ uid: 'C1' }, { $set: { deletedAt: new Date() } });
  const { buildMentorDetails } = require('../routes/mentors');
  const [mentor] = await buildMentorDetails('external', { year: '2026' });
  expect(mentor.studentsHandled).toBe(0);
  expect(mentor.assignedGroups[0].studentCount).toBe(0);
  await db.collection('internships').updateOne({ uid: 'C1' }, { $set: { deletedAt: null } });
});

it('lists unassigned mentors with no groups', async () => {
  const db = mongoose.connection.getClient().db('cold-2026');
  await db.collection('mentors').insertOne({ name: 'Free', email: 'free@example.com', isAssigned: false });
  const { buildMentorDetails } = require('../routes/mentors');
  const free = (await buildMentorDetails('external', { year: '2026' })).find((m) => m.name === 'Free');
  expect(free).toMatchObject({ groupCount: 0, studentsHandled: 0, assignedGroups: [] });
});
