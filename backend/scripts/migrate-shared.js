const mongoose = require('mongoose');
const { connectToMongo } = require('../db/connection');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

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
    const targetDbName = process.env.SHARED_DB_NAME || 'spit-common';
    const targetDb = mongoose.connection.useDb(targetDbName, { useCache: true });

    const collections = ['users', 'senderemails'];

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
      console.log(`Copied ${docs.length} docs to ${targetDbName}.${name}`);
    }

    console.log('Shared migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Shared migration failed:', error.message);
    process.exit(1);
  }
};

run();
