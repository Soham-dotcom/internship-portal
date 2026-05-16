const { connectToMongo } = require('../db/connection');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const YEAR = process.argv[2] || '2025';

const getDbNameFromUri = (uri) => {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace('/', '');
    return dbName || null;
  } catch (error) {
    return null;
  }
};

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    await connectToMongo(process.env.MONGODB_URI);
    const sourceDbName = getDbNameFromUri(process.env.MONGODB_URI) || 'spit-internships';
    const sourceDb = mongoose.connection.useDb(sourceDbName, { useCache: true });
    const targetDb = mongoose.connection.useDb(`spit-internships-${YEAR}`, { useCache: true });

    const collections = [
      'evaluationsettings',
      'groups',
      'internalmentors',
      'internships',
      'maildrafts',
      'mentors',
      'weeklyreports'
    ];

    for (const name of collections) {
      const sourceCollection = sourceDb.collection(name);
      const targetCollection = targetDb.collection(name);
      const docs = await sourceCollection.find({}).toArray();
      if (docs.length === 0) {
        console.log(`Skipping ${name}: no documents`);
        continue;
      }
      await targetCollection.deleteMany({});
      await targetCollection.insertMany(docs);
      console.log(`Copied ${docs.length} docs to ${name}`);
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
};

run();
