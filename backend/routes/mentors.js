const express = require('express');

const { getYearDb } = require('../db/connection');
const { getMentorModel } = require('../models/Mentor');
const { getInternalMentorModel } = require('../models/InternalMentor');
const { getGroupModel } = require('../models/Group');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  // Simple, pragmatic validation (server still relies on uniqueness + required)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveMentorModel(type, req) {
  const db = getYearDb(req.year);
  return type === 'internal' ? getInternalMentorModel(db) : getMentorModel(db);
}

async function buildMentorDetails(type, req) {
  const db = getYearDb(req.year);
  const Model = resolveMentorModel(type, req);
  const Group = getGroupModel(db);
  const mentors = await Model.find().sort({ name: 1 });

  const mentorsWithDetails = await Promise.all(
    mentors.map(async (mentor) => {
      const groupQuery = type === 'internal'
        ? { internalMentor: mentor._id }
        : { externalMentor: mentor._id };

      const assignedGroups = await Group.find(groupQuery).populate('students', 'name uid');
      const studentsHandled = assignedGroups.reduce((sum, group) => sum + group.students.length, 0);

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
        type
      };
    })
  );

  return mentorsWithDetails;
}

// GET /api/mentors?type=external|internal
router.get('/', async (req, res) => {
  try {
    const type = (req.query.type || 'external') === 'internal' ? 'internal' : 'external';
    const data = await buildMentorDetails(type, req);
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/mentors
router.post('/', async (req, res) => {
  try {
    const type = (req.body.type || 'external') === 'internal' ? 'internal' : 'external';
    const Model = resolveMentorModel(type, req);
    const db = getYearDb(req.year);
    const Mentor = getMentorModel(db);
    const InternalMentor = getInternalMentorModel(db);

    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Prevent duplicates across BOTH collections
    const [existingExternal, existingInternal] = await Promise.all([
      Mentor.findOne({ email }),
      InternalMentor.findOne({ email })
    ]);
    if (existingExternal || existingInternal) {
      return res.status(409).json({ success: false, message: 'Mentor with this email already exists' });
    }

    const mentor = await Model.create({ name, email });
    res.status(201).json({ success: true, message: 'Mentor added successfully', data: mentor });
  } catch (error) {
    // Handle duplicate key error just in case
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mentor with this email already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/mentors/:id
router.put('/:id', async (req, res) => {
  try {
    const type = (req.body.type || req.query.type || 'external') === 'internal' ? 'internal' : 'external';
    const Model = resolveMentorModel(type, req);
    const db = getYearDb(req.year);
    const Mentor = getMentorModel(db);
    const InternalMentor = getInternalMentorModel(db);
    const Group = getGroupModel(db);

    const mentorId = req.params.id;
    const existing = await Model.findById(mentorId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Mentor not found' });
    }

    const update = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      update.name = name;
    }

    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }

      // Prevent duplicates across BOTH collections (excluding current doc)
      const [externalDup, internalDup] = await Promise.all([
        Mentor.findOne({ email, _id: { $ne: mentorId } }),
        InternalMentor.findOne({ email, _id: { $ne: mentorId } })
      ]);
      if (externalDup || internalDup) {
        return res.status(409).json({ success: false, message: 'Mentor with this email already exists' });
      }

      update.email = email;
    }

    // Optional: allow toggling isAssigned only when it won't conflict with group assignments
    if (req.body.isAssigned !== undefined) {
      const desired = Boolean(req.body.isAssigned);
      const groupQuery = type === 'internal'
        ? { internalMentor: existing._id }
        : { externalMentor: existing._id };
      const groupCount = await Group.countDocuments(groupQuery);

      if (groupCount > 0) {
        update.isAssigned = true; // must remain assigned if groups exist
      } else {
        update.isAssigned = desired;
      }
    }

    const updated = await Model.findByIdAndUpdate(mentorId, { $set: update }, { new: true, runValidators: true });
    res.json({ success: true, message: 'Mentor updated successfully', data: updated });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mentor with this email already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
