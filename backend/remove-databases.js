const mongoose = require('mongoose');
require('dotenv').config();

if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function removeUnneededDatabases() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');

    // Get the admin database to list and drop databases
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    console.log('\n📋 Current databases:');
    databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Databases to keep (system databases and our main database)
    const keepDatabases = ['spit-internships', 'admin', 'local', 'config'];

    console.log('\n🗑️  Removing unnecessary databases...');
    
    for (const db of databases) {
      if (!keepDatabases.includes(db.name)) {
        try {
          await mongoose.connection.db.admin().command({ dropDatabase: 1 }, { dbName: db.name });
          // Connect to the database and drop it
          const conn = await mongoose.createConnection(`${MONGODB_URI.split('/').slice(0, -1).join('/')}/${db.name}`, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          });
          await conn.dropDatabase();
          await conn.close();
          console.log(`   ✅ Dropped database: ${db.name}`);
        } catch (err) {
          console.log(`   ⚠️  Could not drop ${db.name}: ${err.message}`);
        }
      } else {
        console.log(`   ✓ Keeping: ${db.name}`);
      }
    }

    // List databases after cleanup
    const { databases: finalDatabases } = await adminDb.listDatabases();
    console.log('\n📊 Remaining databases:');
    finalDatabases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    console.log('\n✅ Cleanup complete! Only spit-internships database remains.');

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

removeUnneededDatabases();
