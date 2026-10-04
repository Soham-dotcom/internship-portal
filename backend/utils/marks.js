/**
 * Rules for a student's evaluation marks.
 *
 * The maxima match how EvaluationOverview converts marks to percentages:
 * external marks are already out of 100, both vivas are out of 40, and meeting
 * attendance / final report are yes-no (1 / 0).
 */
const MARK_RULES = {
  meeting_attended: { min: 0, max: 1, integer: true },
  weekly_reports_completed: { min: 0, max: 52, integer: true },
  final_report_submitted: { min: 0, max: 1, integer: true },
  external_marks: { min: 0, max: 100, integer: false },
  external_viva_marks: { min: 0, max: 40, integer: false },
  internal_viva_marks: { min: 0, max: 40, integer: false },
};

const MARK_FIELDS = Object.keys(MARK_RULES);

/**
 * Validates a partial marks update. Returns { value, error }; exactly one is null.
 *
 * Empty or missing fields mean "leave unchanged". Any field outside its range
 * rejects the whole update, so a typo never half-saves.
 */
const validateMarksUpdate = (body) => {
  if (!body || typeof body !== 'object') {
    return { value: null, error: 'No marks provided.' };
  }

  const value = {};
  for (const field of MARK_FIELDS) {
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') continue;

    const { min, max, integer } = MARK_RULES[field];
    const num = Number(raw);
    const wholeOk = !integer || Number.isInteger(num);
    if (!Number.isFinite(num) || num < min || num > max || !wholeOk) {
      const kind = integer ? 'a whole number' : 'a number';
      return { value: null, error: `${field} must be ${kind} from ${min} to ${max} (received "${raw}").` };
    }
    value[field] = num;
  }

  if (Object.keys(value).length === 0) {
    return { value: null, error: 'No marks provided.' };
  }

  return { value, error: null };
};

module.exports = {
  MARK_RULES,
  MARK_FIELDS,
  validateMarksUpdate,
};
