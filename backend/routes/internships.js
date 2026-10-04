const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');
const { containsRegex, exactRegex } = require('../utils/escapeRegex');
const { audit } = require('../middleware/audit');
const { pickAllowed, CREATE_FIELDS, UPDATE_FIELDS } = require('../utils/allowedFields');

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

    // All user input is escaped before it reaches a RegExp — an unescaped value like
    // `(a+)+$` causes catastrophic backtracking, and `.*` would widen the filter.
    const branchMatch = exactRegex(branch);
    const typeMatch = exactRegex(type);
    const companyMatch = containsRegex(company);
    const mentorMatch = containsRegex(mentor);
    const uidMatch = containsRegex(uid);
    const nameMatch = containsRegex(name);

    if (branchMatch) query['branch'] = branchMatch;
    if (companyMatch) query['companyName'] = companyMatch;
    if (mentorMatch) query['externalMentorName'] = mentorMatch;
    if (typeMatch) query['internshipType'] = typeMatch;
    if (uidMatch) query['uid'] = uidMatch;
    if (nameMatch) query['name'] = nameMatch;

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
    // Whitelisted: evaluation marks and group assignment are not settable here.
    const internship = new Internship(pickAllowed(req.body, CREATE_FIELDS));
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
    // Whitelisted: a record edit cannot change the UID, evaluation marks, or
    // group assignment.
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

// DELETE internship with cascade safety
router.delete('/:id', audit('internships.delete', (req) => ({ internshipId: req.params.id })), async (req, res) => {
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

    // These replaced the old `status: completed` / `status: pending` counts, which
    // always returned 0 because the Internship schema has no `status` field.
    // Group assignment progress is real, computable, and what coordinators actually track.
    const assignedToGroups = await Internship.countDocuments({
      assignedGroup: { $nin: [null, ''] }
    });
    const unassignedStudents = totalOffers - assignedToGroups;

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
        assignedToGroups,
        unassignedStudents,
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

