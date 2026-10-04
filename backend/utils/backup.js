/**
 * Whole-database backup and restore for the portal.
 *
 * Atlas's free tier (M0) has no automated backups, so this is the safety net.
 * A backup is one gzipped Extended-JSON file holding every collection (documents
 * and index definitions) of every portal database. Extended JSON keeps BSON types
 * exact: ObjectIds stay ObjectIds and Dates stay Dates after a restore.
 *
 * With a passphrase the file is encrypted with AES-256-GCM, so a leaked backup
 * file reveals nothing about students.
 *
 * Everything is held in memory. That is fine for this portal (a few MB per year);
 * past roughly 200 MB, switch to mongodump/mongorestore.
 */
const crypto = require('crypto');
const zlib = require('zlib');
const { EJSON } = require('mongoose').mongo.BSON;

const FORMAT_VERSION = 1;
const MAGIC_ENCRYPTED = Buffer.from('SPITBAK1');

/** Database names this deployment uses: the shared DB plus one per academic year. */
const listPortalDatabases = async (client, { sharedDb, yearPrefix, years }) => {
  const configured = [sharedDb, ...years.map((year) => `${yearPrefix}${year}`)];
  try {
    // Also pick up years that exist in Atlas but were removed from ACADEMIC_YEARS.
    const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
    const found = databases.map((d) => d.name).filter((name) => name === sharedDb || name.startsWith(yearPrefix));
    return [...new Set([...configured, ...found])].sort();
  } catch (error) {
    // The database user may not be allowed to list databases; fall back to config.
    return configured.sort();
  }
};

const createBackup = async (client, dbNames) => {
  const databases = {};
  const counts = {};

  for (const dbName of dbNames) {
    const db = client.db(dbName);
    const collections = await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
    databases[dbName] = {};

    for (const { name } of collections) {
      if (name.startsWith('system.')) continue;
      const collection = db.collection(name);
      const [documents, indexes] = await Promise.all([collection.find({}).toArray(), collection.indexes()]);
      databases[dbName][name] = { documents, indexes };
      counts[`${dbName}.${name}`] = documents.length;
    }
  }

  return {
    meta: { formatVersion: FORMAT_VERSION, createdAt: new Date().toISOString(), counts },
    databases,
  };
};

const deriveKey = (passphrase, salt) => crypto.scryptSync(String(passphrase), salt, 32);

/** Backup object → bytes. Gzipped, then encrypted when a passphrase is given. */
const serializeBackup = (backup, passphrase) => {
  // Data keeps exact BSON types (canonical EJSON); metadata stays plain JSON.
  const payload = JSON.stringify({ meta: backup.meta, databases: EJSON.serialize(backup.databases, { relaxed: false }) });
  const gz = zlib.gzipSync(Buffer.from(payload, 'utf8'));
  if (!passphrase) return gz;

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(gz), cipher.final()]);
  // Layout: MAGIC | salt(16) | iv(12) | authTag(16) | ciphertext
  return Buffer.concat([MAGIC_ENCRYPTED, salt, iv, cipher.getAuthTag(), body]);
};

/** Bytes → backup object. Throws on a wrong passphrase or a tampered file. */
const deserializeBackup = (buffer, passphrase) => {
  let gz = buffer;

  if (buffer.subarray(0, MAGIC_ENCRYPTED.length).equals(MAGIC_ENCRYPTED)) {
    if (!passphrase) throw new Error('This backup is encrypted. Set BACKUP_PASSPHRASE.');
    let offset = MAGIC_ENCRYPTED.length;
    const salt = buffer.subarray(offset, offset += 16);
    const iv = buffer.subarray(offset, offset += 12);
    const tag = buffer.subarray(offset, offset += 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    try {
      gz = Buffer.concat([decipher.update(buffer.subarray(offset)), decipher.final()]);
    } catch (error) {
      throw new Error('Could not decrypt the backup: wrong passphrase or the file is damaged.');
    }
  }

  const raw = JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
  if (raw?.meta?.formatVersion !== FORMAT_VERSION) {
    throw new Error('Unrecognised backup format.');
  }
  return { meta: raw.meta, databases: EJSON.deserialize(raw.databases, { relaxed: false }) };
};

/**
 * Restores a backup.
 *
 *   suffix  write into "<db><suffix>" instead of the original name, e.g. to inspect
 *           a backup next to live data without touching it.
 *   drop    replace collections that already contain data. Without it, the restore
 *           checks EVERY target first and aborts before writing anything if any
 *           target collection is non-empty, so it can never half-merge into live data.
 */
const restoreBackup = async (client, backup, { suffix = '', drop = false } = {}) => {
  const plan = [];
  for (const [dbName, collections] of Object.entries(backup.databases)) {
    for (const [name, content] of Object.entries(collections)) {
      plan.push({ dbName: `${dbName}${suffix}`, name, ...content });
    }
  }

  if (!drop) {
    for (const { dbName, name } of plan) {
      const existing = await client.db(dbName).collection(name).estimatedDocumentCount();
      if (existing > 0) {
        throw new Error(`Refusing to restore: ${dbName}.${name} is not empty (${existing} documents). Use a suffix, or drop.`);
      }
    }
  }

  const restored = {};
  for (const { dbName, name, documents, indexes } of plan) {
    const collection = client.db(dbName).collection(name);
    if (drop) await collection.deleteMany({});

    // Recreate indexes first so unique constraints are enforced on the restored data.
    for (const { key, name: indexName, v, ns, ...options } of indexes || []) {
      if (indexName === '_id_') continue;
      await collection.createIndex(key, { name: indexName, ...options });
    }

    if (documents.length > 0) await collection.insertMany(documents, { ordered: true });
    restored[`${dbName}.${name}`] = documents.length;
  }

  return restored;
};

module.exports = {
  listPortalDatabases,
  createBackup,
  serializeBackup,
  deserializeBackup,
  restoreBackup,
};
