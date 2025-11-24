const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');

// GET single internship by UID for editing
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const internship = await Internship.findOne({ uid });

    if (!internship) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found with this UID' 
      });
    }

    res.json({
      success: true,
      data: internship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update internship by UID
router.put('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    // Prevent UID change
    if (updates.uid && updates.uid !== uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot change UID of existing record' 
      });
    }

    const internship = await Internship.findOneAndUpdate(
      { uid },
      { $set: updates },
      { 
        new: true, 
        runValidators: false // Allow empty fields
      }
    );

    if (!internship) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found with this UID' 
      });
    }

    res.json({
      success: true,
      message: 'Student record updated successfully',
      data: internship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE internship by UID
router.delete('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const internship = await Internship.findOneAndDelete({ uid });

    if (!internship) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found with this UID' 
      });
    }

    res.json({
      success: true,
      message: 'Student record deleted successfully',
      data: internship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new internship record
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Check if UID already exists
    const existing = await Internship.findOne({ uid: data.uid });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `Student with UID ${data.uid} already exists` 
      });
    }

    const internship = new Internship(data);
    await internship.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: 'Student record created successfully',
      data: internship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH update specific fields by UID
router.patch('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    // Prevent UID change
    delete updates.uid;

    const internship = await Internship.findOneAndUpdate(
      { uid },
      { $set: updates },
      { 
        new: true, 
        runValidators: false
      }
    );

    if (!internship) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found with this UID' 
      });
    }

    res.json({
      success: true,
      message: 'Student fields updated successfully',
      data: internship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;




