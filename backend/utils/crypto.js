const crypto = require('crypto');

function getEncryptionKey() {
  const secret = process.env.MAIL_CREDENTIALS_SECRET || process.env.ENCRYPTION_SECRET;
  if (!secret) {
    const error = new Error('MAIL_CREDENTIALS_SECRET not configured');
    error.statusCode = 500;
    throw error;
  }

  // Derive a stable 32-byte key.
  return crypto.scryptSync(secret, 'mail-sender-credentials', 32);
}

function encryptString(plainText) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cipherText = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    cipherText: cipherText.toString('base64'),
  };
}

function decryptString(payload) {
  const key = getEncryptionKey();

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const cipherText = Buffer.from(payload.cipherText, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return plain.toString('utf8');
}

module.exports = {
  encryptString,
  decryptString,
};
