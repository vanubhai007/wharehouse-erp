// Creates (or updates the password of) the first admin account from
// ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in .env.
// Run with: npm run seed:admin

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Admin from '../models/Admin.js';

async function run() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env before seeding.');
  }

  await connectDB();

  const passwordHash = await Admin.hashPassword(password);
  const admin = await Admin.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { email: email.toLowerCase().trim(), passwordHash },
    { upsert: true, new: true }
  );

  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
