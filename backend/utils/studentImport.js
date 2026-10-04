/**
 * Plans a student-records import before anything is written.
 *
 * Pure: give it the incoming rows plus what is already stored, and it classifies
 * every row as new / changed (with field-level before → after) / unchanged /
 * in the Recycle Bin / error. The route shows this as a preview, and applies the
 * very same plan when the coordinator confirms.
 *
 * Rules that protect existing data:
 * - A field is only compared or written if the row actually has it. A column missing
 *   from the sheet, or a blank cell, never erases what is stored.
 * - In "add-only" mode (the default) existing students are never modified; their
 *   differences are only reported.
 * - Marks and group assignment cannot be set here at all (see allowedFields.js).
 */
const { pickAllowed, rejectedFields, IMPORT_FIELDS } = require('./allowedFields');

// Derived or bookkeeping fields: written, but not worth showing as a "change".
const NOT_DIFFED = new Set(['uid', 'standardized_company_name']);

const normalize = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return String(value).trim();
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

/** Drops keys whose value is blank, so blanks can never overwrite stored data. */
const withoutBlanks = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => !isBlank(value))
);

/**
 * @param records   rows from the sheet (already mapped to field names)
 * @param existing  Map uid → stored document (plain object), active students only
 * @param binned    Set of UIDs that are in the Recycle Bin
 * @param cast      record → { values, error }: converts like the database would and
 *                  reports invalid values (bad date, branch not in the list, ...)
 * @param mode      'add-only' | 'update'
 */
const planStudentImport = (records, { existing, binned, cast, mode = 'add-only' }) => {
  const plan = {
    toInsert: [],
    toUpdate: [],
    changedButSkipped: [],
    unchanged: [],
    inRecycleBin: [],
    errors: [],
    ignoredFields: new Set(),
  };

  const seen = new Map();
  (records || []).forEach((record, index) => {
    const row = index + 1;
    const uid = String(record?.uid ?? '').trim();
    if (!uid) {
      plan.errors.push({ row, uid: '', message: 'Missing UID' });
      return;
    }
    if (seen.has(uid)) {
      plan.errors.push({ row, uid, message: `UID also appears on row ${seen.get(uid)}; only the first was used` });
      return;
    }
    seen.set(uid, row);

    rejectedFields(record).forEach((field) => plan.ignoredFields.add(field));

    if (binned.has(uid)) {
      plan.inRecycleBin.push({ row, uid, name: record.name || '' });
      return;
    }

    const safe = withoutBlanks({ ...pickAllowed(record, IMPORT_FIELDS), uid });
    const { values, error } = cast(safe);
    if (error) {
      plan.errors.push({ row, uid, message: error });
      return;
    }

    const current = existing.get(uid);
    if (!current) {
      plan.toInsert.push({ row, uid, name: values.name || '', values });
      return;
    }

    const allDiffs = Object.keys(values)
      .filter((field) => field !== 'uid')
      .filter((field) => normalize(values[field]) !== normalize(current[field]))
      .map((field) => ({ field, from: current[field] ?? null, to: values[field] }));
    // What the coordinator sees. Derived fields (the standardized company name) are
    // still written alongside, so analytics never go stale, but are not shown.
    const visible = allDiffs.filter(({ field }) => !NOT_DIFFED.has(field));

    if (visible.length === 0) {
      plan.unchanged.push({ row, uid });
      return;
    }

    const entry = { row, uid, name: current.name || values.name || '', _id: current._id, diffs: visible, writes: allDiffs, values };
    if (mode === 'update') plan.toUpdate.push(entry);
    else plan.changedButSkipped.push(entry);
  });

  plan.ignoredFields = [...plan.ignoredFields];
  return plan;
};

module.exports = {
  planStudentImport,
  normalize,
};
