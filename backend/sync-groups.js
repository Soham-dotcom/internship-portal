const mongoose = require('mongoose');
const Internship = require('./models/Internship');
const Group = require('./models/Group');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function syncGroups() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Clear existing groups collection
    const deletedCount = await Group.deleteMany({});
    console.log(`🗑️  Cleared ${deletedCount.deletedCount} existing groups`);

    // Aggregate internships by assignedGroup
    const groupAggregation = await Internship.aggregate([
      {
        $match: {
          assignedGroup: { $ne: null, $ne: '', $exists: true }
        }
      },
      {
        $group: {
          _id: '$assignedGroup',
          groupName: { $first: '$assignedGroupName' },
          studentIds: { $push: '$_id' },
          studentCount: { $sum: 1 }
        }
      },
      { $sort: { groupName: 1 } }
    ]);

    console.log(`\n📊 Found ${groupAggregation.length} groups to sync`);

    if (groupAggregation.length === 0) {
      console.log('⚠️  No groups found in internships. Students may not have been assigned to groups yet.');
      mongoose.disconnect();
      return;
    }

    // Create Group documents
    const groupDocs = groupAggregation.map(group => ({
      name: group.groupName || `Group ${group._id}`,
      students: group.studentIds,
      mentor: null // Can be assigned later
    }));

    const result = await Group.insertMany(groupDocs);
    console.log(`✅ Created ${result.length} group documents`);

    // Display summary
    console.log('\n📋 Groups created:');
    for (const group of groupAggregation) {
      console.log(`   - ${group.groupName}: ${group.studentCount} students`);
    }

    console.log('\n✅ Groups collection successfully synced!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error syncing groups:', error.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

syncGroups();
