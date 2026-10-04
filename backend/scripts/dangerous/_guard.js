/**
 * Guard for scripts that permanently destroy data.
 *
 * These scripts previously sat at the top of backend/ and executed the moment they
 * were invoked — one mistyped `node backend/cleanup.js` against a production
 * MONGODB_URI and the year's records were gone, with no backup step and no prompt.
 *
 * Require this at the top of any destructive script.
 */
const path = require('path');
const dotenv = require('dotenv');

const confirmDestructive = (description) => {
  // Load env here so the warning can name the database about to be modified —
  // the guard runs before the script's own dotenv call.
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  if (!process.env.MONGODB_URI) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  }

  const token = process.env.I_UNDERSTAND_THIS_DELETES_DATA;
  const target = process.env.MONGODB_URI || process.env.MONGO_URI || '';

  // Show which cluster/database is about to be hit, with credentials stripped.
  const safeTarget = target.replace(/\/\/[^@]*@/, '//<credentials>@') || '(no MONGODB_URI set)';

  if (token !== 'yes') {
    console.error('');
    console.error('  REFUSING TO RUN — this script permanently deletes data.');
    console.error('');
    console.error(`  Action : ${description}`);
    console.error(`  Target : ${safeTarget}`);
    console.error('');
    console.error('  Take a backup first, then re-run with:');
    console.error('');
    console.error('    I_UNDERSTAND_THIS_DELETES_DATA=yes node <script>');
    console.error('');
    process.exit(1);
  }

  console.warn('');
  console.warn(`  Running destructive script: ${description}`);
  console.warn(`  Target: ${safeTarget}`);
  console.warn('');
};

module.exports = { confirmDestructive };
