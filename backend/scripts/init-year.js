const mongoose = require('mongoose');
const { connectToMongo } = require('../db/connection');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const YEAR = process.argv[2];

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }
    if (!YEAR) {
      throw new Error('YEAR argument required');
    }

    await connectToMongo(process.env.MONGODB_URI);

    const dbName = `${process.env.YEAR_DB_PREFIX || 'spit-internships-'}${YEAR}`;
    const db = mongoose.connection.useDb(dbName, { useCache: true });

    const collections = [
      'evaluationsettings',
      'groups',
      'internalmentors',
      'internships',
      'maildrafts',
      'mentors',
      'weeklyreports',
    ];

    for (const name of collections) {
      await db.createCollection(name);
      await db.collection(name).deleteMany({});
      console.log(`Initialized ${dbName}.${name}`);
    }

    console.log('Year DB initialized');
    process.exit(0);
  } catch (error) {
    console.error('Init year DB failed:', error.message);
    process.exit(1);
  }
};

run();
