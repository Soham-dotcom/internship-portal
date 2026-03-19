const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

async function checkAnalytics() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/internship_portal');
    console.log('Connected to DB\n');

    const total = await Internship.countDocuments();
    console.log('Total students:', total);

    const invalidCompanies = ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'];
    
    const withValidCompany = await Internship.countDocuments({
      companyName: { 
        $nin: invalidCompanies,
        $exists: true,
        $ne: null
      }
    });
    console.log('Students with valid company:', withValidCompany);

    const withoutValidCompany = total - withValidCompany;
    console.log('Students WITHOUT valid company (excluded):', withoutValidCompany);

    // Check internshipTitle distribution
    const titleStats = await Internship.aggregate([
      {
        $group: {
          _id: '$internshipTitle',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\nInternship Title Distribution:');
    titleStats.slice(0, 10).forEach(stat => {
      console.log(`  "${stat._id}": ${stat.count}`);
    });

    // Check with valid company filter
    const titleStatsFiltered = await Internship.aggregate([
      {
        $match: {
          companyName: { 
            $nin: invalidCompanies,
            $exists: true,
            $ne: null
          },
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
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\nInternship Title Distribution (FILTERED - valid companies AND titles):');
    titleStatsFiltered.slice(0, 10).forEach(stat => {
      console.log(`  "${stat._id}": ${stat.count}`);
    });

    // Tech vs Non-Tech
    let techCount = 0;
    let nonTechCount = 0;
    const techKeywords = ['tech', 'technical', 'software', 'developer', 'engineer'];
    
    titleStatsFiltered.forEach(item => {
      const title = (item._id || '').toLowerCase();
      if (!title || title.trim() === '') return; // Skip empty
      
      const isTech = techKeywords.some(keyword => title.includes(keyword));
      
      if (isTech) {
        techCount += item.count;
      } else {
        nonTechCount += item.count;
      }
    });

    const totalFiltered = techCount + nonTechCount;
    console.log('\nTech vs Non-Tech (with valid companies AND titles):');
    console.log(`  Tech: ${techCount} (${(techCount/totalFiltered*100).toFixed(2)}%)`);
    console.log(`  Non-Tech: ${nonTechCount} (${(nonTechCount/totalFiltered*100).toFixed(2)}%)`);
    console.log(`  Total: ${totalFiltered}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAnalytics();
