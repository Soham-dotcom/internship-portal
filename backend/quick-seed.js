const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

const sampleData = [];

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional)
    await Internship.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert sample data
    const result = await Internship.insertMany(sampleData);
    console.log(`✅ Inserted ${result.length} internship records`);

    console.log('\n📊 Sample data:');
    console.log(JSON.stringify(result, null, 2));

    mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

seedDatabase();
