const express = require('express');
const router = express.Router();
const { getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { getGroupModel } = require('../models/Group');
const { normalizeCompanyName } = require('../utils/companyNormalization');

// GET company-wise hiring statistics (FIXED - no duplicates)
router.get('/companies', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    // Group by exact company name and count unique UIDs
    const companyStats = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$standardized_company_name',
          uniqueStudents: { $addToSet: '$uid' }, // Get unique UIDs
          location: { $first: '$companyLocation' },
          students: { $addToSet: '$name' },
          companyName: { $first: '$companyName' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' }, // Count unique students
          location: 1,
          students: 1,
          companyName: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: companyStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET branch distribution (FIXED - no duplicates)
router.get('/branches', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const branchStats = await Internship.aggregate([
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

    res.json({ success: true, data: branchStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET mentor-wise student distribution
router.get('/mentors', async (req, res) => {
  try {
    const Group = getGroupModel(getYearDb(req.year));
    const mentorStats = await Group.aggregate([
      {
        $lookup: {
          from: 'mentors',
          localField: 'mentor',
          foreignField: '_id',
          as: 'mentorDetails'
        }
      },
      { $unwind: { path: '$mentorDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$mentorDetails.name',
          studentCount: { $sum: { $size: '$students' } },
          groupCount: { $sum: 1 }
        }
      },
      {
        $match: {
          _id: { $ne: null }
        }
      },
      { $sort: { studentCount: -1 } },
      { $limit: 10 }
    ]);

    res.json({ 
      success: true, 
      data: mentorStats.map(m => ({
        _id: m._id,
        count: m.studentCount,
        groups: m.groupCount
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET branch distribution within each company (FIXED - no duplicates)
router.get('/companies/branches', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const companyBranchStats = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: {
            company: '$standardized_company_name',
            branch: '$branch'
          },
          uniqueStudents: { $addToSet: '$uid' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' }
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
    const Internship = getInternshipModel(getYearDb(req.year));
    const stipendStats = await Internship.aggregate([
      {
        $match: {
          'stipend': { $ne: '' }
        }
      },
      {
        $group: {
          _id: '$standardized_company_name',
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

// GET internship type distribution (FIXED - no duplicates)
router.get('/types', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const typeStats = await Internship.aggregate([
      {
        $group: {
          _id: '$internshipType',
          uniqueStudents: { $addToSet: '$uid' },
          companies: { $addToSet: '$standardized_company_name' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' },
          companies: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: typeStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET comprehensive summary (FIXED - no duplicates)
router.get('/summary', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const [
      companyStats,
      branchStats,
      statusStats,
      typeStats
    ] = await Promise.all([
      Internship.aggregate([
        {
          $match: {
            standardized_company_name: {
              $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
              $exists: true,
              $ne: null
            }
          }
        },
        { 
          $group: { 
            _id: '$standardized_company_name', 
            uniqueStudents: { $addToSet: '$uid' } 
          } 
        },
        { 
          $project: { 
            _id: 1, 
            count: { $size: '$uniqueStudents' } 
          } 
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Internship.aggregate([
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
        }
      ]),
      Internship.aggregate([
        { 
          $group: { 
            _id: '$status', 
            uniqueStudents: { $addToSet: '$uid' } 
          } 
        },
        { 
          $project: { 
            _id: 1, 
            count: { $size: '$uniqueStudents' } 
          } 
        }
      ]),
      Internship.aggregate([
        { 
          $group: { 
            _id: '$internshipType', 
            uniqueStudents: { $addToSet: '$uid' } 
          } 
        },
        { 
          $project: { 
            _id: 1, 
            count: { $size: '$uniqueStudents' } 
          } 
        }
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

// SEARCH for a company by name with autocomplete
router.get('/companies/search', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const { name } = req.query;
    if (!name) return res.json({ success: true, data: [] });

    const query = normalizeCompanyName(name);
    const companies = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $regex: query,
            $options: 'i',
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a']
          }
        }
      },
      {
        $group: {
          _id: '$standardized_company_name',
          location: { $first: '$companyLocation' },
          count: { $sum: 1 },
          companyName: { $first: '$companyName' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET detailed information for a company
router.get('/companies/details/:name', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const companyName = req.params.name;
    const normalizedCompany = normalizeCompanyName(companyName);
    
    // Use aggregation to find the most frequent location for this company as the "canonical" location
    const locationAggregation = await Internship.aggregate([
      { $match: { standardized_company_name: normalizedCompany } },
      { $group: { _id: '$companyLocation', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    
    const canonicalLocation = locationAggregation.length > 0 ? locationAggregation[0]._id : 'Unknown';

    const [
      students,
      roles,
      status,
      yearlyPlacements
    ] = await Promise.all([
      // Get all student details
      Internship.find({ standardized_company_name: normalizedCompany })
        .select('name uid branch internshipTitle status startDate endDate duration stipend'),
      
      // Aggregate roles
      Internship.aggregate([
        { $match: { standardized_company_name: normalizedCompany } },
        { $group: { _id: '$internshipTitle', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Aggregate status
      Internship.aggregate([
        { $match: { standardized_company_name: normalizedCompany } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Aggregate yearly trends (if startDate exists)
      Internship.aggregate([
        {
          $match: {
            standardized_company_name: normalizedCompany,
            startDate: { $ne: null }
          }
        },
        { $group: { _id: { $year: '$startDate' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        details: {
          companyName: companyName,
          companyLocation: canonicalLocation,
          totalStudents: students.length
        },
        students,
        roles,
        status,
        yearlyPlacements
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Tech vs Non-Tech distribution (FIXED - no duplicates)
router.get('/tech-distribution', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const distribution = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          },
          profile: { 
            $nin: ['', ' ', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$profile',
          uniqueStudents: { $addToSet: '$uid' },
          students: { 
            $addToSet: {
              name: '$name',
              company: '$companyName',
              title: '$internshipTitle'
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' },
          students: 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Categorize as Tech or Non-Tech based on profile field
    let techCount = 0;
    let nonTechCount = 0;

    distribution.forEach(item => {
      const profile = (item._id || '').toLowerCase().trim();
      // Skip empty profiles
      if (!profile) return;
      
      if (profile === 'tech' || profile === 'technical') {
        techCount += item.count;
      } else if (profile === 'non tech' || profile === 'non-tech' || profile === 'nontech') {
        nonTechCount += item.count;
      }
    });

    res.json({
      success: true,
      data: {
        tech: techCount,
        nonTech: nonTechCount,
        breakdown: distribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET position distribution (tech positions)
router.get('/positions/tech', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const positions = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          },
          profile: { $regex: /^tech$/i },
          internshipTitle: { 
            $nin: ['', ' ', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$internshipTitle',
          uniqueStudents: { $addToSet: '$uid' },
          companies: { $addToSet: '$companyName' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' },
          companies: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET position distribution (non-tech positions) (FIXED - no duplicates)
router.get('/positions/non-tech', async (req, res) => {
  try {
    const Internship = getInternshipModel(getYearDb(req.year));
    const positions = await Internship.aggregate([
      {
        $match: {
          standardized_company_name: {
            $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          },
          profile: { $regex: /^non.{0,1}tech$/i },
          internshipTitle: { 
            $nin: ['', ' ', '-', 'N/A', 'n/a'],
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$internshipTitle',
          uniqueStudents: { $addToSet: '$uid' },
          companies: { $addToSet: '$companyName' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' },
          companies: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;


