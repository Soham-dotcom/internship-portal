/**
 * List users and change their role, year access, or status.
 *
 *   node backend/scripts/manage-users.js list
 *   node backend/scripts/manage-users.js set-role <username> <admin|staff>
 *   node backend/scripts/manage-users.js set-years <username> <2025,2026|all>
 *   node backend/scripts/manage-users.js set-status <username> <active|disabled>
 *
 * Until a user-management screen exists, this is the supported way to administer
 * accounts. Every change here takes effect on the user's NEXT sign-in, because the
 * role and year list are baked into the JWT when it is issued.
 */
const path = require('path');
const dotenv = require('dotenv');
const { connectToMongo, getSharedDb } = require('../db/connection');
const { getUserModel, ROLES } = require('../models/User');
const { parseYears } = require('../config/years');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const usage = () => {
  console.log(`
Usage:
  node backend/scripts/manage-users.js list
  node backend/scripts/manage-users.js set-role   <username> <admin|staff>
  node backend/scripts/manage-users.js set-years  <username> <2025,2026|all>
  node backend/scripts/manage-users.js set-status <username> <active|disabled>

Roles:
  admin  full access, including destructive bulk operations, evaluation weights
         and mail sender credentials
  staff  day-to-day work: imports, records, groups, mentor allocation, mail
         sending, evaluation imports, analytics, exports
`);
};

const run = async () => {
  const [command, username, value] = process.argv.slice(2);

  if (!command) {
    usage();
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }

  await connectToMongo(process.env.MONGODB_URI);
  const User = getUserModel(getSharedDb());

  if (command === 'list') {
    const users = await User.find().select('username role status allowedYears lastLoginAt lockUntil').sort({ username: 1 });
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      console.log('');
      console.log('USERNAME'.padEnd(22), 'ROLE'.padEnd(7), 'STATUS'.padEnd(9), 'YEARS'.padEnd(16), 'LAST LOGIN');
      console.log('-'.repeat(86));
      for (const u of users) {
        const years = (u.allowedYears && u.allowedYears.length) ? u.allowedYears.join(',') : 'all';
        const last = u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 16).replace('T', ' ') : 'never';
        const locked = u.lockUntil && u.lockUntil > new Date() ? ' [LOCKED]' : '';
        console.log(
          String(u.username).padEnd(22),
          String(u.role).padEnd(7),
          String(u.status).padEnd(9),
          years.padEnd(16),
          last + locked
        );
      }
      console.log('');
    }
    process.exit(0);
  }

  if (!username || !value) {
    usage();
    process.exit(1);
  }

  const user = await User.findOne({ username });
  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }

  if (command === 'set-role') {
    if (!ROLES.includes(value)) {
      console.error(`Role must be one of: ${ROLES.join(', ')}`);
      process.exit(1);
    }
    // Refuse to remove the last administrator — otherwise nobody can restore access.
    if (user.role === 'admin' && value !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (adminCount <= 1) {
        console.error('Refusing to demote the only active administrator. Promote another user first.');
        process.exit(1);
      }
    }
    user.role = value;
    await user.save();
    console.log(`"${username}" is now: ${value}`);
  } else if (command === 'set-years') {
    const configured = parseYears();
    if (value === 'all') {
      user.allowedYears = [];
    } else {
      const requested = value.split(',').map((y) => y.trim()).filter(Boolean);
      const unknown = requested.filter((y) => !configured.includes(y));
      if (unknown.length > 0) {
        console.error(`Not configured in ACADEMIC_YEARS: ${unknown.join(', ')}`);
        console.error(`Configured years: ${configured.join(', ')}`);
        process.exit(1);
      }
      user.allowedYears = requested;
    }
    await user.save();
    console.log(`"${username}" year access: ${user.allowedYears.length ? user.allowedYears.join(', ') : 'all'}`);
  } else if (command === 'set-status') {
    if (!['active', 'disabled'].includes(value)) {
      console.error('Status must be "active" or "disabled".');
      process.exit(1);
    }
    if (user.role === 'admin' && value === 'disabled') {
      const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (adminCount <= 1) {
        console.error('Refusing to disable the only active administrator.');
        process.exit(1);
      }
    }
    user.status = value;
    if (value === 'active') {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }
    await user.save();
    console.log(`"${username}" status: ${value}`);
  } else {
    usage();
    process.exit(1);
  }

  // Role, status and years are re-read from the database on every request.
  console.log('Takes effect immediately, on their very next request.');
  process.exit(0);
};

run().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
