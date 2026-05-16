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

    await sourceDb.dropDatabase();
    console.log(`Dropped database: ${sourceDbName}`);
    process.exit(0);
  } catch (error) {
    console.error('Drop DB failed:', error.message);
    process.exit(1);
  }
};

run();
