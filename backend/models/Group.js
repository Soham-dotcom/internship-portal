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

/**
 * Groups reference students and mentors, and routes .populate() those references.
 * Populate needs the referenced models registered on the same connection, so they
 * are registered together here. Otherwise the first request after a restart
 * (every deploy and every Render cold start) failed with MissingSchemaError when it
 * happened to be a page that never touched those models itself, e.g. the
 * evaluator directory.
 */
const getGroupModel = (conn) => {
  // Required lazily to keep the model files free of load-order coupling.
  require('./Internship').getInternshipModel(conn);
  require('./Mentor').getMentorModel(conn);
  require('./InternalMentor').getInternalMentorModel(conn);
  return conn.models.Group || conn.model('Group', groupSchema);
};

module.exports = {
  groupSchema,
  getGroupModel,
};
