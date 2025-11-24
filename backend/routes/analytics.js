const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');

// GET company-wise hiring statistics
router.get('/companies', async (req, res) => {
  try {
    const companyStats = await Internship.aggregate([
      {
        $group: {
          _id: '$companyName',
          count: { $sum: 1 },
          location: { $first: '$companyLocation' },
          students: { $push: '$name' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: companyStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET branch distribution
router.get('/branches', async (req, res) => {
  try {
    const branchStats = await Internship.aggregate([
      {
        $group: {
          _id: '$branch',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: branchStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET status distribution
router.get('/status', async (req, res) => {
  try {
    const statusStats = await Internship.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ success: true, data: statusStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET branch distribution within each company
router.get('/companies/branches', async (req, res) => {
  try {
    const companyBranchStats = await Internship.aggregate([
      {
        $group: {
          _id: {
            company: '$companyName',
            branch: '$branch'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.company',
          branches: {
            $push: {
              branch: '$_id.branch',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, data: companyBranchStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET stipend comparison
router.get('/stipends', async (req, res) => {
  try {
    const stipendStats = await Internship.aggregate([
      {
        $match: {
          'stipend': { $ne: '' }
        }
      },
      {
        $group: {
          _id: '$companyName',
          avgStipend: { 
            $avg: { 
              $toDouble: { 
                $replaceAll: { 
                  input: '$stipend', 
                  find: ',', 
                  replacement: '' 
                }
              }
            }
          },
          minStipend: { 
            $min: { 
              $toDouble: { 
                $replaceAll: { 
                  input: '$stipend', 
                  find: ',', 
                  replacement: '' 
                }
              }
            }
          },
          maxStipend: { 
            $max: { 
              $toDouble: { 
                $replaceAll: { 
                  input: '$stipend', 
                  find: ',', 
                  replacement: '' 
                }
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgStipend: -1 } }
    ]);

    res.json({ success: true, data: stipendStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET internship type distribution
router.get('/types', async (req, res) => {
  try {
    const typeStats = await Internship.aggregate([
      {
        $group: {
          _id: '$internshipType',
          count: { $sum: 1 },
          companies: { $addToSet: '$companyName' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: typeStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET comprehensive summary
router.get('/summary', async (req, res) => {
  try {
    const [
      companyStats,
      branchStats,
      statusStats,
      typeStats
    ] = await Promise.all([
      Internship.aggregate([
        { $group: { _id: '$company.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Internship.aggregate([
        { $group: { _id: '$student.branch', count: { $sum: 1 } } }
      ]),
      Internship.aggregate([
        { $group: { _id: '$internship.status', count: { $sum: 1 } } }
      ]),
      Internship.aggregate([
        { $group: { _id: '$internship.type', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        companies: companyStats,
        branches: branchStats,
        status: statusStats,
        types: typeStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

