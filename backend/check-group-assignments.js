const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function checkGroupAssignments() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Check for students with assigned groups
    const assignedCount = await Internship.countDocuments({
      assignedGroup: { $ne: null, $ne: '', $exists: true }
    });

    console.log(`\n📊 Students with assigned groups: ${assignedCount}`);

    if (assignedCount > 0) {
      // Get list of unique groups
      const groups = await Internship.aggregate([
        {
          $match: {
            assignedGroup: { $ne: null, $ne: '', $exists: true }
          }
        },
        {
          $group: {
            _id: '$assignedGroup',
            groupName: { $first: '$assignedGroupName' },
            studentCount: { $sum: 1 },
            students: { $push: '$name' }
          }
        },
        { $sort: { groupName: 1 } }
      ]);

      console.log(`\n📊 Total unique groups: ${groups.length}`);
      console.log('\n📋 Groups found:');
      groups.slice(0, 10).forEach(g => {
        console.log(`   - ${g.groupName || 'Unnamed'}: ${g.studentCount} students`);
      });

      if (groups.length > 10) {
        console.log(`   ... and ${groups.length - 10} more groups`);
      }
    } else {
      console.log('\n⚠️  No students are assigned to any groups!');
      console.log('This means when you created groups in the website,');
      console.log('they were NOT saved to the database.');
    }

    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

checkGroupAssignments();
