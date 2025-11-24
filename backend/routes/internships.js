const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');

// GET all internships with filters
router.get('/', async (req, res) => {
  try {
    const {
      branch,
      company,
      status,
      mentor,
      type,
      startDate,
      endDate,
      uid,
      name
    } = req.query;

    let query = {};

    if (branch) query['branch'] = new RegExp(`^${branch}$`, 'i'); // case-insensitive exact match
    if (company) query['companyName'] = new RegExp(company, 'i');
    if (status) query['status'] = new RegExp(`^${status}$`, 'i'); // case-insensitive exact match
    if (mentor) query['externalMentorName'] = new RegExp(mentor, 'i');
    if (type) query['internshipType'] = new RegExp(`^${type}$`, 'i'); // case-insensitive exact match
    if (uid) query['uid'] = new RegExp(uid, 'i');
    if (name) query['name'] = new RegExp(name, 'i');
    
    if (startDate || endDate) {
      query['startDate'] = {};
      if (startDate) query['startDate']['$gte'] = new Date(startDate);
      if (endDate) query['startDate']['$lte'] = new Date(endDate);
    }

    const internships = await Internship.find(query).sort({ submittedAt: -1 });
    res.json({ success: true, data: internships, count: internships.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single internship by ID
router.get('/:id', async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    res.json({ success: true, data: internship });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new internship
router.post('/', async (req, res) => {
  try {
    const internship = new Internship(req.body);
    await internship.save();
    res.status(201).json({ success: true, data: internship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update internship
router.put('/:id', async (req, res) => {
  try {
    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      req.body,
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

// DELETE internship
router.delete('/:id', async (req, res) => {
  try {
    const internship = await Internship.findByIdAndDelete(req.params.id);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    res.json({ success: true, message: 'Internship deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET summary statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalStudents = await Internship.distinct('email').then(emails => emails.length);
    const totalCompanies = await Internship.distinct('companyName').then(companies => companies.length);
    const completedInternships = await Internship.countDocuments({ 'status': 'completed' });
    const pendingApprovals = await Internship.countDocuments({ 'status': 'pending' });
    
    const branchWiseCount = await Internship.aggregate([
      { $group: { _id: '$branch', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalStudents,
        totalCompanies,
        completedInternships,
        pendingApprovals,
        branchWiseCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

