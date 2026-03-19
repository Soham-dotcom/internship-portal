const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

async function testNewDistribution() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/internship_portal');
    console.log('Connected to DB\n');

    const invalidCompanies = ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'];
    
    // Check profile distribution
    const profileStats = await Internship.aggregate([
      {
        $match: {
          companyName: { 
            $nin: invalidCompanies,
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $group: {
          _id: '$profile',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('Profile Distribution (with valid companies):');
    profileStats.forEach(stat => {
      console.log(`  "${stat._id}": ${stat.count}`);
    });

    // Tech vs Non-Tech with profile field
    const techNonTechDist = await Internship.aggregate([
      {
        $match: {
          companyName: { 
            $nin: invalidCompanies,
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
          uniqueStudents: { $addToSet: '$uid' }
        }
      },
      {
        $project: {
          _id: 1,
          count: { $size: '$uniqueStudents' }
        }
      }
    ]);

    let techCount = 0;
    let nonTechCount = 0;

    techNonTechDist.forEach(item => {
      const profile = (item._id || '').toLowerCase().trim();
      if (!profile) return;
      
      if (profile === 'tech' || profile === 'technical') {
        techCount += item.count;
      } else if (profile === 'non tech' || profile === 'non-tech' || profile === 'nontech') {
        nonTechCount += item.count;
      }
    });

    const total = techCount + nonTechCount;
    console.log('\n✅ CORRECTED Tech vs Non-Tech Distribution:');
    console.log(`  Tech: ${techCount} (${(techCount/total*100).toFixed(2)}%)`);
    console.log(`  Non-Tech: ${nonTechCount} (${(nonTechCount/total*100).toFixed(2)}%)`);
    console.log(`  Total: ${total}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNewDistribution();
