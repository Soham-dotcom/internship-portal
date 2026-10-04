const { planStudentImport } = require('../utils/studentImport');

// Minimal stand-in for Mongoose casting: dates become Date, "bad" branch is an error.
const cast = (record) => {
  if (record.branch === 'NOPE') return { values: null, error: 'branch "NOPE" is not allowed' };
  const values = { ...record };
  if (values.startDate) values.startDate = new Date(values.startDate);
  return { values, error: null };
};

const existing = new Map([
  ['A1', { _id: 'id-a1', uid: 'A1', name: 'Asha', companyName: 'Acme', remarks: 'keep me', startDate: new Date('2026-01-05') }],
]);
const plan = (records, extra = {}) => planStudentImport(records, { existing, binned: new Set(['Z9']), cast, ...extra });

describe('planStudentImport', () => {
  it('classifies new, unchanged and changed rows', () => {
    const p = plan([
      { uid: 'N1', name: 'New Person' },
      { uid: 'A1', name: 'Asha', companyName: 'Acme' },
    ]);
    expect(p.toInsert.map((r) => r.uid)).toEqual(['N1']);
    expect(p.unchanged.map((r) => r.uid)).toEqual(['A1']);
  });

  it('add-only mode (default) reports changes but never applies them', () => {
    const p = plan([{ uid: 'A1', companyName: 'Globex' }]);
    expect(p.toUpdate).toEqual([]);
    expect(p.changedButSkipped[0].diffs).toEqual([{ field: 'companyName', from: 'Acme', to: 'Globex' }]);
  });

  it('update mode applies field-level changes', () => {
    const p = plan([{ uid: 'A1', companyName: 'Globex' }], { mode: 'update' });
    expect(p.toUpdate[0].diffs).toEqual([{ field: 'companyName', from: 'Acme', to: 'Globex' }]);
  });

  it('blank cells and missing columns never erase stored data', () => {
    const p = plan([{ uid: 'A1', remarks: '', name: '   ' }], { mode: 'update' });
    expect(p.toUpdate).toEqual([]);
    expect(p.unchanged.map((r) => r.uid)).toEqual(['A1']);
  });

  it('compares dates by value, not by object identity', () => {
    const p = plan([{ uid: 'A1', startDate: '2026-01-05T00:00:00.000Z' }], { mode: 'update' });
    expect(p.unchanged.map((r) => r.uid)).toEqual(['A1']);
  });

  it('never lets an import set marks or group fields, and reports the attempt', () => {
    const p = plan([{ uid: 'N2', name: 'X', external_marks: 100, assignedGroup: 'g' }]);
    expect(p.toInsert[0].values.external_marks).toBeUndefined();
    expect(p.toInsert[0].values.assignedGroup).toBeUndefined();
    expect(p.ignoredFields.sort()).toEqual(['assignedGroup', 'external_marks']);
  });

  it('reports students that are in the Recycle Bin instead of touching them', () => {
    const p = plan([{ uid: 'Z9', name: 'Binned' }]);
    expect(p.inRecycleBin.map((r) => r.uid)).toEqual(['Z9']);
    expect(p.toInsert).toEqual([]);
  });

  it('reports missing UIDs, duplicate UIDs and invalid values as errors', () => {
    const p = plan([
      { uid: '', name: 'No id' },
      { uid: 'N3', name: 'First' },
      { uid: 'N3', name: 'Second' },
      { uid: 'N4', branch: 'NOPE' },
    ]);
    expect(p.errors.map((e) => e.row)).toEqual([1, 3, 4]);
    expect(p.toInsert.map((r) => r.name)).toEqual(['First']);
  });
});
