const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { containsRegex } = require('../utils/escapeRegex');
const { audit } = require('../middleware/audit');
const { pickAllowed, UPDATE_FIELDS } = require('../utils/allowedFields');

// GET mentor's interns
router.get('/internships', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const { mentorName } = req.query;
    
    let query = {};
    const mentorMatch = containsRegex(mentorName);
    if (mentorMatch) {
      query['externalMentorName'] = mentorMatch;
    }

    const internships = await Internship.find(query);
    res.json({ success: true, data: internships, count: internships.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update internship by mentor
router.put('/:id', audit('internships.update', (req) => ({ internshipId: req.params.id })), async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    // Whitelisted: cannot change UID, evaluation marks, or group assignment.
    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      { $set: pickAllowed(req.body, UPDATE_FIELDS) },
      { new: true, runValidators: true }
    );
    
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    
    res.json({ success: true, data: internship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update performance metrics
router.put('/:id/performance', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const { performanceMetrics } = req.body;
    
    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      { performanceMetrics },
      { new: true, runValidators: true }
    );
    
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    
    res.json({ success: true, data: internship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST add attendance record
router.post('/:id/attendance', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const { date, status } = req.body;
    
    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          attendance: { date: new Date(date), status }
        }
      },
      { new: true }
    );
    
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    
    res.json({ success: true, data: internship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

