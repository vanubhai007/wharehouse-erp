// Mirrors backend/config/constants.js so the UI can render dropdowns and
// validate the obvious cases client-side. The backend remains the source of
// truth and re-validates every transition.
export const ITEM_STATUS = [
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

export const ITEM_STATUS_TRANSITIONS = {
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

export const EXPENSE_CATEGORIES = [
  'Warehouse Rental',
  'Refurbishment',
  'Marketing',
  'Inbound Logistics',
  'Outbound Logistics',
  'Commission',
  'Other',
];

export const SALES_INQUIRY_SOURCE = ['Website', 'Phone', 'Walk-in', 'Email', 'Referral', 'Other'];
export const SALES_INQUIRY_STATUS = ['New', 'Contacted', 'Qualified', 'Converted', 'Closed', 'Lost'];
export const INQUIRY_PRIORITY = ['Low', 'Medium', 'High'];
export const BUYER_ENQUIRY_STATUS = ['Open', 'Negotiating', 'Converted', 'Closed'];

export const ROLES = {
  ADMIN: 'Admin',
  WAREHOUSE_MANAGER: 'Warehouse Manager',
  WAREHOUSE_STAFF: 'Warehouse Staff',
  ACCOUNTS: 'Accounts',
  SALES_MANAGER: 'Sales/Buyer Manager',
  OWNER_APPROVER: 'Owner/Approver',
};

export const ALL_ROLES = Object.values(ROLES);
