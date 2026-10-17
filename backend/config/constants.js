// Central place for enums and CONFIGURABLE business-rule defaults.
// Values marked "CONFIRM WITH BUSINESS" are safe defaults chosen because no
// confirmed rule was provided. They can be overridden per-tenant via the
// Settings document (see models/Settings.js) without code changes.

const ROLES = {
  ADMIN: 'Admin',
  WAREHOUSE_MANAGER: 'Warehouse Manager',
  WAREHOUSE_STAFF: 'Warehouse Staff',
  ACCOUNTS: 'Accounts',
  SALES_MANAGER: 'Sales/Buyer Manager',
  OWNER_APPROVER: 'Owner/Approver',
};

const ALL_ROLES = Object.values(ROLES);

// Roles allowed to approve a sale proposal on behalf of an owner.
const APPROVAL_ROLES = [ROLES.OWNER_APPROVER, ROLES.ADMIN];

const ITEM_STATUS = [
  'Handover Pending',
  'Received',
  'In Warehouse',
  'Under Refurbishment',
  'Available for Sale',
  'Sale Proposed',
  'Approval Pending',
  'Approved',
  'Sold',
  'Dispatch Pending',
  'Dispatched',
  'Closed',
];

// Allowed forward transitions. Admin/Warehouse Manager may also move an item
// back one step (e.g. to correct a mistake); that is enforced in the
// controller, not here.
const ITEM_STATUS_TRANSITIONS = {
  'Handover Pending': ['Received'],
  Received: ['In Warehouse'],
  'In Warehouse': ['Under Refurbishment', 'Available for Sale'],
  'Under Refurbishment': ['In Warehouse', 'Available for Sale'],
  'Available for Sale': ['Sale Proposed'],
  'Sale Proposed': ['Approval Pending', 'Available for Sale'],
  'Approval Pending': ['Approved', 'Available for Sale'],
  Approved: ['Sold', 'Available for Sale'],
  Sold: ['Dispatch Pending'],
  'Dispatch Pending': ['Dispatched'],
  Dispatched: ['Closed'],
  Closed: [],
};

const EXPENSE_CATEGORIES = [
  'Warehouse Rental',
  'Refurbishment',
  'Marketing',
  'Inbound Logistics',
  'Outbound Logistics',
  'Commission',
  'Other',
];

const PAYMENT_STATUS = ['Unpaid', 'Partially Paid', 'Paid'];

const PAYMENT_DIRECTION = ['Receivable', 'Payable']; // from buyer / to owner

const DISPATCH_STATUS = ['Pending', 'Scheduled', 'Dispatched', 'Delivered', 'Closed'];

const CUSTOMER_TYPES = ['Individual Owner', 'Business Owner', 'Buyer', 'Vendor'];

// A Sales Inquiry is a general lead/prospect inquiry - it may or may not
// already be tied to a registered Buyer record (see models/SalesInquiry.js).
const SALES_INQUIRY_SOURCE = ['Website', 'Phone', 'Walk-in', 'Email', 'Referral', 'Other'];
const SALES_INQUIRY_STATUS = ['New', 'Contacted', 'Qualified', 'Converted', 'Closed', 'Lost'];
const INQUIRY_PRIORITY = ['Low', 'Medium', 'High'];
const BUYER_ENQUIRY_STATUS = ['Open', 'Negotiating', 'Converted', 'Closed'];

// Default configurable business rules (see Settings model for live values).
const DEFAULT_SETTINGS = {
  // CONFIRM WITH BUSINESS: rate per sq.ft per month used when a warehouse
  // zone does not define its own rate.
  defaultRatePerSqFtPerMonth: 10,
  // CONFIRM WITH BUSINESS: rental is billed pro-rata by calendar day.
  // 0 = use the actual number of days in each calendar month as the
  // denominator (28/29/30/31). Set to a fixed number (e.g. 30) to instead
  // always divide by a flat 30-day month.
  rentalDaysPerMonth: 0,
  // CONFIRM WITH BUSINESS: GST rate applied when an item/invoice does not
  // specify its own rate.
  defaultGstPercent: 18,
  // CONFIRM WITH BUSINESS: default commission charged to the owner on sale.
  defaultCommissionPercent: 10,
  defaultCommissionType: 'percent', // 'percent' | 'fixed'
  invoicePrefix: 'HRW-INV-',
  quotationPrefix: 'HRW-QTN-',
  dispatchNotePrefix: 'HRW-DSP-',
  companyName: 'HR Warehouse',
  companyAddress: 'Add your registered business address in Settings',
  companyGstin: '',
  companyPhone: '',
  companyEmail: '',
};

module.exports = {
  ROLES,
  ALL_ROLES,
  APPROVAL_ROLES,
  ITEM_STATUS,
  ITEM_STATUS_TRANSITIONS,
  EXPENSE_CATEGORIES,
  PAYMENT_STATUS,
  PAYMENT_DIRECTION,
  DISPATCH_STATUS,
  CUSTOMER_TYPES,
  SALES_INQUIRY_SOURCE,
  SALES_INQUIRY_STATUS,
  INQUIRY_PRIORITY,
  BUYER_ENQUIRY_STATUS,
  DEFAULT_SETTINGS,
};
