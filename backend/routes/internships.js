const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');

// GET all internships with filters
router.get('/', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const {
      branch,
      company,
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

// GET weekly report data (viewer)
router.get('/weekly-reports', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const weeks = Number.parseInt(req.query.weeks, 10) || 8;
    const students = await Internship.find({}, {
      name: 1,
      uid: 1,
      weekly_report_data: 1,
      weekly_reports_completed: 1
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: students,
      weeks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET evaluation overview data with internal mentor name
router.get('/evaluation-overview', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const rows = await Internship.aggregate([
      {
        $lookup: {
          from: 'groups',
          localField: 'assignedGroupName',
          foreignField: 'name',
          as: 'groupData'
        }
      },
      { $unwind: { path: '$groupData', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'internalmentors',
          localField: 'groupData.internalMentor',
          foreignField: '_id',
          as: 'internalMentorData'
        }
      },
      { $unwind: { path: '$internalMentorData', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          internalMentorName: '$internalMentorData.name'
        }
      },
      {
        $project: {
          name: 1,
          uid: 1,
          externalMentorName: 1,
          internalMentorName: 1,
          meeting_attended: 1,
          weekly_reports_completed: 1,
          final_report_submitted: 1,
          external_marks: 1,
          external_viva_marks: 1,
          internal_viva_marks: 1,
          weekly_report_data: 1
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// POST create new internship
router.post('/', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
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
    const Internship = getInternshipModel(getYearDb(req.year));
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

// DELETE internship with cascade safety
router.delete('/:id', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    // Find the student first to get their details
    const internship = await Internship.findById(req.params.id);

    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }

    // Store student info for cascade operations
    const studentId = internship._id;
    const assignedGroupName = internship.assignedGroup;

    // DELETE the student from database
    await Internship.findByIdAndDelete(req.params.id);

    // CASCADE: Remove student from Group documents if assigned
    if (assignedGroupName) {
      const Group = getGroupModel(getYearDb(req.year));

      // Remove student from group's students array
      await Group.updateMany(
        { students: studentId },
        { $pull: { students: studentId } }
      );

      // Clean up empty groups
      await Group.deleteMany({
        $or: [
          { students: { $exists: false } },
          { students: { $size: 0 } },
          { students: null }
        ]
      });
    }

    res.json({
      success: true,
      message: 'Student removed successfully from all records',
      deletedStudent: {
        name: internship.name,
        uid: internship.uid,
        wasInGroup: !!assignedGroupName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET summary statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const totalOffers = await Internship.countDocuments();
    const totalStudents = await Internship.distinct('uid').then(uids => uids.length);
    const totalCompanies = await Internship.distinct('standardized_company_name').then(companies => companies.filter(Boolean).length);
    const completedInternships = await Internship.countDocuments({ 'status': 'completed' });
    const pendingApprovals = await Internship.countDocuments({ 'status': 'pending' });

    const branchWiseCount = await Internship.aggregate([
      {
        $group: {
          _id: '$branch',
          uniqueStudents: { $addToSet: '$uid' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalOffers,
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

// GET single internship by ID
router.get('/:id', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    res.json({ success: true, data: internship });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

