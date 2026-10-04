const { validateMarksUpdate, MARK_RULES } = require('../utils/marks');

describe('validateMarksUpdate', () => {
  it('accepts a full valid set of marks', () => {
    const { value, error } = validateMarksUpdate({
      meeting_attended: 1,
      weekly_reports_completed: 6,
      final_report_submitted: 0,
      external_marks: 88,
      external_viva_marks: 32,
      internal_viva_marks: 40,
    });
    expect(error).toBeNull();
    expect(value).toEqual({
      meeting_attended: 1,
      weekly_reports_completed: 6,
      final_report_submitted: 0,
      external_marks: 88,
      external_viva_marks: 32,
      internal_viva_marks: 40,
    });
  });

  it('converts numeric strings from form inputs', () => {
    const { value } = validateMarksUpdate({ external_marks: '75', meeting_attended: '1' });
    expect(value).toEqual({ external_marks: 75, meeting_attended: 1 });
  });

  it('treats empty and missing fields as "leave unchanged"', () => {
    const { value, error } = validateMarksUpdate({ external_marks: '', internal_viva_marks: 20 });
    expect(error).toBeNull();
    expect(value).toEqual({ internal_viva_marks: 20 });
  });

  it('keeps a real zero (it is a mark, not "missing")', () => {
    const { value } = validateMarksUpdate({ external_marks: 0 });
    expect(value).toEqual({ external_marks: 0 });
  });

  it.each([
    ['external_marks', 101],
    ['external_marks', -1],
    ['external_viva_marks', 41],
    ['internal_viva_marks', -5],
    ['meeting_attended', 2],
    ['final_report_submitted', 0.5],
    ['weekly_reports_completed', 53],
    ['weekly_reports_completed', 2.5],
    ['external_marks', 'abc'],
  ])('rejects %s = %p', (field, input) => {
    const { error } = validateMarksUpdate({ [field]: input });
    expect(error).toMatch(field);
  });

  it('ignores fields that are not marks, so this route cannot edit anything else', () => {
    const { value } = validateMarksUpdate({ external_marks: 50, name: 'Hacker', uid: 'X', assignedGroup: 'g' });
    expect(value).toEqual({ external_marks: 50 });
  });

  it('rejects a request containing no marks at all', () => {
    expect(validateMarksUpdate({ name: 'x' }).error).toBeTruthy();
    expect(validateMarksUpdate(null).error).toBeTruthy();
  });

  it('documents a rule for every mark field', () => {
    expect(Object.keys(MARK_RULES).sort()).toEqual([
      'external_marks',
      'external_viva_marks',
      'final_report_submitted',
      'internal_viva_marks',
      'meeting_attended',
      'weekly_reports_completed',
    ]);
  });
});
