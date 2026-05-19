const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  isAssigned: { type: Boolean, default: false },
}, {
  timestamps: true
});

const getMentorModel = (conn) => conn.models.Mentor || conn.model('Mentor', mentorSchema);

module.exports = {
  mentorSchema,
  getMentorModel,
};
