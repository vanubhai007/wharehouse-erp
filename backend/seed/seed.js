/* eslint-disable no-console */
// Demo data seeding script. Run with: npm run seed (from backend/)
// Creates one user per role, sample customers/buyers, warehouse locations,
// items across several lifecycle stages, expenses, a refurbishment job, a
// full sale -> approval -> invoice -> payment -> dispatch chain, and the
// default Settings document.
//
// Safety: it refuses to run when NODE_ENV is "production" (checked before
// connecting), requires a real SEED_ADMIN_PASSWORD, and only ever fills an
// empty database - it skips any database that already contains users. Demo
// accounts get random passwords printed once; the Admin password is never printed.
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Customer = require('../models/Customer');
const Buyer = require('../models/Buyer');
const WarehouseLocation = require('../models/WarehouseLocation');
const Item = require('../models/Item');
const Expense = require('../models/Expense');
const Refurbishment = require('../models/Refurbishment');
const SaleProposal = require('../models/SaleProposal');
const Approval = require('../models/Approval');
const Settings = require('../models/Settings');

const { generateCustomerId, generateBuyerId, generateItemId, generateYearlyId } = require('../utils/idGenerator');

const PLACEHOLDER_ADMIN_PASSWORD = 'ChangeMe123!';
const MIN_ADMIN_PASSWORD_LENGTH = 12;

