/**
 * Backs up every portal database to one (optionally encrypted) file.
 *
 *   npm run backup
 *   BACKUP_PASSPHRASE="..." node backend/scripts/backup.js [--out <dir>] [--require-encryption]
 *
 * Read-only: this script never writes to the database.
 * See docs/RUNBOOK.md for the nightly GitHub Action and how to restore.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { parseYears } = require('../config/years');
const { listPortalDatabases, createBackup, serializeBackup } = require('../utils/backup');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  const passphrase = process.env.BACKUP_PASSPHRASE || '';
  if (args.includes('--require-encryption') && passphrase.length < 16) {
    throw new Error('BACKUP_PASSPHRASE must be set (16+ characters) when --require-encryption is used.');
  }

  const outDir = path.resolve(argValue('--out', path.resolve(__dirname, '../../backups')));
  fs.mkdirSync(outDir, { recursive: true });

  await mongoose.connect(uri);
  const client = mongoose.connection.getClient();

  const dbNames = await listPortalDatabases(client, {
    sharedDb: process.env.SHARED_DB_NAME || 'spit-common',
    yearPrefix: process.env.YEAR_DB_PREFIX || 'spit-internships-',
    years: parseYears(),
  });

  const backup = await createBackup(client, dbNames);
  const stamp = backup.meta.createdAt.replace(/[:.]/g, '-');
  const file = path.join(outDir, `portal-backup-${stamp}.json.gz${passphrase ? '.enc' : ''}`);
  fs.writeFileSync(file, serializeBackup(backup, passphrase || null));

  const total = Object.values(backup.meta.counts).reduce((a, b) => a + b, 0);
  console.log(`Backed up ${dbNames.length} databases, ${total} documents.`);
  Object.entries(backup.meta.counts).forEach(([name, count]) => console.log(`  ${name}: ${count}`));
  console.log(`Wrote ${file}${passphrase ? ' (encrypted)' : ' (NOT encrypted: keep this file private)'}`);
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Backup FAILED:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
