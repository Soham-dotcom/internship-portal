const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  // Student Information
  email: { type: String, default: '' },
  name: { type: String, default: '' },
  uid: { type: String, required: true, unique: true }, // UID is UNIQUE PRIMARY KEY
  branch: { 
    type: String, 
    default: '',
    enum: ['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX', 'CSE - AIML', 'CSE - DS', '']
  },
  phone: { type: String, default: '' },
  gender: { 
    type: String, 
    default: '',
    enum: ['Male', 'Female', 'Other', '']
  },
  
  // Internship Details
  internshipType: { 
    type: String, 
    default: '',
    enum: ['Off-Campus', 'On-Campus', 'College-Arranged', 'Self-Arranged', '8th Sem', '']
  },
  companyName: { type: String, default: '' },
  externalMentorName: { type: String, default: '' },
  profile: { 
    type: String, 
    default: '',
    enum: ['Tech', 'Non Tech', 'tech', 'non tech', '']
  },
  
  // Dates
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  
  // Document
  documentLink: { type: String, default: '' },
  
  // Optional fields for backward compatibility
  companyLocation: { type: String, default: '' },
  internshipTitle: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // Duration in months
  remarks: { type: String, default: '' },
  
  // Additional fields from placement data
  stipend: { type: String, default: '' },
  ctc: { type: String, default: '' },
  placementOffer: { type: String, default: '' },
  
  // Group Assignment Tracking
  assignedGroup: { type: String, default: null }, // Group ID if assigned to a group
  assignedGroupName: { type: String, default: null }, // Group name for display

  // Performance and Attendance
  performanceMetrics: {
    communication: { type: Number, min: 1, max: 5, default: null },
    technicalSkills: { type: Number, min: 1, max: 5, default: null },
    teamwork: { type: Number, min: 1, max: 5, default: null },
    problemSolving: { type: Number, min: 1, max: 5, default: null },
    overall: { type: Number, min: 1, max: 5, default: null },
  },
  attendance: [{
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], required: true }
  }],
  
  submittedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create unique index on UID
internshipSchema.index({ uid: 1 }, { unique: true });

module.exports = mongoose.model('Internship', internshipSchema);

