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
const PASSWORD = process.env.SEED_PASSWORD;
const ROLE = process.env.SEED_ROLE || 'admin';

// This previously defaulted to a hard-coded password that is committed to the repo.
// Anyone who ran the seed without setting SEED_PASSWORD got a publicly-known
// administrator credential, so the default is gone and the script now refuses to run.
if (!PASSWORD) {
  console.error('SEED_PASSWORD is required.');
  console.error('');
  console.error('  SEED_PASSWORD="<a strong password>" node backend/scripts/seed-user.js');
  console.error('');
  console.error('Optional: SEED_USERNAME (default "spit-admin"), SEED_ROLE ("admin" or "staff").');
  process.exit(1);
}

if (PASSWORD.length < 12) {
  console.error('SEED_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

if (!['admin', 'staff'].includes(ROLE)) {
  console.error(`SEED_ROLE must be "admin" or "staff" (received "${ROLE}").`);
  process.exit(1);
}

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

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await User.create({ username: USERNAME, passwordHash, role: ROLE });

    // The password is deliberately not printed — it would end up in shell history
    // and in CI/deploy logs.
    console.log('Created user');
    console.log('Username:', USERNAME);
    console.log('Role:', ROLE);
    process.exit(0);
  } catch (error) {
    console.error('Seed user failed:', error.message);
    process.exit(1);
  }
};

run();
