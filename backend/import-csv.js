const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Internship = require('./models/Internship');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

// Simple CSV parser
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });
}

async function importData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'Internships 26 - All.csv');
    console.log('📖 Reading CSV file...');
    const data = parseCSV(csvPath);
    console.log(`📊 Found ${data.length} records`);

    // Map CSV data to Internship schema
    const internships = data.map(row => ({
      email: row['Institute Email ID'] || row['Personal Email ID'] || '',
      name: row['Name'] || '',
      uid: row['UID'] || '',
      branch: row['Branch'] || '',
      internshipType: '8th Sem',
      companyName: row['8th Sem Internship Offer'] || row['Placement Offer'] || '',
      externalMentorName: '',
      profile: row['Profile'] || '',  // Store Tech/Non Tech classification
      startDate: new Date(),
      endDate: new Date(),
      documentLink: row['8th Sem Internship Offer Letter'] || '',
      companyLocation: '',
      internshipTitle: row['Role'] || '',  // Store specific role
      stipend: row['8th Sem Internship Stipend'] || '',
      gender: row['Gender'] || '',
      phone: row['Mobile No.'] || '',
      ctc: row['CTC (LPA)'] || '',
      placementOffer: row['Placement Offer'] || '',
      remarks: '',
      submittedAt: new Date()
    }));

    console.log('💾 Importing data to database...');
    
    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (const record of internships) {
      try {
        if (!record.uid) {
          failedCount++;
          continue;
        }

        const existing = await Internship.findOne({ uid: record.uid });
        
        if (existing) {
          await Internship.findOneAndUpdate(
            { uid: record.uid },
            { $set: record },
            { new: true }
          );
          updatedCount++;
        } else {
          await Internship.create(record);
          insertedCount++;
        }
      } catch (err) {
        failedCount++;
        console.error(`❌ Error importing ${record.uid}: ${err.message}`);
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   📝 Inserted: ${insertedCount}`);
    console.log(`   🔄 Updated: ${updatedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);

    // Show summary
    const total = await Internship.countDocuments();
    const byBranch = await Internship.aggregate([
      { $group: { _id: '$branch', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n📊 Total records in database: ${total}`);
    console.log('📊 By branch:');
    byBranch.forEach(b => console.log(`   ${b._id}: ${b.count}`));

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

importData();
