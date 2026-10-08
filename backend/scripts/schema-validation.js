/**
 * Database-level validation for student records (see backend/db/validators.js).
 *
 *   npm run schema-validation            read-only: count records that break the rules
 *   npm run schema-validation -- --apply switch the rules on in every year database
 *
 * Applying needs a database user with the collMod privilege (e.g. Atlas
 * "dbAdmin"), which the app's own user should not have. Run the check first:
 * existing violations do not block applying (validationLevel "moderate"), but they
 * are worth fixing.
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { parseYears } = require('../config/years');
const { listPortalDatabases } = require('../utils/backup');
const { countViolations, applyValidator } = require('../db/validators');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apply = process.argv.includes('--apply');

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');
  await mongoose.connect(uri);
  const client = mongoose.connection.getClient();

  const yearPrefix = process.env.YEAR_DB_PREFIX || 'spit-internships-';
  const dbNames = (await listPortalDatabases(client, {
    sharedDb: process.env.SHARED_DB_NAME || 'spit-common',
    yearPrefix,
    years: parseYears(),
  })).filter((name) => name.startsWith(yearPrefix));

  for (const name of dbNames) {
    const db = client.db(name);
    const exists = (await db.listCollections({ name: 'internships' }).toArray()).length > 0;
    if (!exists) {
      console.log(`${name}: no internships collection yet, skipped`);
      continue;
    }
    const violations = await countViolations(db, 'internships');
    console.log(`${name}: ${violations} existing record(s) break the rules`);
    if (apply) {
      await applyValidator(db, 'internships');
      console.log(`${name}: rules applied`);
    }
  }
  if (!apply) console.log('\nRead-only check. Re-run with --apply to switch the rules on.');
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('FAILED:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
