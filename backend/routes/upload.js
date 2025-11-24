const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Internship = require('../models/Internship');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

    // Map Excel data to Internship schema
    const internships = data.map(row => ({
      email: row['Email'] || row['email'] || '',
      name: row['Name'] || row['name'] || '',
      uid: row['UID'] || row['uid'] || '',
      branch: row['Branch'] || row['branch'] || '',
      internshipType: row['Internship Type'] || row['internshipType'] || 'Off-Campus',
      companyName: row['Company Name'] || row['companyName'] || '',
      externalMentorName: row['External Mentor Name'] || row['externalMentorName'] || '',
      startDate: row['Start Date'] || row['startDate'] || new Date(),
      endDate: row['End Date'] || row['endDate'] || new Date(),
      documentLink: row['Document Link'] || row['documentLink'] || '',
      status: row['Status'] || row['status'] || 'pending',
      stipend: row['Stipend'] || row['stipend'] || '',
      companyLocation: row['Company Location'] || row['companyLocation'] || '',
      internshipTitle: row['Internship Title'] || row['internshipTitle'] || '',
      remarks: row['Remarks'] || row['remarks'] || '',
      submittedAt: row['Submitted At'] || new Date()
    }));

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

// POST import parsed data to MongoDB with UPSERT logic
router.post('/import', async (req, res) => {
  try {
    const { internships } = req.body;
    
    if (!internships || !Array.isArray(internships)) {
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
        failedCount++;
        errors.push(`UID ${record.uid}: ${error.message}`);
      }
    }

    const totalProcessed = insertedCount + updatedCount;
    
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
        'Stipend': '15000',
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

module.exports = router;

