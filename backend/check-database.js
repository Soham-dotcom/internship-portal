const mongoose = require('mongoose');
const Group = require('./models/Group');
const Internship = require('./models/Internship');
const Mentor = require('./models/Mentor');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function checkDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');
    console.log('🔗 Database:', mongoose.connection.db.databaseName);

    // Check groups
    const groupCount = await Group.countDocuments();
    console.log(`\n📊 Groups in database: ${groupCount}`);
    
    if (groupCount > 0) {
      const groups = await Group.find().limit(5).populate('mentor');
      console.log('\n📋 Sample groups:');
      groups.forEach(g => {
        const mentorName = g.mentor?.name || 'No mentor assigned';
        console.log(`   - ${g.name} (${mentorName}) - ${g.students?.length || 0} students`);
      });
    }

    // Check internships
    const internshipCount = await Internship.countDocuments();
    console.log(`\n📊 Internships in database: ${internshipCount}`);

    // Check if any internships have assigned groups
    const assignedCount = await Internship.countDocuments({ assignedGroup: { $ne: null } });
    console.log(`📊 Internships with assigned groups: ${assignedCount}`);

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📦 All collections:');
    collections.forEach(coll => {
      console.log(`   - ${coll.name}`);
    });

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

checkDatabase();
