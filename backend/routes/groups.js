const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const Internship = require('../models/Internship');
const Group = require('../models/Group');
const Mentor = require('../models/Mentor');
const InternalMentor = require('../models/InternalMentor');
const { v4: uuidv4 } = require('crypto').randomUUID ? {} : require('uuid');

// Helper to generate group ID
const generateGroupId = () => {
  return typeof uuidv4 === 'function' ? uuidv4() : `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// POST generate student groups with SMART LOGIC and DUPLICATE PREVENTION
router.post('/generate', async (req, res) => {
  try {
    const {
      filters = {},
      groupSize = 5,
      numGroups = null,
      randomize = true,
      assignToGroups = false // If true, actually assign students to groups in DB
    } = req.body;

    // Build query from filters (all case-insensitive)
    let query = {};
    if (filters.branch) query['branch'] = new RegExp(`^${filters.branch}$`, 'i');
    if (filters.company) query['companyName'] = new RegExp(filters.company, 'i');

    // CRITICAL: Only select students NOT already assigned to a group
    query['$or'] = [
      { assignedGroup: null },
      { assignedGroup: '' },
      { assignedGroup: { $exists: false } }
    ];

    // Get students matching filters
    const internships = await Internship.find(query);

    if (internships.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No unassigned students found matching the filters'
      });
    }

    // Extract unique students
    const students = internships.map(i => ({
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
      status: i.status,
      salary: i.salary,
      documentLink: i.documentLink,
      currentlyAssignedGroup: i.assignedGroup
    }));

    // SMART LOGIC: Validate inputs
    const totalStudents = students.length;
    let finalGroupSize = groupSize;
    let finalNumGroups = numGroups;

    // Case 1: Both specified - respect BOTH values (user's exact requirements)
    if (numGroups && groupSize) {
      const requiredStudents = numGroups * groupSize;

      if (requiredStudents > totalStudents) {
        // Warning: Not enough students for all groups
        return res.status(400).json({
          success: false,
          message: `Cannot create ${numGroups} groups with ${groupSize} students each. You only have ${totalStudents} unassigned students. Required: ${requiredStudents}.`,
          suggestion: `Try ${Math.floor(totalStudents / groupSize)} groups with ${groupSize} students, or reduce group size to ${Math.floor(totalStudents / numGroups)} students per group.`
        });
      }

      // Respect BOTH user inputs - create exactly numGroups with exactly groupSize students
      finalNumGroups = numGroups;
      finalGroupSize = groupSize;
    } else if (numGroups) {
      // Only numGroups specified - distribute students evenly
      finalNumGroups = Math.min(numGroups, totalStudents);
      finalGroupSize = Math.ceil(totalStudents / finalNumGroups);
    } else {
      // Only groupSize specified - create as many full groups as possible
      finalGroupSize = groupSize;
      finalNumGroups = Math.ceil(totalStudents / groupSize);
    }

    // Randomize if requested
    if (randomize) {
      students.sort(() => Math.random() - 0.5);
    }

    // Create groups with EXACT groupSize when both parameters specified
    const groups = [];
    let studentIndex = 0;
    const useExactSize = (numGroups && groupSize); // Both specified - use exact size

    for (let i = 0; i < finalNumGroups; i++) {
      // Calculate how many students this group should have
      let studentsForThisGroup;
      
      if (useExactSize) {
        // Use EXACT group size specified by user
        studentsForThisGroup = finalGroupSize;
      } else {
        // Auto-balance remaining students across remaining groups
        const remainingStudents = totalStudents - studentIndex;
        const remainingGroups = finalNumGroups - i;
        studentsForThisGroup = Math.ceil(remainingStudents / remainingGroups);
      }

      const groupId = generateGroupId();
      const groupStudents = students.slice(studentIndex, studentIndex + studentsForThisGroup);

      if (groupStudents.length > 0) {
        groups.push({
          groupId: groupId,
          groupNumber: i + 1,
          groupName: `Group ${i + 1}`,
          students: groupStudents
        });
        studentIndex += studentsForThisGroup;
      }
    }

    // If assignToGroups is true, update the database
    if (assignToGroups) {
      const bulkOps = [];
      const groupDocs = [];

      for (const group of groups) {
        // Create Group document
        groupDocs.push({
          name: group.groupName,
          students: group.students.map(s => s._id),
          mentor: null
        });

        // Update internships with group assignments
        for (const student of group.students) {
          bulkOps.push({
            updateOne: {
              filter: { _id: student._id },
              update: {
                $set: {
                  assignedGroup: group.groupId,
                  assignedGroupName: group.groupName
                }
              }
            }
          });
        }
      }

      // Save both internship updates and group documents
      if (bulkOps.length > 0) {
        await Internship.bulkWrite(bulkOps);
      }
      
      if (groupDocs.length > 0) {
        await Group.insertMany(groupDocs);
      }
    }

    res.json({
      success: true,
      data: {
        groups,
        totalStudents: students.length,
        totalGroups: groups.length,
        assigned: assignToGroups
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST check if student is already in a group
router.post('/check-assignment', async (req, res) => {
  try {
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

// POST unassign student from group
router.post('/unassign', async (req, res) => {
  try {
    const { uids } = req.body; // Array of UIDs to unassign

    // Get the group IDs of students being unassigned
    const studentsBeingUnassigned = await Internship.find(
      { uid: { $in: uids }, assignedGroup: { $ne: null, $ne: '' } }
    ).select('assignedGroup _id');

    const groupIds = [...new Set(studentsBeingUnassigned.map(s => s.assignedGroup))];
    const studentIds = studentsBeingUnassigned.map(s => s._id);

    // Unassign students from groups
    const result = await Internship.updateMany(
      { uid: { $in: uids } },
      { $set: { assignedGroup: null, assignedGroupName: null } }
    );

    // Remove students from Group documents and delete empty groups
    if (groupIds.length > 0) {
      // Remove students from groups
      await Group.updateMany(
        {},
        { $pull: { students: { $in: studentIds } } }
      );

      // Find groups that will be deleted to free their mentors
      const groupsToDelete = await Group.find({
        $or: [
          { students: { $exists: false } },
          { students: { $size: 0 } },
          { students: null }
        ]
      }).select('externalMentor internalMentor');

      // Get mentor IDs from groups being deleted
      const externalMentorIds = groupsToDelete
        .filter(g => g.externalMentor)
        .map(g => g.externalMentor);
      const internalMentorIds = groupsToDelete
        .filter(g => g.internalMentor)
        .map(g => g.internalMentor);

      // Delete groups that now have no students
      const deletedGroups = await Group.deleteMany({
        $or: [
          { students: { $exists: false } },
          { students: { $size: 0 } },
          { students: null }
        ]
      });

      // FREE UP MENTORS: Reset isAssigned to false for mentors whose groups were deleted
      let freedExternalMentors = 0;
      let freedInternalMentors = 0;
      if (externalMentorIds.length > 0) {
        const mentorUpdate = await Mentor.updateMany(
          { _id: { $in: externalMentorIds } },
          { $set: { isAssigned: false } }
        );
        freedExternalMentors = mentorUpdate.modifiedCount;
      }
      if (internalMentorIds.length > 0) {
        const internalMentorUpdate = await InternalMentor.updateMany(
          { _id: { $in: internalMentorIds } },
          { $set: { isAssigned: false } }
        );
        freedInternalMentors = internalMentorUpdate.modifiedCount;
      }

      res.json({
        success: true,
        message: `Unassigned ${result.modifiedCount} students from their groups`,
        count: result.modifiedCount,
        groupsDeleted: deletedGroups.deletedCount,
        externalMentorsFreed: freedExternalMentors,
        internalMentorsFreed: freedInternalMentors
      });
    } else {
      res.json({
        success: true,
        message: `Unassigned ${result.modifiedCount} students from their groups`,
        count: result.modifiedCount,
        groupsDeleted: 0,
        externalMentorsFreed: 0,
        internalMentorsFreed: 0
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST clear all groups (delete all Group documents and unassign all students)
router.post('/clear-all', async (req, res) => {
  try {
    // Delete all Group documents
    const deletedGroups = await Group.deleteMany({});
    
    // Unassign all students from groups
    const unassignedStudents = await Internship.updateMany(
      { assignedGroup: { $ne: null, $ne: '' } },
      { $set: { assignedGroup: null, assignedGroupName: null } }
    );

    // FREE UP ALL MENTORS: Reset all mentors to unassigned
    const freedExternalMentors = await Mentor.updateMany(
      { isAssigned: true },
      { $set: { isAssigned: false } }
    );
    const freedInternalMentors = await InternalMentor.updateMany(
      { isAssigned: true },
      { $set: { isAssigned: false } }
    );

    res.json({
      success: true,
      message: 'All groups cleared successfully',
      groupsDeleted: deletedGroups.deletedCount,
      studentsUnassigned: unassignedStudents.modifiedCount,
      externalMentorsFreed: freedExternalMentors.modifiedCount,
      internalMentorsFreed: freedInternalMentors.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all groups (list of unique groups)
router.get('/list', async (req, res) => {
  try {
    const groups = await Internship.aggregate([
      {
        $match: {
          assignedGroup: { $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$assignedGroup',
          groupName: { $first: '$assignedGroupName' },
          studentCount: { $sum: 1 },
          students: {
            $push: {
              uid: '$uid',
              name: '$name',
              branch: '$branch',
              company: '$companyName'
            }
          }
        }
      },
      { $sort: { groupName: 1 } }
    ]);

    res.json({
      success: true,
      data: groups,
      count: groups.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST export ALL groups to Excel with EXACT format
router.post('/export', async (req, res) => {
  try {
    console.log('📥 Export request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { groups } = req.body;

    if (!groups || !Array.isArray(groups)) {
      console.error('❌ Invalid groups data:', groups);
      return res.status(400).json({ success: false, message: 'Invalid groups data' });
    }

    console.log(`✅ Processing ${groups.length} groups for export`);

    const wb = xlsx.utils.book_new();

    // Fetch mentor info for all groups
    const groupsWithMentors = await Promise.all(
      groups.map(async (group) => {
        let mentorName = 'Not Assigned';
        
        if (group._id) {
          const dbGroup = await Group.findById(group._id).populate('mentor', 'name');
          if (dbGroup && dbGroup.mentor) {
            mentorName = dbGroup.mentor.name;
          }
        }
        
        return { ...group, mentorName };
      })
    );

    groupsWithMentors.forEach((group, idx) => {
      console.log(`Processing group ${idx + 1}:`, group.groupName || group.groupNumber);

      if (!group.students || !Array.isArray(group.students)) {
        console.error(`❌ Group ${idx + 1} has invalid students data`);
        throw new Error(`Group ${idx + 1} has invalid students data`);
      }

      // EXACT FORMAT: Student Name, UID, Branch, Institute Email, Mentor Name
      const sheetData = group.students.map((student, index) => ({
        'Student Name': student.name || '',
        'UID': student.uid || '',
        'Branch': student.branch || '',
        'Institute Email': student.email || '',
        'Mentor Name': group.mentorName
      }));

      const ws = xlsx.utils.json_to_sheet(sheetData);
      
      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 25 }, // Student Name
        { wch: 12 }, // UID
        { wch: 15 }, // Branch
        { wch: 30 }, // Institute Email
        { wch: 20 }  // Mentor Name
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
    const { group } = req.body;

    if (!group || !group.students) {
      return res.status(400).json({ success: false, message: 'Invalid group data' });
    }

    // Fetch mentor info for this group
    let mentorName = 'Not Assigned';
    if (group._id) {
      const dbGroup = await Group.findById(group._id).populate('mentor', 'name');
      if (dbGroup && dbGroup.mentor) {
        mentorName = dbGroup.mentor.name;
      }
    }

    // EXACT FORMAT: Student Name, UID, Branch, Institute Email, Mentor Name
    const sheetData = group.students.map((student, index) => ({
      'Student Name': student.name || '',
      'UID': student.uid || '',
      'Branch': student.branch || '',
      'Institute Email': student.email || '',
      'Mentor Name': mentorName
    }));

    const ws = xlsx.utils.json_to_sheet(sheetData);
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // Student Name
      { wch: 12 }, // UID
      { wch: 15 }, // Branch
      { wch: 30 }, // Institute Email
      { wch: 20 }  // Mentor Name
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
    const {
      filters = {},
      count = 1
    } = req.body;

    // Build query from filters (all case-insensitive)
    let query = {};
    if (filters.branch) query['branch'] = new RegExp(`^${filters.branch}$`, 'i');
    if (filters.company) query['companyName'] = new RegExp(filters.company, 'i');
    if (filters.status) query['status'] = new RegExp(`^${filters.status}$`, 'i');

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
    const shuffled = internships.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, internships.length));

    const students = picked.map(i => ({
      name: i.name,
      email: i.email,
      uid: i.uid,
      branch: i.branch,
      company: i.companyName,
      internshipTitle: i.internshipTitle || 'Intern',
      internshipType: i.internshipType,
      status: i.status,
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
      'Status': student.status,
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
    const shuffledMentors = availableMentors.sort(() => Math.random() - 0.5);
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
      message: `Successfully allocated external mentors to ${allocations.length} groups${
        canAllocateUniquely ? ' (unique mentors per group)' : ' (some mentors assigned to multiple groups)'
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
    const shuffledMentors = availableMentors.sort(() => Math.random() - 0.5);
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
      message: `Successfully allocated internal mentors to ${allocations.length} groups${
        canAllocateUniquely ? ' (unique mentors per group)' : ' (some mentors assigned to multiple groups)'
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
    const groups = await Group.find()
      .populate('externalMentor', 'name email')
      .populate('internalMentor', 'name email')
      .populate('students', 'uid name branch companyName email')
      .sort({ name: 1 });

    const formattedGroups = groups.map(group => ({
      _id: group._id,
      groupName: group.name,
      externalMentor: group.externalMentor ? {
        _id: group.externalMentor._id,
        name: group.externalMentor.name,
        email: group.externalMentor.email
      } : null,
      internalMentor: group.internalMentor ? {
        _id: group.internalMentor._id,
        name: group.internalMentor.name,
        email: group.internalMentor.email
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
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [], count: 0 });
    }

    const searchRegex = new RegExp(query, 'i');

    // Find all groups and populate
    const allGroups = await Group.find()
      .populate('externalMentor', 'name email')
      .populate('internalMentor', 'name email')
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
      externalMentor: group.externalMentor ? {
        _id: group.externalMentor._id,
        name: group.externalMentor.name,
        email: group.externalMentor.email
      } : null,
      internalMentor: group.internalMentor ? {
        _id: group.internalMentor._id,
        name: group.internalMentor.name,
        email: group.internalMentor.email
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
router.put('/:id', async (req, res) => {
  try {
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
      // Free old external mentor if exists
      if (oldExternalMentor) {
        await Mentor.findByIdAndUpdate(oldExternalMentor, { isAssigned: false });
      }
      
      // Assign new external mentor
      if (externalMentor) {
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
      // Free old internal mentor if exists
      if (oldInternalMentor) {
        await InternalMentor.findByIdAndUpdate(oldInternalMentor, { isAssigned: false });
      }
      
      // Assign new internal mentor
      if (internalMentor) {
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
