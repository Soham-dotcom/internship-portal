const mongoose = require('mongoose');

const internalMentorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  isAssigned: { type: Boolean, default: false },
}, {
  timestamps: true
});

const getInternalMentorModel = (conn) => conn.models.InternalMentor || conn.model('InternalMentor', internalMentorSchema);

module.exports = {
  internalMentorSchema,
  getInternalMentorModel,
};
