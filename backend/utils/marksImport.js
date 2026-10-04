/**
 * Planning for the single-field marks imports (attendance, final report, external
 * marks, both vivas).
 *
 * Pure function: it turns spreadsheet rows into a list of updates plus a list of
 * problems, without touching the database. The route then applies the plan only if
 * there are no invalid values, so a sheet with one typo changes nothing instead of
 * half the class.
 */
const { MARK_RULES } = require('./marks');

const UID_COLUMNS = ['uid', 'roll no', 'rollno', 'student uid'];

// `??` not `||`: a numeric 0 from Excel is a real value ("did not attend"), not blank.
const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const parseYesNo = (raw) => {
  const cleaned = normalizeKey(raw);
  if (['1', 'true', 'yes', 'y'].includes(cleaned)) return 1;
  if (['0', 'false', 'no', 'n'].includes(cleaned)) return 0;
  return NaN;
};

const parseNumber = (raw) => Number(String(raw).trim());

/** Column aliases are listed most-specific first; the generic "marks" column comes last. */
const MARKS_IMPORTS = {
  'meeting-attendance': {
    field: 'meeting_attended',
    columns: ['meeting_attended', 'meeting attended', 'meeting'],
    parse: parseYesNo,
  },
  'final-report': {
    field: 'final_report_submitted',
    columns: ['final_report_submitted', 'final_report', 'final report'],
    parse: parseYesNo,
  },
  'external-marks': {
    field: 'external_marks',
    columns: ['external_marks', 'external marks', 'marks'],
    parse: parseNumber,
  },
  'external-viva-marks': {
    field: 'external_viva_marks',
    columns: ['external_viva_marks', 'external viva marks', 'external viva', 'external_viva', 'marks'],
    parse: parseNumber,
  },
  'internal-viva-marks': {
    field: 'internal_viva_marks',
    columns: ['internal_viva_marks', 'internal viva marks', 'internal viva', 'internal_viva', 'marks'],
    parse: parseNumber,
  },
};

const firstPresent = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
};

const planMarksImport = (rows, { field, columns, parse }) => {
  const { min, max, integer } = MARK_RULES[field];
  const byUid = new Map();
  const invalid = [];
  const blank = [];
  const missingUid = [];

  rows.forEach((original, index) => {
    const row = {};
    Object.entries(original || {}).forEach(([key, value]) => { row[normalizeKey(key)] = value; });

    const uid = String(firstPresent(row, UID_COLUMNS) ?? '').trim();
    if (!uid) {
      missingUid.push(index + 1);
      return;
    }

    const raw = firstPresent(row, columns);
    if (raw === undefined || String(raw).trim() === '') {
      blank.push(uid);
      return;
    }

    const value = parse(raw);
    const inRange = Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
    if (!inRange) {
      invalid.push(`UID ${uid}: "${raw}" is not a valid ${field} (allowed ${min} to ${max}).`);
      return;
    }

    if (byUid.has(uid) && byUid.get(uid) !== value) {
      invalid.push(`UID ${uid} appears more than once with different values (${byUid.get(uid)} and ${value}).`);
      return;
    }
    byUid.set(uid, value);
  });

  return {
    updates: [...byUid].map(([uid, value]) => ({ uid, value })),
    invalid,
    blank,
    missingUid,
  };
};

module.exports = {
  MARKS_IMPORTS,
  UID_COLUMNS,
  planMarksImport,
};
