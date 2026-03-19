const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

// Sample data matching your format
const sampleInternships = [];

// Connect to MongoDB and seed data
const seedDatabase = async () => {
  try {
    // Connect to MongoDB Atlas
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    const MONGODB_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Internship.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert sample data
    const result = await Internship.insertMany(sampleInternships);
    console.log(`✅ Successfully added ${result.length} internship records!`);

    // Display summary
    const branchSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$branch',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const typeSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$internshipType',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusSummary = await Internship.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Data Summary:');
    console.log('\n  Branch-wise:');
    branchSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n  Internship Type:');
    typeSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n  Status:');
    statusSummary.forEach(item => {
      console.log(`   ${item._id}: ${item.count} students`);
    });

    console.log('\n🎉 Database seeded successfully with your format!');
    console.log('🚀 You can now access the portal and see all features in action!\n');

    // Close connection
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();