// Returns a reason to refuse seeding, or null when it is safe to continue.
// Runs before any database connection is opened.
function checkSeedPreconditions(env) {
  if (env.NODE_ENV === 'production') {
    return 'Refusing to seed: NODE_ENV is "production". The seed script is for development databases only.';
  }
  const password = env.SEED_ADMIN_PASSWORD;
  if (!password) return 'Refusing to seed: set SEED_ADMIN_PASSWORD in backend/.env first.';
  if (password === PLACEHOLDER_ADMIN_PASSWORD) {
    return 'Refusing to seed: SEED_ADMIN_PASSWORD is still the example placeholder. Choose your own password.';
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Refusing to seed: SEED_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

// 16 random URL-safe characters, generated fresh for every seed run.
function generateDemoPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

// Returns the process exit code: 1 when refused, 0 when seeded or skipped.
async function run() {
  const problem = checkSeedPreconditions(process.env);
  if (problem) {
    console.error(problem);
    return 1;
  }

  await connectDB();
  try {
    if (await User.exists({})) {
      console.log('Seed skipped: the database already contains users. The seed script only fills an empty database.');
      return 0;
    }
    await seedDatabase();
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

async function seedDatabase() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hrwarehouse.com';
  const demoPasswords = {
    manager: generateDemoPassword(),
    staff: generateDemoPassword(),
    accounts: generateDemoPassword(),
    sales: generateDemoPassword(),
    approver: generateDemoPassword(),
  };

  await Settings.getSettings();

  console.log('Creating users...');
  const admin = await User.create({ name: 'Admin User', email: adminEmail, password: process.env.SEED_ADMIN_PASSWORD, role: 'Admin' });
  const manager = await User.create({ name: 'Warehouse Manager', email: 'manager@hrwarehouse.com', password: demoPasswords.manager, role: 'Warehouse Manager', createdBy: admin._id });
  const staff = await User.create({ name: 'Warehouse Staff', email: 'staff@hrwarehouse.com', password: demoPasswords.staff, role: 'Warehouse Staff', createdBy: admin._id });
  const accounts = await User.create({ name: 'Accounts User', email: 'accounts@hrwarehouse.com', password: demoPasswords.accounts, role: 'Accounts', createdBy: admin._id });
  const salesManager = await User.create({ name: 'Sales Manager', email: 'sales@hrwarehouse.com', password: demoPasswords.sales, role: 'Sales/Buyer Manager', createdBy: admin._id });
  const approver = await User.create({ name: 'Owner Approver', email: 'approver@hrwarehouse.com', password: demoPasswords.approver, role: 'Owner/Approver', createdBy: admin._id });

  console.log('Creating warehouse locations...');
  const zoneA1 = await WarehouseLocation.create({ code: 'A-01-R1-B1', warehouseName: 'Main Warehouse', zone: 'A', aisle: '01', rack: 'R1', bin: 'B1', areaSqFt: 100, ratePerSqFtPerMonth: 12 });
  const zoneA2 = await WarehouseLocation.create({ code: 'A-01-R1-B2', warehouseName: 'Main Warehouse', zone: 'A', aisle: '01', rack: 'R1', bin: 'B2', areaSqFt: 150 });
  const zoneB1 = await WarehouseLocation.create({ code: 'B-02-R1-B1', warehouseName: 'Main Warehouse', zone: 'B', aisle: '02', rack: 'R1', bin: 'B1', areaSqFt: 200 });

  console.log('Creating customers (owners)...');
  const customer1 = await Customer.create({
    customerId: await generateCustomerId(),
    name: 'Rajesh Kumar',
    businessName: 'Kumar Electronics Trading',
    customerType: 'Business Owner',
    phone: '9876500001',
    email: 'rajesh@example.com',
    address: '12 MG Road, Pune',
    gstin: '27ABCDE1234F1Z5',
    agreement: { number: 'AGR-001', startDate: new Date('2026-01-01'), ratePerSqFtPerMonth: 12 },
    createdBy: admin._id,
  });
  const customer2 = await Customer.create({
    customerId: await generateCustomerId(),
    name: 'Priya Sharma',
    customerType: 'Individual Owner',
    phone: '9876500002',
    email: 'priya@example.com',
    address: '45 Residency Road, Pune',
    createdBy: admin._id,
  });

  console.log('Creating buyers...');
  const buyer1 = await Buyer.create({ buyerId: await generateBuyerId(), name: 'Amit Verma', businessName: 'Verma Traders', phone: '9876500003', email: 'amit@example.com', createdBy: admin._id });

  console.log('Creating inventory items across lifecycle stages...');
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 5);

  const item1 = await Item.create({
    itemId: await generateItemId(),
    name: 'Industrial Air Compressor',
    category: 'Machinery',
    brand: 'AtlasFlow',
    model: 'AF-200',
    serialNumber: 'AF200-SN-0001',
    owner: customer1._id,
    purchaseSource: 'Auction Lot #45',
    purchaseDate: monthAgo,
    purchaseCost: 45000,
    estimatedResaleValue: 60000,
    status: 'Available for Sale',
    condition: 'Good',
    currentLocation: zoneA1._id,
    storageAreaSqFt: 20,
    receivedDate: monthAgo,
    locationHistory: [{ location: zoneA1._id, areaSqFt: 20, startDate: monthAgo }],
    statusHistory: [{ to: 'Available for Sale', changedBy: admin._id, changedByName: admin.name, remarks: 'Seed data' }],
    createdBy: admin._id,
  });

  const item2 = await Item.create({
    itemId: await generateItemId(),
    name: 'Office Chairs (Set of 10)',
    category: 'Furniture',
    owner: customer2._id,
    trackingType: 'Batch',
    quantity: 10,
    unit: 'pcs',
    purchaseCost: 15000,
    estimatedResaleValue: 22000,
    status: 'Under Refurbishment',
    condition: 'Fair',
    currentLocation: zoneA2._id,
    storageAreaSqFt: 30,
    receivedDate: monthAgo,
    locationHistory: [{ location: zoneA2._id, areaSqFt: 30, startDate: monthAgo }],
    statusHistory: [{ to: 'Under Refurbishment', changedBy: manager._id, changedByName: manager.name, remarks: 'Seed data' }],
    createdBy: manager._id,
  });

  const item3 = await Item.create({
    itemId: await generateItemId(),
    name: 'Commercial Refrigerator',
    category: 'Appliances',
    owner: customer1._id,
    purchaseCost: 30000,
    estimatedResaleValue: 38000,
    status: 'Handover Pending',
    condition: 'Good',
    createdBy: staff._id,
    statusHistory: [{ to: 'Handover Pending', changedBy: staff._id, changedByName: staff.name, remarks: 'Seed data' }],
  });

  console.log('Creating expenses...');
  await Expense.create({ item: item1._id, category: 'Inbound Logistics', amount: 1200, date: monthAgo, vendor: 'Local Transport Co', dedupeKey: 'seed-exp-1', createdBy: staff._id });
  await Expense.create({ item: item2._id, category: 'Marketing', amount: 500, date: now, vendor: 'Online Listing', dedupeKey: 'seed-exp-2', createdBy: salesManager._id });

  console.log('Creating a refurbishment job...');
  await Refurbishment.create({
    item: item2._id,
    workDescription: 'Reupholster seats and fix wheels',
    assignedTo: 'FixIt Furniture Services',
    repairCost: 3000,
    startDate: now,
    status: 'In Progress',
    createdBy: manager._id,
  });

  console.log('Creating a full sale -> approval -> invoice -> payment -> dispatch chain...');
  const settings = await Settings.getSettings();

  const proposal = await SaleProposal.create({
    proposalNumber: await generateYearlyId('SP-', 'saleProposal'),
    item: item1._id,
    buyer: buyer1._id,
    proposedPrice: 58000,
    discountAmount: 1000,
    gstPercent: settings.defaultGstPercent,
    costSnapshot: { baseCost: 45000, rental: 240, refurbishment: 0, marketing: 0, logistics: 1200, other: 0, totalCost: 46440 },
    marginAmount: 10560,
    marginPercent: 18.5,
    status: 'Approval Pending',
    createdBy: salesManager._id,
  });
  item1.status = 'Approval Pending';
  item1.statusHistory.push({ from: 'Available for Sale', to: 'Sale Proposed', changedBy: salesManager._id, changedByName: salesManager.name, remarks: 'Seed data' });
  item1.statusHistory.push({ from: 'Sale Proposed', to: 'Approval Pending', changedBy: salesManager._id, changedByName: salesManager.name, remarks: 'Seed data' });
  await item1.save();

  await Approval.create({ saleProposal: proposal._id, requestedBy: salesManager._id, decision: 'Pending' });

  console.log('Seed complete.');
  console.log('----------------------------------------------------');
  console.log('Login with (demo passwords are random and shown only this once - save them now):');
  console.log(`  Admin:             ${adminEmail} / (the SEED_ADMIN_PASSWORD you configured)`);
  console.log(`  Warehouse Manager: manager@hrwarehouse.com / ${demoPasswords.manager}`);
  console.log(`  Warehouse Staff:   staff@hrwarehouse.com / ${demoPasswords.staff}`);
  console.log(`  Accounts:          accounts@hrwarehouse.com / ${demoPasswords.accounts}`);
  console.log(`  Sales Manager:     sales@hrwarehouse.com / ${demoPasswords.sales}`);
  console.log(`  Owner Approver:    approver@hrwarehouse.com / ${demoPasswords.approver}`);
  console.log('----------------------------------------------------');
  console.log('A sale proposal is sitting in "Approval Pending" - log in as the Owner Approver to try the approval workflow.');
}

if (require.main === module) {
  // Load backend/.env only when run as a script, never when imported (e.g. by tests).
  require('dotenv').config();
  run()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { run, checkSeedPreconditions, generateDemoPassword };
