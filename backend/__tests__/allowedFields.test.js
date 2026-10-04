/**
 * Tests for write-path field whitelisting.
 *
 * The rule these protect: evaluation marks are writable ONLY through the dedicated
 * /api/upload/evaluation/* endpoints, and group assignment ONLY through the group
 * allocator. Neither may be reached via a record edit or a spreadsheet import.
 */
const {
  pickAllowed,
  rejectedFields,
  IMPORT_FIELDS,
  UPDATE_FIELDS,
  CREATE_FIELDS,
  PROTECTED_FIELDS,
} = require('../utils/allowedFields');

describe('pickAllowed', () => {
  it('keeps whitelisted fields', () => {
    const out = pickAllowed({ name: 'Asha', companyName: 'Infosys' }, UPDATE_FIELDS);
    expect(out).toEqual({ name: 'Asha', companyName: 'Infosys' });
  });

  it('omits keys that are absent, so partial updates still work', () => {
    const out = pickAllowed({ name: 'Asha' }, UPDATE_FIELDS);
    expect(Object.prototype.hasOwnProperty.call(out, 'companyName')).toBe(false);
  });

  it('preserves falsy values that were explicitly provided', () => {
    const out = pickAllowed({ remarks: '', duration: 0 }, UPDATE_FIELDS);
    expect(out).toEqual({ remarks: '', duration: 0 });
  });

  it('returns an empty object for non-object input', () => {
    expect(pickAllowed(null, UPDATE_FIELDS)).toEqual({});
    expect(pickAllowed('nope', UPDATE_FIELDS)).toEqual({});
  });
});

describe('evaluation marks cannot be set through generic write paths', () => {
  const marksPayload = {
    name: 'Asha',
    external_marks: 100,
    external_viva_marks: 100,
    internal_viva_marks: 100,
    meeting_attended: 1,
    final_report_submitted: 1,
    weekly_reports_completed: 8,
    weekly_report_data: { week1: 'forged' },
  };

  it.each([
    ['record update', UPDATE_FIELDS],
    ['record create', CREATE_FIELDS],
    ['bulk import', IMPORT_FIELDS],
  ])('strips every mark field on %s', (_label, allowed) => {
    const out = pickAllowed(marksPayload, allowed);
    expect(out.name).toBe('Asha');
    for (const field of [
      'external_marks',
      'external_viva_marks',
      'internal_viva_marks',
      'meeting_attended',
      'final_report_submitted',
      'weekly_reports_completed',
      'weekly_report_data',
    ]) {
      expect(out).not.toHaveProperty(field);
    }
  });
});

describe('group assignment cannot be set through generic write paths', () => {
  it.each([
    ['record update', UPDATE_FIELDS],
    ['bulk import', IMPORT_FIELDS],
  ])('strips assignedGroup on %s', (_label, allowed) => {
    const out = pickAllowed({ name: 'Asha', assignedGroup: 'g1', assignedGroupName: 'Group 1' }, allowed);
    expect(out).not.toHaveProperty('assignedGroup');
    expect(out).not.toHaveProperty('assignedGroupName');
  });
});

describe('uid handling', () => {
  it('allows uid on create and import, since it is the identity/upsert key', () => {
    expect(pickAllowed({ uid: '2021200044' }, CREATE_FIELDS)).toEqual({ uid: '2021200044' });
    expect(pickAllowed({ uid: '2021200044' }, IMPORT_FIELDS)).toEqual({ uid: '2021200044' });
  });

  it('blocks uid on update, so a record cannot be re-pointed at another student', () => {
    expect(pickAllowed({ uid: '9999999999', name: 'Asha' }, UPDATE_FIELDS)).toEqual({ name: 'Asha' });
  });
});

describe('rejectedFields', () => {
  it('names the protected fields a caller attempted to set', () => {
    const found = rejectedFields({ name: 'Asha', external_marks: 50, assignedGroup: 'g1' });
    expect(found).toEqual(expect.arrayContaining(['external_marks', 'assignedGroup']));
    expect(found).not.toContain('name');
  });

  it('returns an empty list for a clean payload', () => {
    expect(rejectedFields({ name: 'Asha', branch: 'COMPS' })).toEqual([]);
  });

  it('covers every protected field', () => {
    const payload = Object.fromEntries(PROTECTED_FIELDS.map((f) => [f, 1]));
    expect(rejectedFields(payload).sort()).toEqual([...PROTECTED_FIELDS].sort());
  });
});
