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

/**
 * Runs `fn(session)` inside a MongoDB transaction: either every write in it is
 * applied, or none is. Every query inside must pass `{ session }`.
 *
 * Works across the shared and per-year databases because they all use the same
 * client. Transient conflicts (two people changing the same records at once) are
 * retried automatically by the driver, re-running `fn` against fresh data.
 */
const withTransaction = async (fn) => {
  const session = await mongoose.connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  withTransaction,
  connectToMongo,
  getSharedDb,
  getYearDb,
};
