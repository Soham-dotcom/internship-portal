const express = require('express');
const router = express.Router();
const Internship = require('../models/Internship');

// GET advanced analytics with multi-filter support
router.get('/', async (req, res) => {
  try {
    const {
      minSalary,
      maxSalary,
      internshipType,
      branch,
      minDuration,
      maxDuration,
      company,
      minStudents,
      status
    } = req.query;

    // Build dynamic query (all case-insensitive)
    let query = {};
    
    if (minSalary || maxSalary) {
      query.salary = {};
      if (minSalary) query.salary.$gte = parseInt(minSalary);
      if (maxSalary) query.salary.$lte = parseInt(maxSalary);
    }
    
    if (internshipType) query.internshipType = new RegExp(`^${internshipType}$`, 'i');
    if (branch) query.branch = new RegExp(`^${branch}$`, 'i');
    if (status) query.status = new RegExp(`^${status}$`, 'i');
    if (company) query.companyName = new RegExp(company, 'i');
    
    if (minDuration || maxDuration) {
      query.duration = {};
      if (minDuration) query.duration.$gte = parseInt(minDuration);
      if (maxDuration) query.duration.$lte = parseInt(maxDuration);
    }

    // Get filtered data
    const internships = await Internship.find(query);

    // 1. Salary Distribution
    const salaryRanges = {
      '0-10k': 0,
      '10k-20k': 0,
      '20k-30k': 0,
      '30k-50k': 0,
      '50k+': 0
    };

    internships.forEach(i => {
      const salary = i.salary || 0;
      if (salary < 10000) salaryRanges['0-10k']++;
      else if (salary < 20000) salaryRanges['10k-20k']++;
      else if (salary < 30000) salaryRanges['20k-30k']++;
      else if (salary < 50000) salaryRanges['30k-50k']++;
      else salaryRanges['50k+']++;
    });

    // 2. Top Companies by Hiring (with salary info)
    const companyStats = {};
    
    internships.forEach(i => {
      if (!i.companyName) return;
      
      if (!companyStats[i.companyName]) {
        companyStats[i.companyName] = {
          name: i.companyName,
          studentCount: 0,
          totalSalary: 0,
          avgSalary: 0,
          maxSalary: 0,
          minSalary: Infinity,
          branches: new Set(),
          internshipTypes: new Set()
        };
      }
      
      const stats = companyStats[i.companyName];
      stats.studentCount++;
      stats.totalSalary += (i.salary || 0);
      stats.maxSalary = Math.max(stats.maxSalary, i.salary || 0);
      stats.minSalary = Math.min(stats.minSalary, i.salary || Infinity);
      if (i.branch) stats.branches.add(i.branch);
      if (i.internshipType) stats.internshipTypes.add(i.internshipType);
    });

    // Calculate averages and combined impact
    Object.values(companyStats).forEach(stats => {
      stats.avgSalary = stats.studentCount > 0 
        ? Math.round(stats.totalSalary / stats.studentCount) 
        : 0;
      stats.combinedImpact = stats.avgSalary * stats.studentCount; // Salary × hires
      stats.branches = Array.from(stats.branches);
      stats.internshipTypes = Array.from(stats.internshipTypes);
      stats.minSalary = stats.minSalary === Infinity ? 0 : stats.minSalary;
    });

    // Sort and get top companies
    const topCompaniesByHiring = Object.values(companyStats)
      .sort((a, b) => b.studentCount - a.studentCount)
      .slice(0, 10);

    const topCompaniesBySalary = Object.values(companyStats)
      .sort((a, b) => b.avgSalary - a.avgSalary)
      .slice(0, 10);

    const topCompaniesByImpact = Object.values(companyStats)
      .sort((a, b) => b.combinedImpact - a.combinedImpact)
      .slice(0, 10);

    // Filter by minStudents if specified
    let filteredCompanyStats = Object.values(companyStats);
    if (minStudents) {
      filteredCompanyStats = filteredCompanyStats.filter(
        c => c.studentCount >= parseInt(minStudents)
      );
    }

    // 3. Branch-wise Distribution
    const branchStats = {};
    internships.forEach(i => {
      if (!i.branch) return;
      if (!branchStats[i.branch]) {
        branchStats[i.branch] = {
          branch: i.branch,
          count: 0,
          totalSalary: 0,
          avgSalary: 0,
          companies: new Set()
        };
      }
      branchStats[i.branch].count++;
      branchStats[i.branch].totalSalary += (i.salary || 0);
      if (i.companyName) branchStats[i.branch].companies.add(i.companyName);
    });

    Object.values(branchStats).forEach(stats => {
      stats.avgSalary = stats.count > 0 
        ? Math.round(stats.totalSalary / stats.count) 
        : 0;
      stats.uniqueCompanies = stats.companies.size;
      delete stats.companies;
    });

    // 4. Internship Type Distribution
    const typeStats = {};
    internships.forEach(i => {
      const type = i.internshipType || 'Unknown';
      if (!typeStats[type]) {
        typeStats[type] = {
          type,
          count: 0,
          totalSalary: 0,
          avgSalary: 0
        };
      }
      typeStats[type].count++;
      typeStats[type].totalSalary += (i.salary || 0);
    });

    Object.values(typeStats).forEach(stats => {
      stats.avgSalary = stats.count > 0 
        ? Math.round(stats.totalSalary / stats.count) 
        : 0;
    });

    // 5. Duration Analysis
    const durationStats = {
      '0-3 months': 0,
      '3-6 months': 0,
      '6-12 months': 0,
      '12+ months': 0
    };

    internships.forEach(i => {
      const duration = i.duration || 0;
      if (duration <= 3) durationStats['0-3 months']++;
      else if (duration <= 6) durationStats['3-6 months']++;
      else if (duration <= 12) durationStats['6-12 months']++;
      else durationStats['12+ months']++;
    });

    // 6. Overall Statistics
    const totalStudents = internships.length;
    const totalSalary = internships.reduce((sum, i) => sum + (i.salary || 0), 0);
    const avgSalary = totalStudents > 0 ? Math.round(totalSalary / totalStudents) : 0;
    const overallMaxSalary = Math.max(...internships.map(i => i.salary || 0), 0);
    const overallMinSalary = Math.min(...internships.filter(i => i.salary > 0).map(i => i.salary), 0) || 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalCompanies: Object.keys(companyStats).length,
          avgSalary,
          maxSalary: overallMaxSalary,
          minSalary: overallMinSalary,
          totalSalaryOffered: totalSalary
        },
        salaryDistribution: Object.entries(salaryRanges).map(([range, count]) => ({
          range,
          count,
          percentage: totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : 0
        })),
        topCompaniesByHiring,
        topCompaniesBySalary,
        topCompaniesByImpact,
        allCompanies: filteredCompanyStats.sort((a, b) => b.combinedImpact - a.combinedImpact),
        branchStats: Object.values(branchStats).sort((a, b) => b.count - a.count),
        internshipTypeStats: Object.values(typeStats).sort((a, b) => b.count - a.count),
        durationStats: Object.entries(durationStats).map(([duration, count]) => ({
          duration,
          count,
          percentage: totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : 0
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET filter options (for dropdowns)
router.get('/filters', async (req, res) => {
  try {
    const companies = await Internship.distinct('companyName');
    const branches = await Internship.distinct('branch');
    const types = await Internship.distinct('internshipType');
    const statuses = await Internship.distinct('status');

    // Get salary range
    const salaryStats = await Internship.aggregate([
      {
        $group: {
          _id: null,
          minSalary: { $min: '$salary' },
          maxSalary: { $max: '$salary' }
        }
      }
    ]);

    // Get duration range
    const durationStats = await Internship.aggregate([
      {
        $group: {
          _id: null,
          minDuration: { $min: '$duration' },
          maxDuration: { $max: '$duration' }
        }
      }
    ]);

    res.json({
      success: true,
      filters: {
        companies: companies.filter(c => c),
        branches: branches.filter(b => b),
        internshipTypes: types.filter(t => t),
        statuses: statuses.filter(s => s),
        salaryRange: salaryStats[0] || { minSalary: 0, maxSalary: 100000 },
        durationRange: durationStats[0] || { minDuration: 0, maxDuration: 12 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

