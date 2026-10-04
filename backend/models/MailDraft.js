const mongoose = require('mongoose');

const mailDraftSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  // Optional evaluation link (Google Sheets/Docs) that can be injected into emails
  evaluationLink: { type: String, required: false, default: '' },
}, {
  timestamps: true,
});

const getMailDraftModel = (conn) => conn.models.MailDraft || conn.model('MailDraft', mailDraftSchema);

module.exports = {
  mailDraftSchema,
  getMailDraftModel,
};
