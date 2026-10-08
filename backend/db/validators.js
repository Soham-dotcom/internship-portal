/**
 * Database-level rules for student records, enforced by MongoDB itself.
 *
 * The app already validates every write, but these rules also stop writes that
 * bypass the app: a one-off script, an edit in the Atlas web UI, or a future bug.
 * They cover what must never be wrong (identity, marks ranges, allowed values) and
 * deliberately allow extra fields, so adding a field never breaks writes.
 *
 * Applied with validationLevel "moderate": new and currently-valid documents are
 * checked; legacy documents that already break a rule can still be updated, so
 * switching this on can never block work on old data.
 */
const { MARK_RULES } = require('../utils/marks');

const nullable = (bsonType) => ({ bsonType: [bsonType, 'null'] });
const enumOf = (values) => ({ enum: [...values, null] });

// null means "not entered yet" (production has such records), and is allowed;
// anything present must be a number within the component's range.
const markRules = Object.fromEntries(Object.entries(MARK_RULES).map(([field, { min, max }]) => [
  field,
  { bsonType: ['number', 'null'], minimum: min, maximum: max },
]));

const internshipSchema = {
  bsonType: 'object',
  required: ['uid'],
  properties: {
    uid: { bsonType: 'string', minLength: 1 },
    branch: enumOf(['COMPS', 'EXTC', 'CSE', 'MCA', 'AIML', 'IT', 'MECH', 'ETRX', 'CSE - AIML', 'CSE - DS', '']),
    gender: enumOf(['Male', 'Female', 'Other', '']),
    internshipType: enumOf(['Off-Campus', 'On-Campus', 'College-Arranged', 'Self-Arranged', '8th Sem', '']),
    profile: enumOf(['Tech', 'Non Tech', 'tech', 'non tech', '']),
    startDate: nullable('date'),
    endDate: nullable('date'),
    deletedAt: nullable('date'),
    deletedBy: nullable('string'),
    ...markRules,
  },
};

const VALIDATORS = {
  internships: { $jsonSchema: internshipSchema },
};

/** How many existing documents break the rules (read-only). */
const countViolations = async (db, collection) => db.collection(collection)
  .countDocuments({ $nor: [VALIDATORS[collection]] });

/** Switches the rules on for one collection (needs the collMod privilege). */
const applyValidator = (db, collection) => db.command({
  collMod: collection,
  validator: VALIDATORS[collection],
  validationLevel: 'moderate',
  validationAction: 'error',
});

module.exports = {
  VALIDATORS,
  internshipSchema,
  countViolations,
  applyValidator,
};
