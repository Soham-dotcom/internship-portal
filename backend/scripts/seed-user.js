const bcrypt = require('bcryptjs');
const { connectToMongo, getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const USERNAME = process.env.SEED_USERNAME || 'spit-admin';
const PASSWORD = process.env.SEED_PASSWORD || 'Spit@2026!';

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    await connectToMongo(process.env.MONGODB_URI);
    const sharedDb = getSharedDb();
    const User = getUserModel(sharedDb);

    const exists = await User.findOne({ username: USERNAME });
    if (exists) {
      console.log('User already exists:', USERNAME);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await User.create({ username: USERNAME, passwordHash, role: 'admin' });

    console.log('Created user');
    console.log('Username:', USERNAME);
    console.log('Password:', PASSWORD);
    process.exit(0);
  } catch (error) {
    console.error('Seed user failed:', error.message);
    process.exit(1);
  }
};

run();
