const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  externalMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
  internalMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalMentor' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Internship' }],

  // Mail status tracking
  mailSent: { type: Boolean, default: false },
  mailSentAt: { type: Date, default: null }
}, {
  timestamps: true
});

const getGroupModel = (conn) => conn.models.Group || conn.model('Group', groupSchema);

module.exports = {
  groupSchema,
  getGroupModel,
};
