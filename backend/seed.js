const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

// Sample data for seeding
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
    const summary = await Internship.aggregate([
      {
        $group: {
          _id: '$student.branch',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Data Summary:');
    summary.forEach(item => {
      console.log(`   ${item._id.toUpperCase()}: ${item.count} students`);
    });

    console.log('\n🎉 Database seeded successfully!');
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
