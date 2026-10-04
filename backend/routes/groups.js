const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const { getYearDb, withTransaction } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');
const { getMentorModel } = require('../models/Mentor');
const { getInternalMentorModel } = require('../models/InternalMentor');
const { containsRegex, exactRegex } = require('../utils/escapeRegex');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { conflict } = require('../middleware/errorHandler');
const { randomUUID } = require('crypto');

const getModels = (req) => {
  const db = getYearDb(req.year);
  return {
    Internship: getInternshipModel(db),
    Group: getGroupModel(db),
    Mentor: getMentorModel(db),
    InternalMentor: getInternalMentorModel(db),
  };
};

// Helper to generate group ID
const generateGroupId = () => randomUUID();

/**
 * Fisher-Yates shuffle.
 *
 * The previous `sort(() => Math.random() - 0.5)` is not a uniform shuffle — some
 * students were systematically more likely to be picked than others. For group
 * formation and random student selection in an academic context, that matters.
 */
const shuffle = (input) => {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const getExistingGroupNumbers = async (Group, session = null) => {
  const docs = await Group.find({ name: { $regex: /^Group\s+\d+$/ } }).select('name').session(session);
  const numbers = new Set();
  docs.forEach((doc) => {
    const match = String(doc.name).match(/^Group\s+(\d+)$/);
    if (match) numbers.add(Number(match[1]));
  });
  return numbers;
};

// Unassigned = no group recorded (null, empty, or field missing).
const UNASSIGNED = {
  $or: [
    { assignedGroup: null },
    { assignedGroup: '' },
    { assignedGroup: { $exists: false } },
  ],
};

/**
 * Splits students into groups. Pure: no database access.
 * Returns { groups } or { error: { status, message, suggestion } }.
 */
const planGroups = (students, { groupSize, numGroups, randomize, existingNumbers }) => {
  const totalStudents = students.length;
  let finalGroupSize = groupSize;
  let finalNumGroups = numGroups;

  if (numGroups && groupSize) {
    // Both given: respect both exactly, or explain why it cannot be done.
    const requiredStudents = numGroups * groupSize;
    if (requiredStudents > totalStudents) {
      return {
        error: {
          status: 400,
          message: `Cannot create ${numGroups} groups with ${groupSize} students each. You only have ${totalStudents} unassigned students. Required: ${requiredStudents}.`,
          suggestion: `Try ${Math.floor(totalStudents / groupSize)} groups with ${groupSize} students, or reduce group size to ${Math.floor(totalStudents / numGroups)} students per group.`,
        },
      };
    }
  } else if (numGroups) {
    // Only the number of groups: spread students evenly.
    finalNumGroups = Math.min(numGroups, totalStudents);
    finalGroupSize = Math.ceil(totalStudents / finalNumGroups);
  } else {
    // Only the size: as many groups as needed.
    finalNumGroups = Math.ceil(totalStudents / groupSize);
  }

  const ordered = randomize ? shuffle(students) : students;
  const useExactSize = Boolean(numGroups && groupSize);

  // Reuse the lowest free "Group N" numbers so names never collide with existing groups.
  const groupNumbers = [];
  for (let n = 1; groupNumbers.length < finalNumGroups; n += 1) {
    if (!existingNumbers.has(n)) groupNumbers.push(n);
  }

  const groups = [];
  let index = 0;
  for (let i = 0; i < finalNumGroups; i += 1) {
    const size = useExactSize
      ? finalGroupSize
      : Math.ceil((totalStudents - index) / (finalNumGroups - i)); // auto-balance the remainder
    const members = ordered.slice(index, index + size);
    if (members.length > 0) {
      groups.push({
        groupId: generateGroupId(),
        groupNumber: groupNumbers[i],
        groupName: `Group ${groupNumbers[i]}`,
        students: members,
      });
      index += size;
    }
  }

  return { groups };
};

// POST generate student groups (preview, or save with assignToGroups: true)
//
// When saving, everything (reading the unassigned students, naming the groups and
// both writes) runs in ONE transaction. Before, the students were marked as assigned
// first and the groups inserted second, so a failure in between left students
// "assigned" to groups that did not exist, and two people generating at the same
// moment could put the same student in two groups.
router.post('/generate', async (req, res, next) => {
  const {
    filters = {},
    groupSize = 5,
    numGroups = null,
    randomize = true,
    assignToGroups = false,
  } = req.body;

  const query = { ...UNASSIGNED };
  const branchMatch = exactRegex(filters.branch);
  const companyMatch = containsRegex(filters.company);
  if (branchMatch) query.branch = branchMatch;
  if (companyMatch) query.companyName = companyMatch;

  const run = async (session) => {
    const { Internship, Group } = getModels(req);
    const internships = await Internship.find(query).session(session);
    if (internships.length === 0) {
      return { error: { status: 404, message: 'No unassigned students found matching the filters' } };
    }

    const students = internships.map((i) => ({
      _id: i._id,
      name: i.name,
      email: i.email,
      uid: i.uid,
      branch: i.branch,
      company: i.companyName,
      internshipTitle: i.internshipTitle || 'Intern',
      internshipType: i.internshipType,
      externalMentorName: i.externalMentorName,
      startDate: i.startDate,
      endDate: i.endDate,
      documentLink: i.documentLink,
      currentlyAssignedGroup: i.assignedGroup,
    }));

    const existingNumbers = assignToGroups ? await getExistingGroupNumbers(Group, session) : new Set();
    const plan = planGroups(students, { groupSize, numGroups, randomize, existingNumbers });
    if (plan.error) return plan;

    if (assignToGroups) {
      const updates = plan.groups.flatMap((group) => group.students.map((student) => ({
        updateOne: {
          // Only claim a student who is still unassigned at write time.
          filter: { _id: student._id, ...UNASSIGNED },
          update: { $set: { assignedGroup: group.groupId, assignedGroupName: group.groupName } },
        },
      })));

      const result = await Internship.bulkWrite(updates, { session });
      if (result.modifiedCount !== updates.length) {
        // Someone else assigned some of these students meanwhile. Throwing aborts the
        // whole transaction, so no partial groups are left behind.
        throw conflict('Some of these students were just assigned by someone else. Nothing was saved. Please try again.');
      }

      await Group.insertMany(plan.groups.map((group) => ({
        name: group.groupName,
        students: group.students.map((s) => s._id),
      })), { session });
    }

    return { groups: plan.groups, totalStudents: students.length };
  };

  try {
    const outcome = assignToGroups ? await withTransaction(run) : await run(null);
    if (outcome.error) {
      const { status, ...body } = outcome.error;
      return res.status(status).json({ success: false, ...body });
    }

    return res.json({
      success: true,
      data: {
        groups: outcome.groups,
        totalStudents: outcome.totalStudents,
        totalGroups: outcome.groups.length,
        assigned: assignToGroups,
      },
    });
  } catch (error) {
    return next(error);
  }
});


// POST check if student is already in a group
router.post('/check-assignment', async (req, res) => {
  try {
    const { Internship } = getModels(req);
    const { uids } = req.body; // Array of UIDs to check

    const students = await Internship.find({
      uid: { $in: uids },
      assignedGroup: { $ne: null, $ne: '' }
    }).select('uid name assignedGroupName assignedGroup');

    const alreadyAssigned = students.map(s => ({
      uid: s.uid,
      name: s.name,
      groupName: s.assignedGroupName,
      groupId: s.assignedGroup
    }));

    res.json({
      success: true,
      alreadyAssigned,
      count: alreadyAssigned.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const EMPTY_GROUP = {
  $or: [
    { students: { $exists: false } },
    { students: { $size: 0 } },
    { students: null },
  ],
};

/** Sets isAssigned=false on mentors that no remaining group uses. Returns how many changed. */
const freeUnusedMentors = async (Model, field, Group, mentorIds, session) => {
  let freed = 0;
  for (const id of mentorIds) {
    const stillUsed = await Group.exists({ [field]: id }).session(session);
    if (!stillUsed) {
      const result = await Model.updateOne({ _id: id, isAssigned: true }, { $set: { isAssigned: false } }, { session });
      freed += result.modifiedCount;
    }
  }
  return freed;
};

// POST unassign students from their groups
//
// One transaction: unassign the students, remove them from their groups, delete groups
// left empty, and free mentors no longer used by any group. Before, a failure halfway
// could leave a student unassigned but still listed in a group.
router.post('/unassign', audit('groups.unassign', (req) => ({
  uidCount: Array.isArray(req.body?.uids) ? req.body.uids.length : 0,
})), async (req, res, next) => {
  const { uids } = req.body || {};
  if (!Array.isArray(uids) || uids.length === 0) {
    return res.status(400).json({ success: false, message: 'Provide the UIDs to unassign' });
  }

  try {
    const result = await withTransaction(async (session) => {
      const { Internship, Group, Mentor, InternalMentor } = getModels(req);

      const students = await Internship.find({ uid: { $in: uids }, assignedGroup: { $nin: [null, ''] } })
        .select('_id')
        .session(session);
      const studentIds = students.map((s) => s._id);

      const unassigned = await Internship.updateMany(
        { uid: { $in: uids } },
        { $set: { assignedGroup: null, assignedGroupName: null } },
        { session }
      );

      if (studentIds.length === 0) {
        return { count: unassigned.modifiedCount, groupsDeleted: 0, externalFreed: 0, internalFreed: 0 };
      }

      await Group.updateMany(
        { students: { $in: studentIds } },
        { $pull: { students: { $in: studentIds } } },
        { session }
      );

      const emptyGroups = await Group.find(EMPTY_GROUP).select('externalMentor internalMentor').session(session);
      const deleted = await Group.deleteMany({ _id: { $in: emptyGroups.map((g) => g._id) } }, { session });

      const externalIds = emptyGroups.map((g) => g.externalMentor).filter(Boolean);
      const internalIds = emptyGroups.map((g) => g.internalMentor).filter(Boolean);

      return {
        count: unassigned.modifiedCount,
        groupsDeleted: deleted.deletedCount,
        externalFreed: await freeUnusedMentors(Mentor, 'externalMentor', Group, externalIds, session),
        internalFreed: await freeUnusedMentors(InternalMentor, 'internalMentor', Group, internalIds, session),
      };
    });

    return res.json({
      success: true,
      message: `Unassigned ${result.count} students from their groups`,
      count: result.count,
      groupsDeleted: result.groupsDeleted,
      externalMentorsFreed: result.externalFreed,
      internalMentorsFreed: result.internalFreed,
    });
  } catch (error) {
    return next(error);
  }
});

// POST clear all groups (delete every group, unassign every student, free every mentor)
// Admin only. One transaction: it either fully happens or not at all.
router.post(
  '/clear-all',
  requireRole('admin'),
  audit('groups.clear-all'),
  async (req, res, next) => {
    try {
      const result = await withTransaction(async (session) => {
        const { Internship, Group, Mentor, InternalMentor } = getModels(req);
        const groups = await Group.deleteMany({}, { session });
        const students = await Internship.updateMany(
          { assignedGroup: { $nin: [null, ''] } },
          { $set: { assignedGroup: null, assignedGroupName: null } },
          { session }
        );
        const external = await Mentor.updateMany({ isAssigned: true }, { $set: { isAssigned: false } }, { session });
        const internal = await InternalMentor.updateMany({ isAssigned: true }, { $set: { isAssigned: false } }, { session });
        return { groups, students, external, internal };
      });

      return res.json({
        success: true,
        message: 'All groups cleared successfully',
        groupsDeleted: result.groups.deletedCount,
        studentsUnassigned: result.students.modifiedCount,
        externalMentorsFreed: result.external.modifiedCount,
        internalMentorsFreed: result.internal.modifiedCount,
      });
    } catch (error) {
      return next(error);
    }
  }
);


// GET all groups (unique Group documents)
router.get('/list', async (req, res) => {
  try {
    const { Group } = getModels(req);
    const groups = await Group.find({})
      .populate('students', 'uid name branch companyName')
      .sort({ name: 1 });

    const data = groups.map((group) => ({
      _id: group._id,
      groupName: group.name,
      studentCount: group.students?.length || 0,
      students: (group.students || []).map((student) => ({
        uid: student.uid,
        name: student.name,
        branch: student.branch,
        company: student.companyName
      }))
    }));

    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST export ALL groups to Excel with EXACT format
router.post('/export', async (req, res) => {
  try {
    const { Group } = getModels(req);
    console.log('📥 Export request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { groups } = req.body;

    if (!groups || !Array.isArray(groups)) {
      console.error('❌ Invalid groups data:', groups);
      return res.status(400).json({ success: false, message: 'Invalid groups data' });
    }

    console.log(`✅ Processing ${groups.length} groups for export`);

    const wb = xlsx.utils.book_new();

    // Fetch mentor info and complete student data for all groups
    const groupsWithMentors = await Promise.all(
      groups.map(async (group) => {
        let internalMentorName = 'Not Assigned';
        let externalMentorName = 'Not Assigned';
        let externalMentorEmail = '';
        let externalMentorPhone = '';
        let students = group.students || [];

        if (group._id) {
          const dbGroup = await Group.findById(group._id)
            .populate('externalMentor', 'name email phone')
            .populate('internalMentor', 'name')
            .populate('students', 'uid name branch email phone');

          if (dbGroup?.internalMentor?.name) {
            internalMentorName = dbGroup.internalMentor.name;
          }
          if (dbGroup?.externalMentor?.name) {
            externalMentorName = dbGroup.externalMentor.name;
            externalMentorEmail = dbGroup.externalMentor.email || '';
            externalMentorPhone = dbGroup.externalMentor.phone || '';
          }
          if (dbGroup?.students && Array.isArray(dbGroup.students)) {
            students = dbGroup.students;
          }
        }

        return {
          ...group,
          students,
          internalMentorName,
          externalMentorName,
          externalMentorEmail,
          externalMentorPhone,
        };
      })
    );

    groupsWithMentors.forEach((group, idx) => {
      console.log(`Processing group ${idx + 1}:`, group.groupName || group.groupNumber);

      if (!group.students || !Array.isArray(group.students)) {
        console.error(`❌ Group ${idx + 1} has invalid students data`);
        throw new Error(`Group ${idx + 1} has invalid students data`);
      }

      // EXACT FORMAT: Student info + internal/external mentor details
      const sheetData = group.students.map((student, index) => ({
        'Student Name': student.name || '',
        'UID': student.uid || '',
        'Branch': student.branch || '',
        'Institute Email': student.email || '',
        'Student Phone': student.phone || '',
        'Internal Mentor Name': group.internalMentorName,
        'External Mentor Name': group.externalMentorName,
        'External Mentor Email': group.externalMentorEmail || '',
        'External Mentor Phone': group.externalMentorPhone || ''
      }));

      const ws = xlsx.utils.json_to_sheet(sheetData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 25 }, // Student Name
        { wch: 12 }, // UID
        { wch: 15 }, // Branch
        { wch: 30 }, // Institute Email
        { wch: 15 }, // Student Phone
        { wch: 22 }, // Internal Mentor Name
        { wch: 22 }, // External Mentor Name
        { wch: 30 }, // External Mentor Email
        { wch: 18 }  // External Mentor Phone
      ];

      const sheetName = group.groupName || `Group ${group.groupNumber}`;
      xlsx.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel sheet name limit
    });

    console.log('📊 Creating Excel buffer...');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    console.log(`✅ Buffer created, size: ${buffer.length} bytes`);

    res.setHeader('Content-Disposition', 'attachment; filename=student_groups.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
    console.log('✅ Export completed successfully');
  } catch (error) {
    console.error('❌ Export error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST export SINGLE group to Excel with EXACT format
router.post('/export-single', async (req, res) => {
  try {
    const { Group } = getModels(req);
    const { group } = req.body;

    if (!group || !group.students) {
      return res.status(400).json({ success: false, message: 'Invalid group data' });
    }

    // Fetch mentor info for this group
    let internalMentorName = 'Not Assigned';
    let externalMentorName = 'Not Assigned';
    let externalMentorEmail = '';
    let externalMentorPhone = '';
    let students = group.students || [];
    
    if (group._id) {
      const dbGroup = await Group.findById(group._id)
        .populate('externalMentor', 'name email phone')
        .populate('internalMentor', 'name')
        .populate('students', 'uid name branch email phone');

      if (dbGroup?.internalMentor?.name) {
        internalMentorName = dbGroup.internalMentor.name;
      }
      if (dbGroup?.externalMentor?.name) {
        externalMentorName = dbGroup.externalMentor.name;
        externalMentorEmail = dbGroup.externalMentor.email || '';
        externalMentorPhone = dbGroup.externalMentor.phone || '';
      }
      if (dbGroup?.students && Array.isArray(dbGroup.students)) {
        students = dbGroup.students;
      }
    }

    // EXACT FORMAT: Student info + internal/external mentor details
    const sheetData = students.map((student, index) => ({
      'Student Name': student.name || '',
      'UID': student.uid || '',
      'Branch': student.branch || '',
      'Institute Email': student.email || '',
      'Student Phone': student.phone || '',
      'Internal Mentor Name': internalMentorName,
      'External Mentor Name': externalMentorName,
      'External Mentor Email': externalMentorEmail || '',
      'External Mentor Phone': externalMentorPhone || ''
    }));

    const ws = xlsx.utils.json_to_sheet(sheetData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // Student Name
      { wch: 12 }, // UID
      { wch: 15 }, // Branch
      { wch: 30 }, // Institute Email
      { wch: 15 }, // Student Phone
      { wch: 22 }, // Internal Mentor Name
      { wch: 22 }, // External Mentor Name
      { wch: 30 }, // External Mentor Email
      { wch: 18 }  // External Mentor Phone
    ];

    const wb = xlsx.utils.book_new();
    const sheetName = group.groupName || `Group ${group.groupNumber}`;
    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const fileName = `${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST pick random students (only unassigned ones)
router.post('/random-pick', async (req, res) => {
  try {
    const { Internship } = getModels(req);
    const {
      filters = {},
      count = 1
    } = req.body;

    // Build query from filters (all case-insensitive, input escaped).
    // NOTE: there is deliberately no `status` filter — the Internship schema has no
    // `status` field, so filtering on it silently returned zero results.
    let query = {};
    const branchMatch = exactRegex(filters.branch);
    const companyMatch = containsRegex(filters.company);
    if (branchMatch) query['branch'] = branchMatch;
    if (companyMatch) query['companyName'] = companyMatch;

    // Only pick unassigned students
    query['$or'] = [
      { assignedGroup: null },
      { assignedGroup: '' },
      { assignedGroup: { $exists: false } }
    ];

    // Get all matching internships
    const internships = await Internship.find(query);

    if (internships.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No unassigned students found matching the filters'
      });
    }

    // Shuffle and pick random students
    const picked = shuffle(internships).slice(0, Math.min(count, internships.length));

    const students = picked.map(i => ({
      name: i.name,
      email: i.email,
      uid: i.uid,
      branch: i.branch,
      company: i.companyName,
      internshipTitle: i.internshipTitle || 'Intern',
      internshipType: i.internshipType,
      mentor: i.externalMentorName,
      documentLink: i.documentLink
    }));

    res.json({
      success: true,
      data: students,
      totalAvailable: internships.length,
      picked: students.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST export random picked students to Excel
router.post('/export-random', async (req, res) => {
  try {
    const { Group } = getModels(req);
    const { students } = req.body;

    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ success: false, message: 'Invalid students data' });
    }

    const sheetData = students.map((student, index) => ({
      'Sr. No': index + 1,
      'Name': student.name,
      'Email': student.email,
      'UID': student.uid,
      'Branch': student.branch,
      'Company': student.company,
      'Internship Type': student.internshipType,
      'Internship Title': student.internshipTitle,
      'External Mentor': student.mentor,
      'Document Link': student.documentLink
    }));

    const ws = xlsx.utils.json_to_sheet(sheetData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Random Students');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=random_students.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST allocate external mentors to all groups - AVOID DUPLICATES when possible
router.post('/allocate-all-external', async (req, res) => {
  try {
    const { Group, Mentor } = getModels(req);
    // Get all groups that don't have an external mentor
    const groups = await Group.find({ externalMentor: null });

    if (groups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No groups without external mentors found'
      });
    }

    // Get all available (unassigned) external mentors
    const availableMentors = await Mentor.find({ isAssigned: false });

    if (availableMentors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available external mentors found. Please add mentors first.'
      });
    }

    // IMPROVED LOGIC: Try to allocate one mentor per group if enough mentors
    const shuffledMentors = shuffle(availableMentors);
    const allocations = [];
    let mentorIndex = 0;

    // If we have enough mentors, don't reuse them
    const canAllocateUniquely = availableMentors.length >= groups.length;

    for (const group of groups) {
      const mentor = shuffledMentors[mentorIndex % shuffledMentors.length];

      // Update group with external mentor
      group.externalMentor = mentor._id;
      await group.save();

      // Mark mentor as assigned
      if (!mentor.isAssigned) {
        mentor.isAssigned = true;
        await mentor.save();
      }

      allocations.push({
        groupName: group.name,
        mentorName: mentor.name,
        mentorEmail: mentor.email
      });

      // Only increment if we can allocate uniquely (avoid duplicates)
      if (canAllocateUniquely) {
        mentorIndex++;
      } else {
        // Otherwise cycle through all mentors
        mentorIndex++;
      }
    }

    res.json({
      success: true,
      message: `Successfully allocated external mentors to ${allocations.length} groups${canAllocateUniquely ? ' (unique mentors per group)' : ' (some mentors assigned to multiple groups)'
        }`,
      allocations,
      uniqueAllocation: canAllocateUniquely
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST allocate a random external mentor to a specific group
router.post('/:id/allocate-external-mentor', async (req, res) => {
  try {
    const { Group, Mentor } = getModels(req);
    const groupId = req.params.id;

    // Find the group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.externalMentor) {
      return res.status(400).json({
        success: false,
        message: 'This group already has an external mentor assigned'
      });
    }

    // Get all available mentors
    const availableMentors = await Mentor.find({ isAssigned: false });

    if (availableMentors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available external mentors found. Please add mentors first.'
      });
    }

    // Pick a random mentor
    const randomMentor = availableMentors[Math.floor(Math.random() * availableMentors.length)];

    // Update group
    group.externalMentor = randomMentor._id;
    await group.save();

    // Mark mentor as assigned
    randomMentor.isAssigned = true;
    await randomMentor.save();

    res.json({
      success: true,
      message: `External mentor ${randomMentor.name} allocated to ${group.name}`,
      data: {
        groupName: group.name,
        mentorName: randomMentor.name,
        mentorEmail: randomMentor.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST allocate internal mentors to all groups - AVOID DUPLICATES when possible
router.post('/allocate-all-internal', async (req, res) => {
  try {
    const { Group, InternalMentor } = getModels(req);
    // Get all groups that don't have an internal mentor
    const groups = await Group.find({ internalMentor: null });

    if (groups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No groups without internal mentors found'
      });
    }

    // Get all available internal mentors
    const availableMentors = await InternalMentor.find({ isAssigned: false });

    if (availableMentors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available internal mentors found. Please add internal mentors first.'
      });
    }

    // IMPROVED LOGIC: Try to allocate one mentor per group if enough mentors
    const shuffledMentors = shuffle(availableMentors);
    const allocations = [];
    let mentorIndex = 0;

    // If we have enough mentors, don't reuse them
    const canAllocateUniquely = availableMentors.length >= groups.length;

    for (const group of groups) {
      const mentor = shuffledMentors[mentorIndex % shuffledMentors.length];

      // Update group with internal mentor
      group.internalMentor = mentor._id;
      await group.save();

      // Mark mentor as assigned
      if (!mentor.isAssigned) {
        mentor.isAssigned = true;
        await mentor.save();
      }

      allocations.push({
        groupName: group.name,
        mentorName: mentor.name,
        mentorEmail: mentor.email
      });

      // Only increment if we can allocate uniquely (avoid duplicates)
      if (canAllocateUniquely) {
        mentorIndex++;
      } else {
        // Otherwise cycle through all mentors
        mentorIndex++;
      }
    }

    res.json({
      success: true,
      message: `Successfully allocated internal mentors to ${allocations.length} groups${canAllocateUniquely ? ' (unique mentors per group)' : ' (some mentors assigned to multiple groups)'
        }`,
      allocations,
      uniqueAllocation: canAllocateUniquely
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST allocate a random internal mentor to a specific group
router.post('/:id/allocate-internal-mentor', async (req, res) => {
  try {
    const { Group, InternalMentor } = getModels(req);
    const groupId = req.params.id;

    // Find the group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.internalMentor) {
      return res.status(400).json({
        success: false,
        message: 'This group already has an internal mentor assigned'
      });
    }

    // Get all available internal mentors
    const availableMentors = await InternalMentor.find({ isAssigned: false });

    if (availableMentors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available internal mentors found. Please add internal mentors first.'
      });
    }

    // Pick a random mentor
    const randomMentor = availableMentors[Math.floor(Math.random() * availableMentors.length)];

    // Update group
    group.internalMentor = randomMentor._id;
    await group.save();

    // Mark mentor as assigned
    randomMentor.isAssigned = true;
    await randomMentor.save();

    res.json({
      success: true,
      message: `Internal mentor ${randomMentor.name} allocated to ${group.name}`,
      data: {
        groupName: group.name,
        mentorName: randomMentor.name,
        mentorEmail: randomMentor.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all groups with mentor details (enhanced list)
router.get('/list-with-mentors', async (req, res) => {
  try {
    const { Group, Mentor, InternalMentor } = getModels(req);
    const groups = await Group.find()
        .populate('externalMentor', 'name email phone')
        .populate('internalMentor', 'name email phone')
      .populate('students', 'uid name branch companyName email')
      .sort({ name: 1 });

    const formattedGroups = groups.map(group => ({
      _id: group._id,
      groupName: group.name,
      mailSent: group.mailSent === true,
      mailSentAt: group.mailSentAt || null,
      externalMentor: group.externalMentor ? {
        _id: group.externalMentor._id,
        name: group.externalMentor.name,
        email: group.externalMentor.email,
        phone: group.externalMentor.phone
      } : null,
      internalMentor: group.internalMentor ? {
        _id: group.internalMentor._id,
        name: group.internalMentor.name,
        email: group.internalMentor.email,
        phone: group.internalMentor.phone
      } : null,
      studentCount: group.students.length,
      students: group.students.map(s => ({
        uid: s.uid,
        name: s.name,
        branch: s.branch,
        company: s.companyName,
        email: s.email
      }))
    }));

    res.json({
      success: true,
      data: formattedGroups,
      count: formattedGroups.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET search groups by student or mentor name
router.get('/search', async (req, res) => {
  try {
    const { Group, Mentor, InternalMentor } = getModels(req);
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [], count: 0 });
    }

    const searchRegex = containsRegex(query);
    if (!searchRegex) {
      return res.json({ success: true, data: [], count: 0 });
    }

    // Find all groups and populate
    const allGroups = await Group.find()
        .populate('externalMentor', 'name email phone')
        .populate('internalMentor', 'name email phone')
      .populate('students', 'uid name branch companyName email');

    // Filter groups that match student name or mentor name
    const matchedGroups = allGroups.filter(group => {
      // Check if any student matches
      const hasMatchingStudent = group.students.some(student =>
        searchRegex.test(student.name)
      );

      // Check if external mentor matches
      const hasMatchingExternalMentor = group.externalMentor && searchRegex.test(group.externalMentor.name);

      // Check if internal mentor matches
      const hasMatchingInternalMentor = group.internalMentor && searchRegex.test(group.internalMentor.name);

      return hasMatchingStudent || hasMatchingExternalMentor || hasMatchingInternalMentor;
    });

    // Format the response
    const formattedGroups = matchedGroups.map(group => ({
      _id: group._id,
      groupName: group.name,
      mailSent: group.mailSent === true,
      mailSentAt: group.mailSentAt || null,
      externalMentor: group.externalMentor ? {
        _id: group.externalMentor._id,
        name: group.externalMentor.name,
        email: group.externalMentor.email,
        phone: group.externalMentor.phone
      } : null,
      internalMentor: group.internalMentor ? {
        _id: group.internalMentor._id,
        name: group.internalMentor.name,
        email: group.internalMentor.email,
        phone: group.internalMentor.phone
      } : null,
      studentCount: group.students.length,
      students: group.students.map(s => ({
        uid: s.uid,
        name: s.name,
        branch: s.branch,
        company: s.companyName,
        email: s.email
      }))
    }));

    res.json({
      success: true,
      data: formattedGroups,
      count: formattedGroups.length,
      searchQuery: query
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST sync mentor assignments (cleanup orphaned assignments for both external and internal mentors)
router.post('/sync-mentors', async (req, res) => {
  try {
    const { Group, Mentor, InternalMentor } = getModels(req);
    // Sync External Mentors
    const allExternalMentors = await Mentor.find();
    const allGroups = await Group.find().select('externalMentor internalMentor');
    const assignedExternalMentorIds = allGroups
      .filter(g => g.externalMentor)
      .map(g => g.externalMentor.toString());

    let externalFixed = 0;
    let externalCorrect = 0;

    for (const mentor of allExternalMentors) {
      const shouldBeAssigned = assignedExternalMentorIds.includes(mentor._id.toString());

      if (shouldBeAssigned && !mentor.isAssigned) {
        mentor.isAssigned = true;
        await mentor.save();
        externalFixed++;
      } else if (!shouldBeAssigned && mentor.isAssigned) {
        mentor.isAssigned = false;
        await mentor.save();
        externalFixed++;
      } else {
        externalCorrect++;
      }
    }

    // Sync Internal Mentors
    const allInternalMentors = await InternalMentor.find();
    const assignedInternalMentorIds = allGroups
      .filter(g => g.internalMentor)
      .map(g => g.internalMentor.toString());

    let internalFixed = 0;
    let internalCorrect = 0;

    for (const mentor of allInternalMentors) {
      const shouldBeAssigned = assignedInternalMentorIds.includes(mentor._id.toString());

      if (shouldBeAssigned && !mentor.isAssigned) {
        mentor.isAssigned = true;
        await mentor.save();
        internalFixed++;
      } else if (!shouldBeAssigned && mentor.isAssigned) {
        mentor.isAssigned = false;
        await mentor.save();
        internalFixed++;
      } else {
        internalCorrect++;
      }
    }

    res.json({
      success: true,
      message: `Mentor sync complete. External: Fixed ${externalFixed}/${allExternalMentors.length}, Internal: Fixed ${internalFixed}/${allInternalMentors.length}`,
      external: {
        fixed: externalFixed,
        alreadyCorrect: externalCorrect,
        total: allExternalMentors.length
      },
      internal: {
        fixed: internalFixed,
        alreadyCorrect: internalCorrect,
        total: allInternalMentors.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update group (edit group details)
router.put('/:groupId/assign-mentor', async (req, res) => {
  try {
    const { Group, Mentor, InternalMentor } = getModels(req);
    const { groupId } = req.params;
    const { mentorId, mentorType } = req.body;

    if (!mentorId || typeof mentorId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'mentorId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(mentorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groupId or mentorId'
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Decide whether this is external or internal mentor assignment
    let resolvedType = mentorType;
    let MentorModel = null;
    let groupField = null;

    if (resolvedType === 'external') {
      MentorModel = Mentor;
      groupField = 'externalMentor';
    } else if (resolvedType === 'internal') {
      MentorModel = InternalMentor;
      groupField = 'internalMentor';
    } else {
      // Infer mentor type by checking which collection contains the ID
      const [externalFound, internalFound] = await Promise.all([
        Mentor.exists({ _id: mentorId }),
        InternalMentor.exists({ _id: mentorId })
      ]);

      if (externalFound && !internalFound) {
        resolvedType = 'external';
        MentorModel = Mentor;
        groupField = 'externalMentor';
      } else if (!externalFound && internalFound) {
        resolvedType = 'internal';
        MentorModel = InternalMentor;
        groupField = 'internalMentor';
      } else {
        return res.status(404).json({
          success: false,
          message: 'Mentor not found'
        });
      }
    }

    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) {
      return res.status(404).json({ success: false, message: 'Mentor not found' });
    }

    // If the mentor is already assigned to some other group, block to avoid duplicates
    const assignedElsewhere = await Group.findOne({
      [groupField]: mentor._id,
      _id: { $ne: group._id }
    }).select('name');

    if (assignedElsewhere) {
      return res.status(409).json({
        success: false,
        message: `Selected mentor is already assigned to "${assignedElsewhere.name}". Please pick another mentor.`
      });
    }

    const oldMentorId = group[groupField];
    const oldMentorIdStr = oldMentorId ? oldMentorId.toString() : null;
    const newMentorIdStr = mentor._id.toString();

    // No-op if selecting the already-assigned mentor
    if (oldMentorIdStr === newMentorIdStr) {
      const populatedGroup = await Group.findById(group._id)
        .populate('externalMentor', 'name email')
        .populate('internalMentor', 'name email')
        .populate('students', 'uid name branch companyName email');

      return res.json({
        success: true,
        message: 'Mentor already assigned to this group',
        data: {
          _id: populatedGroup._id,
          groupName: populatedGroup.name,
          mailSent: populatedGroup.mailSent === true,
          mailSentAt: populatedGroup.mailSentAt || null,
          externalMentor: populatedGroup.externalMentor ? {
            _id: populatedGroup.externalMentor._id,
            name: populatedGroup.externalMentor.name,
            email: populatedGroup.externalMentor.email
          } : null,
          internalMentor: populatedGroup.internalMentor ? {
            _id: populatedGroup.internalMentor._id,
            name: populatedGroup.internalMentor.name,
            email: populatedGroup.internalMentor.email
          } : null,
          studentCount: populatedGroup.students.length,
          students: populatedGroup.students.map(s => ({
            uid: s.uid,
            name: s.name,
            branch: s.branch,
            company: s.companyName,
            email: s.email
          }))
        }
      });
    }

    // Update group reference
    group[groupField] = mentor._id;
    await group.save();

    // Ensure selected mentor is marked as assigned
    if (!mentor.isAssigned) {
      mentor.isAssigned = true;
      await mentor.save();
    }

    // Recompute old mentor assigned flag safely (only if changed)
    if (oldMentorIdStr) {
      const stillAssigned = await Group.exists({ [groupField]: oldMentorId });
      await MentorModel.findByIdAndUpdate(oldMentorId, { isAssigned: !!stillAssigned });
    }

    const populatedGroup = await Group.findById(group._id)
      .populate('externalMentor', 'name email')
      .populate('internalMentor', 'name email')
      .populate('students', 'uid name branch companyName email');

    res.json({
      success: true,
      message: `${resolvedType === 'external' ? 'External' : 'Internal'} mentor assigned successfully`,
      data: {
        _id: populatedGroup._id,
        groupName: populatedGroup.name,
        mailSent: populatedGroup.mailSent === true,
        mailSentAt: populatedGroup.mailSentAt || null,
        externalMentor: populatedGroup.externalMentor ? {
          _id: populatedGroup.externalMentor._id,
          name: populatedGroup.externalMentor.name,
          email: populatedGroup.externalMentor.email
        } : null,
        internalMentor: populatedGroup.internalMentor ? {
          _id: populatedGroup.internalMentor._id,
          name: populatedGroup.internalMentor.name,
          email: populatedGroup.internalMentor.email
        } : null,
        studentCount: populatedGroup.students.length,
        students: populatedGroup.students.map(s => ({
          uid: s.uid,
          name: s.name,
          branch: s.branch,
          company: s.companyName,
          email: s.email
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update group (edit group details)
router.put('/:id', async (req, res) => {
  try {
    // Mentor and InternalMentor are used further down when reassigning mentors.
    // They were previously missing from this destructure, which made every mentor
    // change through this route throw a ReferenceError and return 500.
    const { Group, Mentor, InternalMentor } = getModels(req);
    const { id } = req.params;
    const { name, students, externalMentor, internalMentor } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const oldExternalMentor = group.externalMentor;
    const oldInternalMentor = group.internalMentor;

    // Update fields if provided
    if (name !== undefined) group.name = name;
    if (students !== undefined) group.students = students;

    // Handle external mentor change
    if (externalMentor !== undefined) {
      // Assign new external mentor
      if (externalMentor) {
        const assignedElsewhere = await Group.findOne({
          externalMentor,
          _id: { $ne: group._id }
        }).select('name');

        if (assignedElsewhere) {
          return res.status(409).json({
            success: false,
            message: `Selected external mentor is already assigned to "${assignedElsewhere.name}". Please pick another mentor.`
          });
        }

        const mentor = await Mentor.findById(externalMentor);
        if (!mentor) {
          return res.status(404).json({ success: false, message: 'External mentor not found' });
        }
        mentor.isAssigned = true;
        await mentor.save();
        group.externalMentor = externalMentor;
      } else {
        group.externalMentor = null;
      }
    }

    // Handle internal mentor change
    if (internalMentor !== undefined) {
      // Assign new internal mentor
      if (internalMentor) {
        const assignedElsewhere = await Group.findOne({
          internalMentor,
          _id: { $ne: group._id }
        }).select('name');

        if (assignedElsewhere) {
          return res.status(409).json({
            success: false,
            message: `Selected internal mentor is already assigned to "${assignedElsewhere.name}". Please pick another mentor.`
          });
        }

        const mentor = await InternalMentor.findById(internalMentor);
        if (!mentor) {
          return res.status(404).json({ success: false, message: 'Internal mentor not found' });
        }
        mentor.isAssigned = true;
        await mentor.save();
        group.internalMentor = internalMentor;
      } else {
        group.internalMentor = null;
      }
    }

    await group.save();

    // Recompute old mentor assignment flags safely (handles mentors shared by mistake)
    if (oldExternalMentor && (!group.externalMentor || oldExternalMentor.toString() !== group.externalMentor.toString())) {
      const stillAssigned = await Group.exists({ externalMentor: oldExternalMentor });
      await Mentor.findByIdAndUpdate(oldExternalMentor, { isAssigned: !!stillAssigned });
    }

    if (oldInternalMentor && (!group.internalMentor || oldInternalMentor.toString() !== group.internalMentor.toString())) {
      const stillAssigned = await Group.exists({ internalMentor: oldInternalMentor });
      await InternalMentor.findByIdAndUpdate(oldInternalMentor, { isAssigned: !!stillAssigned });
    }

    // Populate mentors for response
    await group.populate('externalMentor internalMentor');

    res.json({
      success: true,
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
