const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const { getYearDb, withTransaction } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getImportBatchModel } = require('../models/ImportBatch');
const { getMentorModel } = require('../models/Mentor');
const { getInternalMentorModel } = require('../models/InternalMentor');
const { getGroupModel } = require('../models/Group');
const { normalizeCompanyName } = require('../utils/companyNormalization');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { ensureMarksWritable } = require('../middleware/locks');
const { MARKS_IMPORTS, UID_COLUMNS, planMarksImport } = require('../utils/marksImport');
const { planStudentImport, normalize } = require('../utils/studentImport');
const { redact } = require('../utils/redact');

// Configure multer for file upload.
// Files are held in memory and parsed by SheetJS, so an unbounded upload is a
// direct route to exhausting the server's memory. A spreadsheet of a few thousand
// student rows is well under 5MB.
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/octet-stream', // some browsers send this for .xlsx
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext || 'unknown'}". Upload an .xlsx, .xls or .csv file.`));
    }
    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Unsupported file format. Upload an .xlsx, .xls or .csv file.'));
    }
    return cb(null, true);
  },
});

/**
 * Turns multer's own errors (size limit, rejected type) into clean 400 responses
 * instead of letting them fall through as a 500.
 */
const handleUpload = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. The maximum upload size is 5MB.'
      : err.message || 'File upload failed.';
    return res.status(400).json({ success: false, message });
  });
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const getRowMap = (row) => {
  const mapped = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    mapped[normalizeKey(key)] = value;
  });
  return mapped;
};

const parseExcelBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};

const getHeaderSet = (rows) => new Set(Object.keys(rows?.[0] || {}).map(normalizeKey));

const getMissingColumns = (headers, required) => {
  const missing = [];
  required.forEach((key) => {
    if (!headers.has(normalizeKey(key))) missing.push(key);
  });
  return missing;
};

