const express = require('express');
const router = express.Router();
const { getYearDb, withTransaction } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');
const { containsRegex, exactRegex } = require('../utils/escapeRegex');
const { audit } = require('../middleware/audit');
const { requireRole } = require('../middleware/auth');
const { pickAllowed, CREATE_FIELDS, UPDATE_FIELDS } = require('../utils/allowedFields');
const { validateMarksUpdate, MARK_FIELDS } = require('../utils/marks');
const mongoose = require('mongoose');

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
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A student with this UID already exists. If they were deleted, an administrator can restore them from the Recycle Bin.',
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update internship
router.put('/:id', audit('internships.update', (req) => ({
  internshipId: req.params.id,
  fields: Object.keys(pickAllowed(req.body, UPDATE_FIELDS)),
})), async (req, res) => {
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

// PUT update one student's evaluation marks.
// The only route that edits marks one student at a time. Every change is recorded
// in the audit log with the old and new value, so "who changed this mark, and
// from what?" always has an answer.
router.put('/:id/marks', audit('internships.marks-update', (req, res) => res.locals.auditDetails || {
  internshipId: req.params.id,
}), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const { value, error } = validateMarksUpdate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const Internship = getInternshipModel(getYearDb(req.year));
    const fields = Object.keys(value);
    const before = await Internship.findById(req.params.id).select(['uid', ...fields].join(' ')).lean();
    if (!before) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const updated = await Internship.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).select(['uid', 'name', ...MARK_FIELDS].join(' '));

    const changes = fields
      .filter((field) => before[field] !== value[field])
      .map((field) => ({ field, from: before[field] ?? null, to: value[field] }));
    res.locals.auditDetails = { internshipId: req.params.id, uid: before.uid, changes };

    return res.json({ success: true, data: updated, changed: changes.length });
  } catch (error) {
    return next(error);
  }
});

// DELETE a student: moves them to the Recycle Bin (soft delete).
//
// Nothing is erased. The record, marks and group link stay intact and are simply
// hidden everywhere, so an admin can restore the student exactly as they were.
router.delete('/:id', audit('internships.delete', (req, res) => res.locals.auditDetails || {
  internshipId: req.params.id,
}), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const Internship = getInternshipModel(getYearDb(req.year));
    const student = await Internship.findOneAndUpdate(
      { _id: req.params.id },
      { $set: { deletedAt: new Date(), deletedBy: req.user?.username || 'unknown' } },
      { new: true }
    ).select('uid name assignedGroupName');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.locals.auditDetails = { internshipId: req.params.id, uid: student.uid };
    return res.json({
      success: true,
      message: `${student.name || student.uid} was moved to the Recycle Bin. An administrator can restore them.`,
      deletedStudent: {
        name: student.name,
        uid: student.uid,
        wasInGroup: Boolean(student.assignedGroupName),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET the Recycle Bin (admin only)
router.get('/recycle-bin', requireRole('admin'), async (req, res, next) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const students = await Internship.find({ deletedAt: { $ne: null } })
      .setOptions({ withDeleted: true })
      .select('uid name branch companyName assignedGroupName deletedAt deletedBy')
      .sort({ deletedAt: -1 })
      .lean();
    return res.json({ success: true, data: students, count: students.length });
  } catch (error) {
    return next(error);
  }
});

// POST restore a student from the Recycle Bin (admin only)
router.post('/:id/restore', requireRole('admin'), audit('internships.restore', (req, res) => res.locals.auditDetails || {
  internshipId: req.params.id,
}), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const db = getYearDb(req.year);
    const Internship = getInternshipModel(db);
    const Group = getGroupModel(db);

    const student = await Internship.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
      { new: true }
    ).setOptions({ withDeleted: true });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student is not in the Recycle Bin' });
    }

    // If their group was dissolved while they were in the bin, return them unassigned
    // rather than pointing at a group that no longer exists.
    let groupNote = '';
    if (student.assignedGroupName) {
      const stillInGroup = await Group.exists({ students: student._id });
      if (!stillInGroup) {
        await Internship.updateOne(
          { _id: student._id },
          { $set: { assignedGroup: null, assignedGroupName: null } }
        );
        groupNote = ` Their group "${student.assignedGroupName}" no longer exists, so they are now unassigned.`;
      }
    }

    res.locals.auditDetails = { internshipId: req.params.id, uid: student.uid };
    return res.json({ success: true, message: `${student.name || student.uid} was restored.${groupNote}` });
  } catch (error) {
    return next(error);
  }
});

// DELETE permanently (admin only, and only from the Recycle Bin)
//
// The one irreversible action. It refuses students who are not already in the bin,
// so nothing can be erased in a single step.
router.delete('/:id/permanent', requireRole('admin'), audit('internships.delete-permanent', (req, res) => res.locals.auditDetails || {
  internshipId: req.params.id,
}), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const result = await withTransaction(async (session) => {
      const db = getYearDb(req.year);
      const Internship = getInternshipModel(db);
      const Group = getGroupModel(db);

      const student = await Internship.findOne({ _id: req.params.id, deletedAt: { $ne: null } })
        .setOptions({ withDeleted: true })
        .select('uid name')
        .session(session);
      if (!student) return null;

      await Group.updateMany({ students: student._id }, { $pull: { students: student._id } }, { session });
      await Internship.deleteOne({ _id: student._id }, { session });
      return student;
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Only students already in the Recycle Bin can be deleted permanently.',
      });
    }

    res.locals.auditDetails = { internshipId: req.params.id, uid: result.uid };
    return res.json({ success: true, message: `${result.name || result.uid} was permanently deleted.` });
  } catch (error) {
    return next(error);
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

