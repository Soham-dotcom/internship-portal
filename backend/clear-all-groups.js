const mongoose = require('mongoose');
const Internship = require('./models/Internship');
const Group = require('./models/Group');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function clearAllGroups() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Delete all Group documents
    const deletedGroups = await Group.deleteMany({});
    console.log(`🗑️  Deleted ${deletedGroups.deletedCount} groups from groups collection`);
    
    // Unassign all students from groups
    const unassignedStudents = await Internship.updateMany(
      { assignedGroup: { $ne: null, $ne: '' } },
      { $set: { assignedGroup: null, assignedGroupName: null } }
    );
    console.log(`🔄 Unassigned ${unassignedStudents.modifiedCount} students from groups`);

    console.log('\n✅ All groups cleared successfully!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error clearing groups:', error.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

clearAllGroups();