const parseIntSafe = (value) => {
  const cleaned = String(value ?? '').trim();
  if (cleaned === '') return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const hasAnyColumn = (headers, options) => options.some((key) => headers.has(normalizeKey(key)));

const getModels = (req) => {
  const db = getYearDb(req.year);
  return {
    Internship: getInternshipModel(db),
    Mentor: getMentorModel(db),
    InternalMentor: getInternalMentorModel(db),
    Group: getGroupModel(db),
    ImportBatch: getImportBatchModel(db),
  };
};

// POST upload Excel file
router.post('/excel', handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Map Excel data to Internship schema - Handle multiple formats
    const internships = data.map(row => {
      const companyName = row['8th Sem Internship Offer'] || row['Company Name'] || row['companyName'] || row['Placement Offer'] || '';
      return {
      email: row['Institute Email ID'] || row['Personal Email ID'] || row['Email'] || row['email'] || '',
      name: row['Name'] || row['name'] || '',
      uid: row['UID'] || row['uid'] || '',
      branch: row['Branch'] || row['branch'] || '',
      internshipType: row['Internship Type'] || row['internshipType'] || '8th Sem',
      companyName,
      standardized_company_name: normalizeCompanyName(companyName),
      externalMentorName: row['External Mentor Name'] || row['externalMentorName'] || '',
      startDate: row['Start Date'] || row['startDate'] || new Date(),
      endDate: row['End Date'] || row['endDate'] || new Date(),
      documentLink: row['8th Sem Internship Offer Letter'] || row['Document Link'] || row['documentLink'] || '',
      companyLocation: row['Company Location'] || row['companyLocation'] || '',
      internshipTitle: row['Role'] || row['Internship Title'] || row['internshipTitle'] || row['Profile'] || row['profile'] || '',
      profile: row['Profile'] || row['profile'] || row['Tech/Non-Tech'] || row['Tech Non Tech'] || row['Role Type'] || row['role type'] || '',
      stipend: row['8th Sem Internship Stipend'] || row['Stipend'] || row['stipend'] || '',
      gender: row['Gender'] || row['gender'] || '',
      phone: row['Mobile No.'] || row['Phone'] || row['phone'] || '',
      ctc: row['CTC (LPA)'] || row['CTC'] || row['ctc'] || '',
      placementOffer: row['Placement Offer'] || row['placementOffer'] || '',
      remarks: row['Remarks'] || row['remarks'] || '',
      submittedAt: row['Submitted At'] || new Date()
    };
    });

    res.json({
      success: true,
      message: 'File parsed successfully',
      data: internships,
      count: internships.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST evaluation: the five single-field marks imports
// (meeting attendance, final report, external marks, external viva, internal viva).
//
// All-or-nothing on values: if ANY row holds an invalid mark, the whole file is
// rejected and nothing changes, so a sheet with one typo never half-updates a class.
// UIDs not found in this year are skipped and reported, because evaluation sheets
// often include students from other lists. Every changed mark is audited with its
// old and new value.
Object.entries(MARKS_IMPORTS).forEach(([type, config]) => {
  router.post(
    `/evaluation/${type}`,
    handleUpload('file'),
    audit(`marks-import.${type}`, (req, res) => res.locals.auditDetails || {}),
    async (req, res, next) => {
      try {
        const { Internship } = getModels(req);
        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        if (!(await ensureMarksWritable(req, res, [config.field]))) return undefined;

        const rows = parseExcelBuffer(req.file.buffer);
        if (rows.length === 0) {
          return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        const headers = getHeaderSet(rows);
        if (!hasAnyColumn(headers, UID_COLUMNS) || !hasAnyColumn(headers, config.columns)) {
          return res.status(400).json({
            success: false,
            message: `The sheet needs a UID column and one of these columns: ${config.columns.join(', ')}`,
          });
        }

        const plan = planMarksImport(rows, config);
        if (plan.invalid.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Nothing was imported: ${plan.invalid.length} row(s) have invalid values. Fix them and upload the file again.`,
            errors: plan.invalid.slice(0, 50),
            invalidCount: plan.invalid.length,
          });
        }

        const uids = plan.updates.map((u) => u.uid);
        const existing = await Internship.find({ uid: { $in: uids } }).select(`uid ${config.field}`).lean();
        const current = new Map(existing.map((doc) => [doc.uid, doc[config.field]]));

        const notFound = uids.filter((uid) => !current.has(uid));
        const changes = plan.updates
          .filter((u) => current.has(u.uid) && current.get(u.uid) !== u.value)
          .map((u) => ({ uid: u.uid, from: current.get(u.uid) ?? null, to: u.value }));

        if (changes.length > 0) {
          await Internship.bulkWrite(changes.map((c) => ({
            updateOne: { filter: { uid: c.uid }, update: { $set: { [config.field]: c.to } } },
          })));
        }

        res.locals.auditDetails = {
          field: config.field,
          rows: rows.length,
          changed: changes.length,
          notFound: notFound.length,
          changes,
        };

        const unchanged = plan.updates.length - notFound.length - changes.length;
        const skipped = notFound.length + plan.blank.length + plan.missingUid.length;
        const notes = [
          ...notFound.map((uid) => `UID ${uid}: Not found in this year`),
          ...plan.missingUid.map((row) => `Row ${row}: Missing UID`),
          ...plan.blank.map((uid) => `UID ${uid}: No value in the sheet, left unchanged`),
        ];

        return res.json({
          success: true,
          message: `Processed ${rows.length} rows. ${changes.length} changed, ${unchanged} already up to date, ${skipped} skipped`,
          total: rows.length,
          updated: changes.length + unchanged,
          changed: changes.length,
          unchanged,
          skipped,
          errors: notes.length > 0 ? notes.slice(0, 10) : undefined,
        });
      } catch (error) {
        return next(error);
      }
    }
  );
});


// POST evaluation: weekly reports (merge)
router.post('/evaluation/weekly-reports', handleUpload('file'), audit('marks-import.weekly-reports', (req, res) => ({
  updated: res.locals.weeklyUpdated,
})), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!(await ensureMarksWritable(req, res, ['weekly_reports_completed']))) return undefined;

    const weeks = parseIntSafe(req.body.weeks) || 8;
    const rows = parseExcelBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const headers = getHeaderSet(rows);
    const missing = getMissingColumns(headers, ['uid']);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missing.join(', ')}`
      });
    }
    const hasAnyWeek = Array.from({ length: weeks }, (_, i) => `week${i + 1}`)
      .some((key) => headers.has(normalizeKey(key)));
    if (!hasAnyWeek) {
      return res.status(400).json({
        success: false,
        message: `Missing required week columns (week1..week${weeks})`
      });
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = getRowMap(rows[i]);
      const uid = row['uid'] || row['roll no'] || row['rollno'] || row['student uid'] || '';
      if (!uid) {
        skipped += 1;
        errors.push(`Row ${i + 1}: Missing UID`);
        continue;
      }

      const student = await Internship.findOne({ uid: String(uid).trim() }).select('weekly_report_data');
      if (!student) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
        continue;
      }

      const existing = student.weekly_report_data || {};
      const merged = { ...existing };
      let anyUpdate = false;

      for (let w = 1; w <= weeks; w += 1) {
        const key = `week${w}`;
        const value = row[key] ?? row[`week ${w}`] ?? row[`week_${w}`] ?? '';
        const text = String(value || '').trim();
        if (text) {
          merged[key] = text;
          anyUpdate = true;
        }
      }

      if (!anyUpdate) {
        skipped += 1;
        errors.push(`UID ${uid}: No week data found`);
        continue;
      }

      const completed = Object.values(merged).filter(v => String(v || '').trim()).length;

      await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { weekly_report_data: merged, weekly_reports_completed: completed } }
      );

      updated += 1;
    }

    res.locals.weeklyUpdated = updated;
    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      weeks,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Turns a sheet row into the values the database would store, or explains why it can't.
const castStudent = (Internship) => (record) => {
  const doc = new Internship(record);
  const invalid = doc.validateSync(Object.keys(record));
  if (invalid) {
    const reasons = Object.values(invalid.errors).map((e) => (
      e.kind === 'enum'
        ? `${e.path} "${e.value}" is not one of the allowed values`
        : `${e.path} "${e.value}" is not a valid ${String(e.kind).toLowerCase()}`
    ));
    return { values: null, error: reasons.join('; ') };
  }
  return { values: Object.fromEntries(Object.keys(record).map((key) => [key, doc.get(key)])), error: null };
};

const IMPORT_LIST_LIMIT = 200;
const summarizeRows = (rows) => rows.slice(0, IMPORT_LIST_LIMIT).map(({ row, uid, name, diffs }) => (
  diffs ? { row, uid, name, diffs } : { row, uid, name }
));

// POST import student records
//
//   { internships: [...], mode: 'add-only' | 'update', dryRun: true|false, acceptErrors }
//
// Always preview first (dryRun: true): it reports new students, existing students
// whose details differ (field by field, before → after), unchanged rows, students
// in the Recycle Bin, and rows with errors, without writing anything. Applying
// (dryRun: false) recomputes the same plan and writes it in ONE transaction,
// together with an ImportBatch record that makes the import undoable.
//
// "add-only" (default) never modifies existing students. Blank cells never erase data.
router.post('/import', audit('internships.bulk-import', (req, res) => res.locals.auditDetails || {
  recordCount: Array.isArray(req.body?.internships) ? req.body.internships.length : 0,
}), async (req, res, next) => {
  const { internships, mode = 'add-only', dryRun = false, acceptErrors = false } = req.body || {};

  if (!Array.isArray(internships) || internships.length === 0) {
    return res.status(400).json({ success: false, message: 'No student records were sent.' });
  }
  if (!['add-only', 'update'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'mode must be "add-only" or "update".' });
  }

  // The standardized company name is always derived here, never trusted from the client.
  const records = internships.map((record) => {
    const { standardized_company_name: ignored, ...rest } = record || {};
    return rest.companyName ? { ...rest, standardized_company_name: normalizeCompanyName(rest.companyName) } : rest;
  });
  const uids = [...new Set(records.map((r) => String(r.uid ?? '').trim()).filter(Boolean))];

  const buildPlan = async (session) => {
    const { Internship } = getModels(req);
    const [active, binnedDocs] = await Promise.all([
      Internship.find({ uid: { $in: uids } }).lean().session(session),
      Internship.find({ uid: { $in: uids }, deletedAt: { $ne: null } })
        .setOptions({ withDeleted: true })
        .select('uid')
        .lean()
        .session(session),
    ]);
    return planStudentImport(records, {
      existing: new Map(active.map((doc) => [doc.uid, doc])),
      binned: new Set(binnedDocs.map((doc) => doc.uid)),
      cast: castStudent(Internship),
      mode,
    });
  };

  const summary = (plan) => ({
    total: records.length,
    new: plan.toInsert.length,
    changed: plan.toUpdate.length + plan.changedButSkipped.length,
    willUpdate: plan.toUpdate.length,
    unchanged: plan.unchanged.length,
    inRecycleBin: plan.inRecycleBin.length,
    errors: plan.errors.length,
  });

  try {
    if (dryRun) {
      const plan = await buildPlan(null);
      return res.json({
        success: true,
        dryRun: true,
        mode,
        summary: summary(plan),
        newStudents: summarizeRows(plan.toInsert),
        changedStudents: summarizeRows([...plan.toUpdate, ...plan.changedButSkipped]),
        inRecycleBin: summarizeRows(plan.inRecycleBin),
        errors: plan.errors.slice(0, IMPORT_LIST_LIMIT),
        ignoredFields: plan.ignoredFields,
      });
    }

    const outcome = await withTransaction(async (session) => {
      const { Internship, ImportBatch } = getModels(req);
      const plan = await buildPlan(session);

      if (plan.errors.length > 0 && !acceptErrors) {
        return { plan, refused: true };
      }

      const inserted = plan.toInsert.length > 0
        ? await Internship.insertMany(
          // Same default the import page used to apply for rows without a type.
          plan.toInsert.map(({ values }) => ({ internshipType: '8th Sem', ...values })),
          { session }
        )
        : [];

      if (plan.toUpdate.length > 0) {
        await Internship.bulkWrite(plan.toUpdate.map(({ _id, writes }) => ({
          updateOne: {
            filter: { _id, deletedAt: null },
            update: { $set: Object.fromEntries(writes.map(({ field, to }) => [field, to])) },
          },
        })), { session });
      }

      const counts = {
        inserted: inserted.length,
        updated: plan.toUpdate.length,
        unchanged: plan.unchanged.length,
        skipped: plan.changedButSkipped.length + plan.inRecycleBin.length + plan.errors.length,
      };
      const [batch] = await ImportBatch.create([{
        createdBy: req.user?.username || 'unknown',
        mode,
        insertedIds: inserted.map((doc) => doc._id),
        // Every written field (including derived ones), so undo restores all of them.
        updates: plan.toUpdate.map(({ _id, uid, writes }) => ({ internshipId: _id, uid, diffs: writes })),
        counts,
      }], { session });

      return { plan, batch, counts };
    });

    if (outcome.refused) {
      return res.status(400).json({
        success: false,
        message: `${outcome.plan.errors.length} row(s) have errors. Nothing was imported. Fix the sheet, or confirm that these rows should be skipped.`,
        errors: outcome.plan.errors.slice(0, IMPORT_LIST_LIMIT),
      });
    }

    const { counts, batch, plan } = outcome;
    res.locals.auditDetails = { batchId: String(batch._id), mode, ...counts };

    return res.json({
      success: true,
      message: `Imported: ${counts.inserted} new, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.skipped} skipped.`,
      batchId: batch._id,
      inserted: counts.inserted,
      updated: counts.updated,
      unchanged: counts.unchanged,
      skipped: counts.skipped,
      total: records.length,
      ignoredFields: plan.ignoredFields.length > 0 ? plan.ignoredFields : undefined,
      ignoredFieldsNote: plan.ignoredFields.length > 0
        ? 'These columns were ignored. Evaluation marks can only be set through the Evaluation Marks Import page.'
        : undefined,
    });
  } catch (error) {
    return next(error);
  }
});

// GET the most recent import, so the page can offer "Undo".
router.get('/import/latest', async (req, res, next) => {
  try {
    const { ImportBatch } = getModels(req);
    const batch = await ImportBatch.findOne().sort({ createdAt: -1 }).select('-updates -insertedIds').lean();
    return res.json({ success: true, data: batch || null });
  } catch (error) {
    return next(error);
  }
});

// POST undo an import (only the most recent one)
//
// Students the import created go to the Recycle Bin (so even an undo is reversible).
// Fields it changed are put back to their old values, but ONLY where the value is
// still what the import wrote: if someone edited a field since, their edit is kept
// and reported as a conflict instead of being silently overwritten.
router.post('/import/:batchId/undo', audit('internships.bulk-import-undo', (req, res) => res.locals.auditDetails || {
  batchId: req.params.batchId,
}), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid import id' });
    }

    const outcome = await withTransaction(async (session) => {
      const { Internship, ImportBatch } = getModels(req);
      const latest = await ImportBatch.findOne().sort({ createdAt: -1 }).session(session);
      if (!latest || String(latest._id) !== req.params.batchId) {
        return { error: 'Only the most recent import can be undone.' };
      }
      if (latest.undoneAt) {
        return { error: 'This import has already been undone.' };
      }

      const actor = req.user?.username || 'unknown';
      const removed = await Internship.updateMany(
        { _id: { $in: latest.insertedIds } },
        { $set: { deletedAt: new Date(), deletedBy: `undo import (${actor})` } },
        { session }
      );

      const current = await Internship.find({ _id: { $in: latest.updates.map((u) => u.internshipId) } })
        .lean()
        .session(session);
      const byId = new Map(current.map((doc) => [String(doc._id), doc]));

      let reverted = 0;
      const conflicts = [];
      const ops = [];
      for (const update of latest.updates) {
        const doc = byId.get(String(update.internshipId));
        if (!doc) {
          conflicts.push(`${update.uid}: no longer exists`);
          continue;
        }
        const restore = {};
        for (const { field, from, to } of update.diffs) {
          if (normalize(doc[field]) === normalize(to)) {
            restore[field] = from;
          } else {
            conflicts.push(`${update.uid}: ${field} was edited after the import, kept the newer value`);
          }
        }
        if (Object.keys(restore).length > 0) {
          ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: restore } } });
          reverted += 1;
        }
      }
      if (ops.length > 0) await Internship.bulkWrite(ops, { session });

      latest.undoneAt = new Date();
      latest.undoneBy = actor;
      await latest.save({ session });

      return { removed: removed.modifiedCount, reverted, conflicts };
    });

    if (outcome.error) {
      return res.status(409).json({ success: false, message: outcome.error });
    }

    res.locals.auditDetails = {
      batchId: req.params.batchId,
      removed: outcome.removed,
      reverted: outcome.reverted,
      conflicts: outcome.conflicts.length,
    };
    return res.json({
      success: true,
      message: `Import undone: ${outcome.removed} added student(s) moved to the Recycle Bin, ${outcome.reverted} updated student(s) restored.`,
      conflicts: outcome.conflicts,
    });
  } catch (error) {
    return next(error);
  }
});


