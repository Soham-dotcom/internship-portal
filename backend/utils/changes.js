/**
 * Field-level change list for the audit log: [{ field, from, to }] for every field
 * whose value actually changed. Dates, numbers and strings are compared by value.
 */
const { normalize } = require('./studentImport');

const diffFields = (before, after, fields) => fields
  .filter((field) => normalize(before?.[field]) !== normalize(after?.[field]))
  .map((field) => ({ field, from: before?.[field] ?? null, to: after?.[field] ?? null }));

/**
 * Updates one student's allowed fields and returns the stored document plus the
 * exact changes, for the audit log. Returns null if the student does not exist
 * (or is in the Recycle Bin).
 */
const updateStudentWithChanges = async (Internship, id, updates) => {
  const fields = Object.keys(updates);
  const before = await Internship.findById(id).select(['uid', ...fields].join(' ')).lean();
  if (!before) return null;

  const doc = await Internship.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
  if (!doc) return null;

  return { doc, uid: before.uid, changes: diffFields(before, doc.toObject(), fields) };
};

module.exports = {
  diffFields,
  updateStudentWithChanges,
};
