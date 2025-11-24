const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  // Student Information
  email: { type: String, default: '' },
  name: { type: String, default: '' },
  uid: { type: String, required: true, unique: true }, // UID is UNIQUE PRIMARY KEY
  branch: { 
    type: String, 
    default: '',
    enum: ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX', '']
  },
  
  // Internship Details
  internshipType: { 
    type: String, 
    default: '',
    enum: ['Off-Campus', 'On-Campus', 'College-Arranged', 'Self-Arranged', '']
  },
  companyName: { type: String, default: '' },
  externalMentorName: { type: String, default: '' },
  
  // Dates
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  
  // Document
  documentLink: { type: String, default: '' },
  
  // Additional fields for management
  status: {
    type: String,
    enum: ['pending', 'approved', 'in-progress', 'completed', 'rejected', ''],
    default: 'pending'
  },
  
  // Optional fields for backward compatibility
  stipend: { type: String, default: '' },
  salary: { type: Number, default: 0 }, // Numeric salary for analytics
  companyLocation: { type: String, default: '' },
  internshipTitle: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // Duration in months
  remarks: { type: String, default: '' },
  
  // Group Assignment Tracking
  assignedGroup: { type: String, default: null }, // Group ID if assigned to a group
  assignedGroupName: { type: String, default: null }, // Group name for display
  
  submittedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create unique index on UID
internshipSchema.index({ uid: 1 }, { unique: true });

module.exports = mongoose.model('Internship', internshipSchema);

