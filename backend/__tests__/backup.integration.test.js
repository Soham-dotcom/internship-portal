/**
 * Backup → encrypt → decrypt → restore round trip against a real (in-memory) MongoDB.
 *
 * A backup that has never been restored is not a backup. This test restores one
 * and checks that documents, types (ObjectId, Date) and unique indexes survive.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  createBackup,
  serializeBackup,
  deserializeBackup,
  restoreBackup,
} = require('../utils/backup');

jest.setTimeout(120000);

let mongo;
let client;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  client = mongoose.connection.getClient();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  const { databases } = await client.db().admin().listDatabases();
  await Promise.all(databases
    .filter((d) => d.name.startsWith('t-'))
    .map((d) => client.db(d.name).dropDatabase()));

  const year = client.db('t-year-2026');
  await year.collection('internships').createIndex({ uid: 1 }, { unique: true });
  await year.collection('internships').insertMany([
    { uid: 'A1', name: 'Asha', external_marks: 80, startDate: new Date('2026-01-05T00:00:00Z') },
    { uid: 'B2', name: 'Bilal', external_marks: 0 },
  ]);
  const group = await year.collection('groups').insertOne({ name: 'Group 1', students: [] });
  await year.collection('groups').updateOne({ _id: group.insertedId }, { $set: { mentor: new mongoose.Types.ObjectId() } });
  await client.db('t-common').collection('users').insertOne({ username: 'admin', role: 'admin' });
});

const DBS = ['t-common', 't-year-2026'];

describe('backup and restore', () => {
  it('captures every collection of every listed database', async () => {
    const backup = await createBackup(client, DBS);
    expect(Object.keys(backup.databases).sort()).toEqual(DBS);
    expect(backup.databases['t-year-2026'].internships.documents).toHaveLength(2);
    expect(backup.databases['t-common'].users.documents).toHaveLength(1);
    expect(backup.meta.counts['t-year-2026.internships']).toBe(2);
  });

  it('round-trips through encryption and restores exact documents, types and indexes', async () => {
    const backup = await createBackup(client, DBS);
    const encrypted = serializeBackup(backup, 'a long test passphrase');
    const decoded = deserializeBackup(encrypted, 'a long test passphrase');

    await restoreBackup(client, decoded, { suffix: '-restored' });

    const original = await client.db('t-year-2026').collection('internships').find().sort({ uid: 1 }).toArray();
    const restored = await client.db('t-year-2026-restored').collection('internships').find().sort({ uid: 1 }).toArray();
    expect(restored).toEqual(original);
    expect(restored[0]._id).toBeInstanceOf(mongoose.mongo.ObjectId);
    expect(restored[0].startDate).toBeInstanceOf(Date);

    const indexes = await client.db('t-year-2026-restored').collection('internships').indexes();
    expect(indexes.find((i) => i.key.uid === 1)?.unique).toBe(true);
  });

  it('refuses to decrypt with the wrong passphrase', async () => {
    const backup = await createBackup(client, DBS);
    const encrypted = serializeBackup(backup, 'right passphrase here');
    expect(() => deserializeBackup(encrypted, 'wrong passphrase here')).toThrow();
  });

  it('reads an unencrypted backup when no passphrase was used', async () => {
    const backup = await createBackup(client, DBS);
    const plain = serializeBackup(backup, null);
    expect(deserializeBackup(plain, null).meta.counts).toEqual(backup.meta.counts);
  });

  it('refuses to restore over non-empty collections, and writes nothing', async () => {
    const backup = await createBackup(client, DBS);
    await client.db('t-common').collection('users').insertOne({ username: 'someone-new' });

    await expect(restoreBackup(client, backup, {})).rejects.toThrow(/not empty/);
    // Nothing was written anywhere, including databases that were empty.
    expect(await client.db('t-common').collection('users').countDocuments()).toBe(2);
  });

  it('replaces existing data only when drop is explicitly requested', async () => {
    const backup = await createBackup(client, DBS);
    await client.db('t-year-2026').collection('internships').deleteMany({});
    await client.db('t-year-2026').collection('internships').insertOne({ uid: 'WRONG' });

    await restoreBackup(client, backup, { drop: true });

    const uids = (await client.db('t-year-2026').collection('internships').find().toArray()).map((d) => d.uid).sort();
    expect(uids).toEqual(['A1', 'B2']);
  });
});
