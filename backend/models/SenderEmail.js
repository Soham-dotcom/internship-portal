const mongoose = require('mongoose');

const senderEmailSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordEncrypted: {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    cipherText: { type: String, required: true },
  },
}, {
  timestamps: true,
});

const getSenderEmailModel = (conn) => conn.models.SenderEmail || conn.model('SenderEmail', senderEmailSchema);

module.exports = {
  senderEmailSchema,
  getSenderEmailModel,
};
