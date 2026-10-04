const { planMarksImport, MARKS_IMPORTS } = require('../utils/marksImport');

const rows = (...list) => list;

describe('planMarksImport', () => {
  const viva = MARKS_IMPORTS['external-viva-marks'];
  const meeting = MARKS_IMPORTS['meeting-attendance'];

  it('plans one update per valid row', () => {
    const plan = planMarksImport(rows({ UID: 'A1', 'External Viva Marks': 32 }, { UID: 'B2', marks: '28' }), viva);
    expect(plan.invalid).toEqual([]);
    expect(plan.updates).toEqual([
      { uid: 'A1', value: 32 },
      { uid: 'B2', value: 28 },
    ]);
  });

  it('keeps decimal marks instead of truncating them', () => {
    // The old importer used parseInt, which silently turned 32.5 into 32.
    const plan = planMarksImport(rows({ uid: 'A1', external_viva_marks: '32.5' }), viva);
    expect(plan.updates).toEqual([{ uid: 'A1', value: 32.5 }]);
  });

  it('flags out-of-range marks as invalid', () => {
    const plan = planMarksImport(rows({ uid: 'A1', external_viva_marks: 41 }, { uid: 'B2', external_viva_marks: -1 }), viva);
    expect(plan.updates).toEqual([]);
    expect(plan.invalid).toHaveLength(2);
    expect(plan.invalid[0]).toMatch(/A1/);
  });

  it('flags text that is not a number as invalid', () => {
    const plan = planMarksImport(rows({ uid: 'A1', external_viva_marks: 'absent' }), viva);
    expect(plan.invalid[0]).toMatch(/A1/);
  });

  it('skips blank mark cells without treating them as errors', () => {
    const plan = planMarksImport(rows({ uid: 'A1', external_viva_marks: '' }), viva);
    expect(plan.updates).toEqual([]);
    expect(plan.invalid).toEqual([]);
    expect(plan.blank).toEqual(['A1']);
  });

  it('reports rows with no UID', () => {
    const plan = planMarksImport(rows({ uid: '', external_viva_marks: 30 }), viva);
    expect(plan.missingUid).toEqual([1]);
  });

  it('accepts yes/no style values for attendance', () => {
    const plan = planMarksImport(rows({ uid: 'A1', meeting: 'Yes' }, { uid: 'B2', meeting_attended: 0 }), meeting);
    expect(plan.updates).toEqual([{ uid: 'A1', value: 1 }, { uid: 'B2', value: 0 }]);
  });

  it('flags attendance values that are neither yes nor no', () => {
    const plan = planMarksImport(rows({ uid: 'A1', meeting: 'maybe' }), meeting);
    expect(plan.invalid[0]).toMatch(/A1/);
  });

  it('flags a UID that appears twice with different values', () => {
    const plan = planMarksImport(rows({ uid: 'A1', external_viva_marks: 30 }, { uid: 'A1', external_viva_marks: 35 }), viva);
    expect(plan.invalid[0]).toMatch(/A1.*more than once/);
  });

  it('trims UIDs', () => {
    const plan = planMarksImport(rows({ uid: '  A1 ', external_viva_marks: 30 }), viva);
    expect(plan.updates[0].uid).toBe('A1');
  });

  it('defines all five single-field imports', () => {
    expect(Object.keys(MARKS_IMPORTS).sort()).toEqual([
      'external-marks',
      'external-viva-marks',
      'final-report',
      'internal-viva-marks',
      'meeting-attendance',
    ]);
  });
});
