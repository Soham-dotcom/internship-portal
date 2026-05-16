const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getMentorModel } = require('../models/Mentor');
const { getInternalMentorModel } = require('../models/InternalMentor');
const { getGroupModel } = require('../models/Group');
const { normalizeCompanyName } = require('../utils/companyNormalization');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

const parseBooleanInt = (value) => {
  const cleaned = String(value ?? '').trim().toLowerCase();
  if (cleaned === '') return null;
  if (['1', 'true', 'yes', 'y'].includes(cleaned)) return 1;
  if (['0', 'false', 'no', 'n'].includes(cleaned)) return 0;
  return null;
};

const hasAnyColumn = (headers, options) => options.some((key) => headers.has(normalizeKey(key)));

const getModels = (req) => {
  const db = getYearDb(req.year);
  return {
    Internship: getInternshipModel(db),
    Mentor: getMentorModel(db),
    InternalMentor: getInternalMentorModel(db),
    Group: getGroupModel(db),
  };
};

// POST upload Excel file
router.post('/excel', upload.single('file'), async (req, res) => {
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

// POST evaluation: meeting attendance
router.post('/evaluation/meeting-attendance', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

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
    if (!hasAnyColumn(headers, ['meeting_attended', 'meeting attended', 'meeting'])) {
      return res.status(400).json({
        success: false,
        message: 'Missing required column: meeting_attended'
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

      const value = row['meeting_attended'] ?? row['meeting attended'] ?? row['meeting'] ?? '';
      const meeting_attended = parseBooleanInt(value);
      if (meeting_attended === null) {
        skipped += 1;
        errors.push(`UID ${uid}: Invalid meeting_attended value`);
        continue;
      }

      const result = await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { meeting_attended } }
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
      } else {
        updated += 1;
      }
    }

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST evaluation: weekly reports (merge)
router.post('/evaluation/weekly-reports', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

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

// POST evaluation: final report
router.post('/evaluation/final-report', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

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
    if (!hasAnyColumn(headers, ['final_report', 'final report', 'final_report_submitted'])) {
      return res.status(400).json({
        success: false,
        message: 'Missing required column: final_report'
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

      const value = row['final_report'] ?? row['final report'] ?? row['final_report_submitted'] ?? '';
      const final_report_submitted = parseBooleanInt(value);
      if (final_report_submitted === null) {
        skipped += 1;
        errors.push(`UID ${uid}: Invalid final_report value`);
        continue;
      }

      const result = await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { final_report_submitted } }
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
      } else {
        updated += 1;
      }
    }

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST evaluation: external mentor marks
router.post('/evaluation/external-marks', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

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

      const marks = parseIntSafe(row['marks'] ?? row['external_marks'] ?? row['external marks'] ?? '');
      if (marks === null) {
        skipped += 1;
        errors.push(`UID ${uid}: Invalid marks value`);
        continue;
      }

      const result = await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { external_marks: marks } }
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
      } else {
        updated += 1;
      }
    }

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST evaluation: external viva marks
router.post('/evaluation/external-viva-marks', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const rows = parseExcelBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const headers = getHeaderSet(rows);
    const missing = getMissingColumns(headers, ['uid']);
    const hasMarks = hasAnyColumn(headers, [
      'marks',
      'external_viva_marks',
      'external viva marks',
      'external viva',
      'external_viva'
    ]);
    if (missing.length > 0 || !hasMarks) {
      return res.status(400).json({
        success: false,
        message: 'Missing required columns: uid and marks'
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

      const externalMarks = parseIntSafe(
        row['external_viva_marks']
        ?? row['external viva marks']
        ?? row['external viva']
        ?? row['external_viva']
        ?? row['marks']
        ?? ''
      );

      if (externalMarks === null) {
        skipped += 1;
        errors.push(`UID ${uid}: Invalid marks value`);
        continue;
      }

      const result = await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { external_viva_marks: externalMarks } }
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
      } else {
        updated += 1;
      }
    }

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST evaluation: internal viva marks
router.post('/evaluation/internal-viva-marks', upload.single('file'), async (req, res) => {
  try {
    const { Internship } = getModels(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const rows = parseExcelBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const headers = getHeaderSet(rows);
    const missing = getMissingColumns(headers, ['uid']);
    const hasMarks = hasAnyColumn(headers, [
      'marks',
      'internal_viva_marks',
      'internal viva marks',
      'internal viva',
      'internal_viva'
    ]);
    if (missing.length > 0 || !hasMarks) {
      return res.status(400).json({
        success: false,
        message: 'Missing required columns: uid and marks'
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

      const internalMarks = parseIntSafe(
        row['internal_viva_marks']
        ?? row['internal viva marks']
        ?? row['internal viva']
        ?? row['internal_viva']
        ?? row['marks']
        ?? ''
      );

      if (internalMarks === null) {
        skipped += 1;
        errors.push(`UID ${uid}: Invalid marks value`);
        continue;
      }

      const result = await Internship.updateOne(
        { uid: String(uid).trim() },
        { $set: { internal_viva_marks: internalMarks } }
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        errors.push(`UID ${uid}: Not found`);
      } else {
        updated += 1;
      }
    }

    return res.json({
      success: true,
      message: `Processed ${rows.length} rows. ${updated} updated, ${skipped} skipped`,
      total: rows.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST import parsed data to MongoDB with UPSERT logic
router.post('/import', async (req, res) => {
  try {
    const { Internship } = getModels(req);
    const { internships } = req.body;

    console.log('📥 Import request received');
    console.log('📊 Data type:', typeof internships);
    console.log('📊 Is Array:', Array.isArray(internships));
    console.log('📊 Count:', internships?.length || 0);

    if (!internships || !Array.isArray(internships)) {
      console.error('❌ Invalid data format:', typeof internships);
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Process each record individually with UPSERT logic
    for (const record of internships) {
      try {
        if (!record.uid) {
          failedCount++;
          errors.push('Missing UID - record skipped');
          continue;
        }

        const standardized_company_name = normalizeCompanyName(record.companyName || '');
        record.standardized_company_name = standardized_company_name;

        // UPSERT: Update if exists, Insert if new
        const result = await Internship.findOneAndUpdate(
          { uid: record.uid }, // Find by UID
          { $set: record },    // Replace ALL fields with new data
          {
            new: true,         // Return updated document
            upsert: true,      // Insert if doesn't exist
            runValidators: false // Allow empty fields
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
        console.error(`❌ Error processing UID ${record.uid}:`, error.message);
        failedCount++;
        errors.push(`UID ${record.uid}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;

    console.log(`✅ Import complete: ${insertedCount} inserted, ${updatedCount} updated, ${failedCount} failed`);

    res.json({
      success: true,
      message: `Processed ${totalProcessed} of ${internships.length} records. ${insertedCount} new, ${updatedCount} updated${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      inserted: insertedCount,
      updated: updatedCount,
      failed: failedCount,
      total: internships.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Show first 10 errors
    });
  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET download template Excel
router.get('/template', (req, res) => {
  try {
    const template = [
      {
        'Email': 'aaditya.joglek@student.spit.ac.in',
        'Name': 'Aaditya Ramdas Joglek',
        'UID': '2021200044',
        'Branch': 'EXTC',
        'Internship Type': 'Off-Campus',
        'Company Name': 'Pixelwise Technology',
        'External Mentor Name': 'Devashish Patwardhan',
        'Start Date': '2025-01-01',
        'End Date': '2025-06-30',
        'Document Link': 'https://drive.google.com/open?id=1Qs1px7_QP-WM_tblTr9RHDMhCF9R_brd',
        'Status': 'pending',
        'Company Location': 'Mumbai',
        'Internship Title': 'Software Development Intern',
        'Remarks': '',
        'Submitted At': new Date().toISOString()
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
router.post('/mentors', async (req, res) => {
  try {
    const { Mentor } = getModels(req);
    const { mentors } = req.body;

    console.log('📥 Mentor import request received');
    console.log('📊 Count:', mentors?.length || 0);

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
        console.error(`❌ Error processing mentor ${mentorData.email}:`, error.message);
        failedCount++;
        errors.push(`${mentorData.email}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;

    console.log(`✅ Mentor import complete: ${insertedCount} inserted, ${updatedCount} updated, ${failedCount} failed`);

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
    console.error('❌ Mentor import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST import INTERNAL mentors from Excel
router.post('/internal-mentors', async (req, res) => {
  try {
    const { InternalMentor } = getModels(req);
    const { mentors } = req.body;

    console.log('📥 Internal mentor import request received');
    console.log('📊 Count:', mentors?.length || 0);

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
        console.error(`❌ Error processing internal mentor ${mentorData.email}:`, error.message);
        failedCount++;
        errors.push(`${mentorData.email}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;

    console.log(`✅ Internal mentor import complete: ${insertedCount} inserted, ${updatedCount} updated, ${failedCount} failed`);

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
    console.error('❌ Internal mentor import error:', error);
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
        'Email': 'john.doe@example.com'
      },
      {
        'Name': 'Prof. Jane Smith (External)',
        'Email': 'jane.smith@example.com'
      },
      {
        'Name': 'Dr. Ramesh Kumar (External)',
        'Gmail': 'ramesh.kumar@gmail.com'
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
        'Email': 'internal1@college.edu'
      },
      {
        'Name': 'Prof. Internal Mentor 2',
        'Email': 'internal2@college.edu'
      },
      {
        'Name': 'Dr. Internal Mentor 3',
        'Gmail': 'internal3@gmail.com'
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
router.delete('/mentors/:id', async (req, res) => {
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

    res.json({
      success: true,
      message: `Mentor "${mentor.name}" deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE all mentors
router.delete('/mentors', async (req, res) => {
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
router.delete('/internal-mentors/:id', async (req, res) => {
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

    res.json({
      success: true,
      message: `Internal mentor "${mentor.name}" deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE all INTERNAL mentors
router.delete('/internal-mentors', async (req, res) => {
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

