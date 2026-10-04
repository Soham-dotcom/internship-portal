/**
 * Restores a backup made by backup.js.
 *
 *   RESTORE_MONGODB_URI="<target>" BACKUP_PASSPHRASE="..." \
 *     node backend/scripts/restore.js <backup-file> [--suffix -restored] [--drop]
 *
 * Safety rules:
 * - The target comes from RESTORE_MONGODB_URI, never MONGODB_URI, so the live
 *   database is never the target by accident.
 * - Without --drop, it checks every target collection first and aborts before
 *   writing anything if any of them already holds data.
 * - --drop (replace existing data) additionally requires
 *   I_UNDERSTAND_THIS_DELETES_DATA=yes.
 *
 * The usual way to recover: restore with --suffix into new databases, inspect them,
 * then copy back only what was lost. See docs/RUNBOOK.md.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { deserializeBackup, restoreBackup } = require('../utils/backup');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--suffix');
const suffixIndex = args.indexOf('--suffix');
const suffix = suffixIndex >= 0 ? args[suffixIndex + 1] || '' : '';
const drop = args.includes('--drop');

const run = async () => {
  const uri = process.env.RESTORE_MONGODB_URI;
  if (!uri) throw new Error('Set RESTORE_MONGODB_URI to the database you want to restore INTO.');
  if (!file) throw new Error('Usage: node backend/scripts/restore.js <backup-file> [--suffix -restored] [--drop]');
  if (drop && process.env.I_UNDERSTAND_THIS_DELETES_DATA !== 'yes') {
    throw new Error('--drop replaces existing data. Re-run with I_UNDERSTAND_THIS_DELETES_DATA=yes if that is really intended.');
  }

  const backup = deserializeBackup(fs.readFileSync(path.resolve(file)), process.env.BACKUP_PASSPHRASE || null);
  console.log(`Backup taken at ${backup.meta.createdAt}`);

  await mongoose.connect(uri);
  const restored = await restoreBackup(mongoose.connection.getClient(), backup, { suffix, drop });
  Object.entries(restored).forEach(([name, count]) => console.log(`  restored ${name}: ${count}`));
  console.log('Restore complete.');
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Restore FAILED:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
