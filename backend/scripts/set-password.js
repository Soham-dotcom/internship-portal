/**
 * Rotate an existing user's password.
 *
 *   NEW_PASSWORD="<strong password>" node backend/scripts/set-password.js <username>
 *
 * Run this immediately if the account was ever created with the old hard-coded
 * seed default, which was committed to this repository.
 */
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');
const { connectToMongo, getSharedDb } = require('../db/connection');
const { getUserModel } = require('../models/User');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const username = process.argv[2];
const newPassword = process.env.NEW_PASSWORD;

if (!username || !newPassword) {
  console.error('Usage: NEW_PASSWORD="<strong password>" node backend/scripts/set-password.js <username>');
  process.exit(1);
}

if (newPassword.length < 12) {
  console.error('NEW_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');

    await connectToMongo(process.env.MONGODB_URI);
    const User = getUserModel(getSharedDb());

    const user = await User.findOne({ username });
    if (!user) {
      console.error(`No user found with username "${username}".`);
      process.exit(1);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    // Clear any legacy plaintext password and reset lockout counters.
    user.password = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    console.log(`Password updated for "${username}".`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to set password:', error.message);
    process.exit(1);
  }
};

run();
