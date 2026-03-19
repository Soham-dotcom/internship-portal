const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

async function checkProfiles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/internship_portal');
    console.log('Connected to DB\n');

    // Check actual internshipTitle values that contain "Tech" or "Non"
    const samples = await Internship.find({
      companyName: { 
        $nin: ['', ' ', 'Ineligible', 'ineligible', '-', 'N/A', 'n/a'],
        $exists: true,
        $ne: null
      }
    })
    .limit(20)
    .select('name companyName internshipTitle placementOffer');

    console.log('Sample entries:');
    samples.forEach(s => {
      console.log(`  ${s.name}: "${s.internshipTitle}" at ${s.companyName}`);
    });

    // Check if there are any with "Tech" or "Non Tech" as internshipTitle
    const techTitles = await Internship.countDocuments({
      internshipTitle: { $regex: /^(tech|non tech|non-tech)$/i }
    });
    
    console.log(`\nEntries with internshipTitle = "Tech" or "Non Tech": ${techTitles}`);

    // Check placementOffer field for Tech/Non Tech
    const withPlacementOffer = await Internship.aggregate([
      {
        $match: {
          placementOffer: { $ne: '' , $exists: true }
        }
      },
      {
        $group: {
          _id: '$placementOffer',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    console.log('\nTop Placement Offers:');
    withPlacementOffer.forEach(p => {
      console.log(`  "${p._id}": ${p.count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProfiles();
