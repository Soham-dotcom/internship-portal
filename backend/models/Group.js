const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  externalMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' },
  internalMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalMentor' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Internship' }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Group', groupSchema);
