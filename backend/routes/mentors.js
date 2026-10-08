const express = require('express');

const { getYearDb } = require('../db/connection');
const { getMentorModel } = require('../models/Mentor');
const { getInternalMentorModel } = require('../models/InternalMentor');
const { getGroupModel } = require('../models/Group');
const { getInternshipModel } = require('../models/Internship');
const { audit } = require('../middleware/audit');

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
  const Internship = getInternshipModel(db);
  const field = type === 'internal' ? 'internalMentor' : 'externalMentor';

  // Three queries in total, however many mentors there are. This used to run one
  // populated query per mentor (~90 queries, ~1 s per page on production data).
  const mentors = await Model.find().sort({ name: 1 }).lean();
  const groups = await Group.find({ [field]: { $in: mentors.map((m) => m._id) } })
    .select(`name students ${field}`)
    .lean();
  // Only active students count: Recycle Bin students are excluded, as before.
  const activeIds = new Set((await Internship.find({ _id: { $in: groups.flatMap((g) => g.students) } })
    .select('_id')
    .lean()).map((s) => String(s._id)));

  const groupsByMentor = new Map();
  for (const group of groups) {
    const key = String(group[field]);
    const studentCount = group.students.filter((id) => activeIds.has(String(id))).length;
    if (!groupsByMentor.has(key)) groupsByMentor.set(key, []);
    groupsByMentor.get(key).push({ _id: group._id, name: group.name, studentCount });
  }

  return mentors.map((mentor) => {
    const assignedGroups = groupsByMentor.get(String(mentor._id)) || [];
    return {
      _id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      phone: mentor.phone,
      isAssigned: mentor.isAssigned,
      assignedGroups,
      groupCount: assignedGroups.length,
      studentsHandled: assignedGroups.reduce((sum, g) => sum + g.studentCount, 0),
      type,
    };
  });
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
router.post('/', audit('mentors.create', (req) => ({ type: req.body?.type, email: String(req.body?.email || '').trim().toLowerCase() })), async (req, res) => {
  try {
    const type = (req.body.type || 'external') === 'internal' ? 'internal' : 'external';
    const Model = resolveMentorModel(type, req);
    const db = getYearDb(req.year);
    const Mentor = getMentorModel(db);
    const InternalMentor = getInternalMentorModel(db);

    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = req.body.phone !== undefined ? String(req.body.phone ?? '') : '';

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

    const mentor = await Model.create({ name, email, phone });
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
router.put('/:id', audit('mentors.update', (req) => ({ mentorId: req.params.id, fields: Object.keys(req.body || {}).filter((k) => k !== 'type') })), async (req, res) => {
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

    if (req.body.phone !== undefined) {
      update.phone = String(req.body.phone ?? '');
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

// Exported for measurement and tests.
module.exports.buildMentorDetails = buildMentorDetails;
