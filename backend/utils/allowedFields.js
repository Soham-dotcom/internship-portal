/**
 * Field whitelists for writes to Internship documents.
 *
 * Every write path previously passed the raw request body straight to Mongoose
 * (`$set: record`, `findByIdAndUpdate(id, req.body)`). That let any caller set any
 * field — including a student's evaluation marks — through a generic record edit
 * or a bulk spreadsheet import.
 *
 * The rule enforced here: marks are only writable through the dedicated
 * /api/upload/evaluation/* endpoints, and group assignment is only writable by the
 * group-allocation logic. Neither can be reached through an import or a record edit.
 */

/** Student and internship details that a coordinator may edit or import. */
const STUDENT_FIELDS = [
  'email',
  'name',
  'branch',
  'phone',
  'gender',
  'internshipType',
  'companyName',
  'externalMentorName',
  'profile',
  'startDate',
  'endDate',
  'documentLink',
  'companyLocation',
  'internshipTitle',
  'duration',
  'remarks',
  'stipend',
  'ctc',
  'placementOffer',
  'submittedAt',
];

/**
 * Bulk import may additionally set `uid` (it is the upsert key) and the derived
 * `standardized_company_name`, which the import route computes server-side.
 */
const IMPORT_FIELDS = [...STUDENT_FIELDS, 'uid', 'standardized_company_name'];

/** A record edit may never change the UID — it is the document's identity. */
const UPDATE_FIELDS = [...STUDENT_FIELDS];

/** Creating a record requires a UID. */
const CREATE_FIELDS = [...STUDENT_FIELDS, 'uid'];

/**
 * Fields deliberately excluded from every list above, documented so the reason
 * survives: written only by /api/upload/evaluation/* and the group allocator.
 */
const PROTECTED_FIELDS = [
  'meeting_attended',
  'weekly_reports_completed',
  'final_report_submitted',
  'external_marks',
  'viva_marks',
  'external_viva_marks',
  'internal_viva_marks',
  'weekly_report_data',
  'assignedGroup',
  'assignedGroupName',
];

/**
 * Returns a new object containing only the permitted keys.
 * Keys absent from the input stay absent, so partial updates still work.
 */
const pickAllowed = (source, allowed) => {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
};

/** Names of any protected fields the caller tried to set — used for audit detail. */
const rejectedFields = (source) => {
  if (!source || typeof source !== 'object') return [];
  return PROTECTED_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(source, key));
};

module.exports = {
  STUDENT_FIELDS,
  IMPORT_FIELDS,
  UPDATE_FIELDS,
  CREATE_FIELDS,
  PROTECTED_FIELDS,
  pickAllowed,
  rejectedFields,
};
