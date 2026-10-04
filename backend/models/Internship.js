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
  standardized_company_name: { type: String, default: '' },
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

  // Evaluation Matrix (safe extensions)
  meeting_attended: { type: Number, default: 0 },
  weekly_reports_completed: { type: Number, default: 0 },
  final_report_submitted: { type: Number, default: 0 },
  external_marks: { type: Number, default: 0 },
  viva_marks: { type: Number, default: 0 },
  external_viva_marks: { type: Number, default: 0 },
  internal_viva_marks: { type: Number, default: 0 },
  weekly_report_data: { type: mongoose.Schema.Types.Mixed, default: {} },

  submittedAt: { type: Date, default: Date.now },

  // Soft delete. A "deleted" student is only hidden: set here, cleared on restore.
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
}, {
  timestamps: true
});

// Create unique index on UID
internshipSchema.index({ uid: 1 }, { unique: true });
internshipSchema.index({ standardized_company_name: 1 });

/**
 * Soft delete, enforced in one place.
 *
 * Every read and update through this model skips students in the Recycle Bin,
 * so no route can show, count, export or edit them by forgetting a filter.
 * Code that genuinely needs them (the Recycle Bin itself) opts in with
 * `.setOptions({ withDeleted: true })`.
 *
 * Deliberately NOT applied to delete operations: a hard delete is always explicit.
 * Not applied to bulkWrite or estimatedDocumentCount either (Mongoose has no hook
 * for them); callers of bulkWrite select their targets with a filtered find first.
 */
const NOT_DELETED = { deletedAt: null }; // also matches documents that predate the field

function excludeDeleted() {
  if (this.getOptions().withDeleted) return;
  if (Object.prototype.hasOwnProperty.call(this.getFilter(), 'deletedAt')) return;
  this.where(NOT_DELETED);
}

internshipSchema.pre(
  ['find', 'findOne', 'countDocuments', 'distinct', 'findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'],
  excludeDeleted
);

internshipSchema.pre('aggregate', function excludeDeletedFromAggregate() {
  if (this.options.withDeleted) return;
  this.pipeline().unshift({ $match: NOT_DELETED });
});

const getInternshipModel = (conn) => conn.models.Internship || conn.model('Internship', internshipSchema);

module.exports = {
  internshipSchema,
  getInternshipModel,
};

