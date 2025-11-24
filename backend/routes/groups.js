const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const Internship = require('../models/Internship');
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

    // Build query from filters
    let query = {};
    if (filters.branch) query['branch'] = filters.branch;
    if (filters.company) query['companyName'] = new RegExp(filters.company, 'i');
    if (filters.status) query['status'] = filters.status;
    
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

    // Case 1: Both specified - check for conflicts
    if (numGroups && groupSize) {
      const requiredStudents = numGroups * groupSize;
      
      if (requiredStudents > totalStudents) {
        // Impossible: Not enough students
        return res.status(400).json({
          success: false,
          message: `Cannot create ${numGroups} groups with ${groupSize} students each. You only have ${totalStudents} unassigned students. Required: ${requiredStudents}.`,
          suggestion: `Try ${Math.floor(totalStudents / groupSize)} groups with ${groupSize} students, or ${numGroups} groups with ${Math.floor(totalStudents / numGroups)} students each.`
        });
      }
      
      // Use numGroups as priority, auto-balance
      finalNumGroups = numGroups;
      finalGroupSize = Math.ceil(totalStudents / numGroups);
    } else if (numGroups) {
      // Only numGroups specified
      finalNumGroups = Math.min(numGroups, totalStudents);
      finalGroupSize = Math.ceil(totalStudents / finalNumGroups);
    } else {
      // Only groupSize specified
      finalGroupSize = groupSize;
      finalNumGroups = Math.ceil(totalStudents / groupSize);
    }

    // Randomize if requested
    if (randomize) {
      students.sort(() => Math.random() - 0.5);
    }

    // Create AUTO-BALANCED groups
    const groups = [];
    let studentIndex = 0;
    
    for (let i = 0; i < finalNumGroups; i++) {
      // Calculate how many students this group should have
      const remainingStudents = totalStudents - studentIndex;
      const remainingGroups = finalNumGroups - i;
      const studentsForThisGroup = Math.ceil(remainingStudents / remainingGroups);
      
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
      
      for (const group of groups) {
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

      if (bulkOps.length > 0) {
        await Internship.bulkWrite(bulkOps);
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

    const result = await Internship.updateMany(
      { uid: { $in: uids } },
      { $set: { assignedGroup: null, assignedGroupName: null } }
    );

    res.json({
      success: true,
      message: `Unassigned ${result.modifiedCount} students from their groups`,
      count: result.modifiedCount
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

// POST export ALL groups to Excel
router.post('/export', async (req, res) => {
  try {
    const { groups } = req.body;

    if (!groups || !Array.isArray(groups)) {
      return res.status(400).json({ success: false, message: 'Invalid groups data' });
    }

    const wb = xlsx.utils.book_new();

    groups.forEach(group => {
      const sheetData = group.students.map((student, index) => ({
        'Sr. No': index + 1,
        'Name': student.name || '',
        'UID': student.uid || '',
        'Email': student.email || '',
        'Branch': student.branch || '',
        'Company Name': student.company || '',
        'Internship Type': student.internshipType || '',
        'Internship Title': student.internshipTitle || '',
        'External Mentor': student.externalMentorName || '',
        'Start Date': student.startDate ? new Date(student.startDate).toLocaleDateString() : '',
        'End Date': student.endDate ? new Date(student.endDate).toLocaleDateString() : '',
        'Status': student.status || '',
        'Salary': student.salary || '',
        'Document Link': student.documentLink || ''
      }));

      const ws = xlsx.utils.json_to_sheet(sheetData);
      const sheetName = group.groupName || `Group ${group.groupNumber}`;
      xlsx.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel sheet name limit
    });

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=student_groups.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST export SINGLE group to Excel
router.post('/export-single', async (req, res) => {
  try {
    const { group } = req.body;

    if (!group || !group.students) {
      return res.status(400).json({ success: false, message: 'Invalid group data' });
    }

    const sheetData = group.students.map((student, index) => ({
      'Sr. No': index + 1,
      'Name': student.name || '',
      'UID': student.uid || '',
      'Email': student.email || '',
      'Branch': student.branch || '',
      'Company Name': student.company || '',
      'Internship Type': student.internshipType || '',
      'Internship Title': student.internshipTitle || '',
      'External Mentor': student.externalMentorName || '',
      'Start Date': student.startDate ? new Date(student.startDate).toLocaleDateString() : '',
      'End Date': student.endDate ? new Date(student.endDate).toLocaleDateString() : '',
      'Status': student.status || '',
      'Salary': student.salary || '',
      'Document Link': student.documentLink || ''
    }));

    const ws = xlsx.utils.json_to_sheet(sheetData);
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

module.exports = router;
