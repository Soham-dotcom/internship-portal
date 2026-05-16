const mongoose = require('mongoose');

let baseConnection = null;

const connectToMongo = async (uri) => {
  if (baseConnection) return baseConnection;
  baseConnection = await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  return baseConnection;
};

const getSharedDb = () => {
  const dbName = process.env.SHARED_DB_NAME || 'spit-common';
  return mongoose.connection.useDb(dbName, { useCache: true });
};

const getYearDb = (year) => {
  const prefix = process.env.YEAR_DB_PREFIX || 'spit-internships-';
  const dbName = `${prefix}${year}`;
  return mongoose.connection.useDb(dbName, { useCache: true });
};

module.exports = {
  connectToMongo,
  getSharedDb,
  getYearDb,
};