// GET download template Excel
router.get('/template', (req, res) => {
  try {
    // Fictional example row. Never put a real student's details in the template:
    // it is downloadable by every user and lives in the repository.
    const template = [
      {
        'Email': 'firstname.lastname@example.com',
        'Name': 'Sample Student',
        'UID': '2026000001',
        'Branch': 'EXTC',
        'Internship Type': 'Off-Campus',
        'Company Name': 'Example Technologies',
        'External Mentor Name': 'Sample Mentor',
        'Start Date': '2026-01-05',
        'End Date': '2026-06-30',
        'Document Link': 'https://example.com/offer-letter.pdf',
        'Company Location': 'Mumbai',
        'Internship Title': 'Software Development Intern',
        'Remarks': '',
      }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Internships');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=internship_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST import mentors from Excel
router.post('/mentors', audit('mentors.import-external', (req) => ({ rows: Array.isArray(req.body?.mentors) ? req.body.mentors.length : 0 })), async (req, res) => {
  try {
    const { Mentor } = getModels(req);
    const { mentors } = req.body;


    if (!mentors || !Array.isArray(mentors)) {
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const mentorData of mentors) {
      try {
        if (!mentorData.name || !mentorData.email) {
          failedCount++;
          errors.push(`Missing name or email - record skipped`);
          continue;
        }

        // UPSERT: Update if exists (by email), Insert if new
        const result = await Mentor.findOneAndUpdate(
          { email: mentorData.email },
          { $set: mentorData },
          {
            new: true,
            upsert: true,
            runValidators: true
          }
        );

        // Check if it was an insert or update
        if (result.createdAt && result.updatedAt &&
          Math.abs(new Date(result.createdAt) - new Date(result.updatedAt)) < 1000) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error('[mentor import] row failed:', redact(error.message));
        failedCount++;
        errors.push(`${mentorData.email}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;


    res.json({
      success: true,
      message: `Processed ${totalProcessed} of ${mentors.length} mentors. ${insertedCount} new, ${updatedCount} updated${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      inserted: insertedCount,
      updated: updatedCount,
      failed: failedCount,
      total: mentors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    console.error('[mentor import] failed:', redact(error.message));
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST import INTERNAL mentors from Excel
router.post('/internal-mentors', audit('mentors.import-internal', (req) => ({ rows: Array.isArray(req.body?.mentors) ? req.body.mentors.length : 0 })), async (req, res) => {
  try {
    const { InternalMentor } = getModels(req);
    const { mentors } = req.body;


    if (!mentors || !Array.isArray(mentors)) {
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const mentorData of mentors) {
      try {
        if (!mentorData.name || !mentorData.email) {
          failedCount++;
          errors.push(`Missing name or email - record skipped`);
          continue;
        }

        // UPSERT: Update if exists (by email), Insert if new
        const result = await InternalMentor.findOneAndUpdate(
          { email: mentorData.email },
          { $set: mentorData },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );

        // Check if it was an insert or update
        const existingCount = await InternalMentor.countDocuments({ email: mentorData.email });
        if (existingCount === 1 && !result.createdAt) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error('[internal mentor import] row failed:', redact(error.message));
        failedCount++;
        errors.push(`${mentorData.email}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;


    res.json({
      success: true,
      message: `Processed ${totalProcessed} of ${mentors.length} internal mentors. ${insertedCount} new, ${updatedCount} updated${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      inserted: insertedCount,
      updated: updatedCount,
      failed: failedCount,
      total: mentors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    console.error('[internal mentor import] failed:', redact(error.message));
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all mentors with assigned groups and student counts
router.get('/mentors-with-details', async (req, res) => {
  try {
    const { Group, Mentor } = getModels(req);
    // Get all mentors
    const mentors = await Mentor.find().sort({ name: 1 });

    // For each mentor, get their assigned groups and student counts
    const mentorsWithDetails = await Promise.all(
      mentors.map(async (mentor) => {
        const assignedGroups = await Group.find({ externalMentor: mentor._id })
          .populate('students', 'name uid');

        const studentsHandled = assignedGroups.reduce((sum, group) =>
          sum + group.students.length, 0
        );

        return {
          _id: mentor._id,
          name: mentor.name,
          email: mentor.email,
          isAssigned: mentor.isAssigned,
          assignedGroups: assignedGroups.map(g => ({
            _id: g._id,
            name: g.name,
            studentCount: g.students.length
          })),
          groupCount: assignedGroups.length,
          studentsHandled,
          type: 'external'
        };
      })
    );

    res.json({
      success: true,
      data: mentorsWithDetails,
      count: mentorsWithDetails.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all INTERNAL mentors with assigned groups and student counts
router.get('/internal-mentors-with-details', async (req, res) => {
  try {
    const { Group, InternalMentor } = getModels(req);
    const mentors = await InternalMentor.find().sort({ name: 1 });

    // For each mentor, get their assigned groups and student counts
    const mentorsWithDetails = await Promise.all(
      mentors.map(async (mentor) => {
        const assignedGroups = await Group.find({ internalMentor: mentor._id })
          .populate('students', 'name uid');

        const studentsHandled = assignedGroups.reduce((sum, group) =>
          sum + group.students.length, 0
        );

        return {
          _id: mentor._id,
          name: mentor.name,
          email: mentor.email,
          isAssigned: mentor.isAssigned,
          assignedGroups: assignedGroups.map(g => ({
            _id: g._id,
            name: g.name,
            studentCount: g.students.length
          })),
          groupCount: assignedGroups.length,
          studentsHandled,
          type: 'internal'
        };
      })
    );

    res.json({
      success: true,
      data: mentorsWithDetails,
      count: mentorsWithDetails.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all mentors
router.get('/mentors', async (req, res) => {
  try {
    const { Mentor } = getModels(req);
    const mentors = await Mentor.find().sort({ name: 1 });
    res.json({
      success: true,
      data: mentors,
      count: mentors.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all INTERNAL mentors
router.get('/internal-mentors', async (req, res) => {
  try {
    const { InternalMentor } = getModels(req);
    const mentors = await InternalMentor.find().sort({ name: 1 });
    res.json({
      success: true,
      data: mentors,
      count: mentors.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET mentor template
router.get('/mentor-template', (req, res) => {
  try {
    const template = [
      {
        'Name': 'Dr. John Doe (External)',
        'Email': 'john.doe@example.com',
        'Phone': '9876543210'
      },
      {
        'Name': 'Prof. Jane Smith (External)',
        'Email': 'jane.smith@example.com',
        'Phone': '9876543211'
      },
      {
        'Name': 'Dr. Ramesh Kumar (External)',
        'Gmail': 'ramesh.kumar@gmail.com',
        'Phone': '9876543212'
      }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();

    // Add a note about column names
    xlsx.utils.book_append_sheet(wb, ws, 'External Mentors');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=external_mentor_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET INTERNAL mentor template
router.get('/internal-mentor-template', (req, res) => {
  try {
    const template = [
      {
        'Name': 'Dr. Internal Mentor 1',
        'Email': 'internal1@college.edu',
        'Phone': '9876543201'
      },
      {
        'Name': 'Prof. Internal Mentor 2',
        'Email': 'internal2@college.edu',
        'Phone': '9876543202'
      },
      {
        'Name': 'Dr. Internal Mentor 3',
        'Gmail': 'internal3@gmail.com',
        'Phone': '9876543203'
      }
    ];

    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();

    // Add a note about column names
    xlsx.utils.book_append_sheet(wb, ws, 'Internal Mentors');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=internal_mentor_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a single mentor by ID
router.delete('/mentors/:id', audit('mentors.delete-external', (req, res) => res.locals.auditDetails || { mentorId: req.params.id }), async (req, res) => {
  try {
    const { Mentor, Group } = getModels(req);
    const mentorId = req.params.id;

    // Check if mentor exists
    const mentor = await Mentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    // Check if mentor is assigned to any groups
    const assignedGroups = await Group.find({ externalMentor: mentorId });

    if (assignedGroups.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete mentor. They are assigned to ${assignedGroups.length} group(s). Please unassign them first.`,
        assignedGroups: assignedGroups.map(g => g.name)
      });
    }

    // Delete the mentor
    await Mentor.findByIdAndDelete(mentorId);
    res.locals.auditDetails = { mentorId, name: mentor.name, email: mentor.email };

    res.json({
      success: true,
      message: `Mentor "${mentor.name}" deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE all mentors — admin only, removes the entire external mentor directory.
router.delete('/mentors', requireRole('admin'), audit('mentors.delete-all-external'), async (req, res) => {
  try {
    const { Mentor, Group } = getModels(req);
    // Check if any mentors are assigned to groups
    const assignedMentors = await Group.find({ externalMentor: { $ne: null } }).populate('externalMentor');

    if (assignedMentors.length > 0) {
      const uniqueMentors = [...new Set(assignedMentors.map(g => g.externalMentor?.name).filter(Boolean))];
      return res.status(400).json({
        success: false,
        message: `Cannot delete all mentors. ${assignedMentors.length} group(s) still have assigned mentors. Please unassign all groups first.`,
        assignedMentorNames: uniqueMentors
      });
    }

    // Delete all mentors
    const result = await Mentor.deleteMany({});

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} mentor(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a single INTERNAL mentor by ID
router.delete('/internal-mentors/:id', audit('mentors.delete-internal', (req, res) => res.locals.auditDetails || { mentorId: req.params.id }), async (req, res) => {
  try {
    const { InternalMentor, Group } = getModels(req);
    const mentorId = req.params.id;

    // Check if mentor exists
    const mentor = await InternalMentor.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Internal mentor not found'
      });
    }

    // Check if mentor is assigned to any groups
    const assignedGroups = await Group.find({ internalMentor: mentorId });

    if (assignedGroups.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete internal mentor. They are assigned to ${assignedGroups.length} group(s). Please unassign them first.`,
        assignedGroups: assignedGroups.map(g => g.name)
      });
    }

    // Delete the mentor
    await InternalMentor.findByIdAndDelete(mentorId);
    res.locals.auditDetails = { mentorId, name: mentor.name, email: mentor.email };

    res.json({
      success: true,
      message: `Internal mentor "${mentor.name}" deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE all INTERNAL mentors — admin only, removes the entire internal mentor directory.
router.delete('/internal-mentors', requireRole('admin'), audit('mentors.delete-all-internal'), async (req, res) => {
  try {
    const { InternalMentor, Group } = getModels(req);
    // Check if any mentors are assigned to groups
    const assignedMentors = await Group.find({ internalMentor: { $ne: null } }).populate('internalMentor');

    if (assignedMentors.length > 0) {
      const uniqueMentors = [...new Set(assignedMentors.map(g => g.internalMentor?.name).filter(Boolean))];
      return res.status(400).json({
        success: false,
        message: `Cannot delete all internal mentors. ${assignedMentors.length} group(s) still have assigned internal mentors. Please unassign all groups first.`,
        assignedMentorNames: uniqueMentors
      });
    }

    // Delete all internal mentors
    const result = await InternalMentor.deleteMany({});

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} internal mentor(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

