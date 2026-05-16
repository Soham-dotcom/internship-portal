const mongoose = require('mongoose');
const { connectToMongo, getYearDb } = require('../db/connection');
const { getInternshipModel } = require('../models/Internship');
const { normalizeCompanyName } = require('../utils/companyNormalization');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const YEAR = process.argv[2] || '2025';

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    await connectToMongo(process.env.MONGODB_URI);
    const db = getYearDb(YEAR);
    const Internship = getInternshipModel(db);

    const cursor = Internship.find({}).cursor();
    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const standardized = normalizeCompanyName(doc.companyName || '');
      if (doc.standardized_company_name !== standardized) {
        doc.standardized_company_name = standardized;
        await doc.save();
        updated += 1;
      }
    }

    console.log(`Backfill complete. Updated ${updated} records in ${YEAR}.`);
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error.message);
    process.exit(1);
  }
};

run();
