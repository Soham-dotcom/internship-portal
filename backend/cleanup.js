const mongoose = require('mongoose');
const Internship = require('./models/Internship');
const Group = require('./models/Group');
const Mentor = require('./models/Mentor');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function cleanupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Get the admin database to list all databases
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    console.log('\n📋 Available databases:');
    databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Get current database name
    const currentDbName = mongoose.connection.db.databaseName;
    console.log(`\n🎯 Current database: ${currentDbName}`);

    // List all collections in current database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📦 Collections in current database:');
    collections.forEach(coll => {
      console.log(`   - ${coll.name}`);
    });

    // Count documents before deletion
    const internshipCount = await Internship.countDocuments();
    const groupCount = await Group.countDocuments();
    const mentorCount = await Mentor.countDocuments();

    console.log('\n📊 Current data counts:');
    console.log(`   - Internships: ${internshipCount}`);
    console.log(`   - Groups: ${groupCount}`);
    console.log(`   - Mentors: ${mentorCount}`);

    // Delete all data from all collections
    console.log('\n🗑️  Deleting all data...');
    
    await Internship.deleteMany({});
    console.log('   ✅ Deleted all internships');
    
    await Group.deleteMany({});
    console.log('   ✅ Deleted all groups');
    
    await Mentor.deleteMany({});
    console.log('   ✅ Deleted all mentors');

    // Drop all other collections that might exist
    for (const coll of collections) {
      if (!['internships', 'groups', 'mentors'].includes(coll.name)) {
        await mongoose.connection.db.dropCollection(coll.name);
        console.log(`   ✅ Dropped collection: ${coll.name}`);
      }
    }

    console.log('\n✅ All data has been deleted successfully!');
    console.log('🧹 Database is now clean and ready for fresh data.');

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB\n');
  } catch (error) {
    console.error('❌ Error cleaning database:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

cleanupDatabase();
