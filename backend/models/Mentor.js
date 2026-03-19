const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  isAssigned: { type: Boolean, default: false },
}, {
  timestamps: true
});

module.exports = mongoose.model('Mentor', mentorSchema);
