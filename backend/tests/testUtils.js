const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || 'test-reset-secret';
process.env.JWT_EXPIRES_IN = '1h';

let mongod;

async function startTestDb() {
  try {
    mongod = await MongoMemoryServer.create();
  } catch (err) {
    throw new Error(
      `Could not start the in-memory MongoDB test server (first run downloads a mongod binary from fastdl.mongodb.org). ` +
        `If this environment blocks outbound access to that host, either allow it once (the binary is then cached), ` +
        `or run these integration tests in an environment with a real MongoDB reachable via MONGO_URI. Original error: ${err.message}`
    );
  }
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'hrwarehouse_test' });
}

async function stopTestDb() {
  // readyState 1 = connected. If startTestDb never got that far (e.g. the
  // mongod binary could not be downloaded), there is nothing to clean up.
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) await mongod.stop();
}

module.exports = { startTestDb, stopTestDb };
