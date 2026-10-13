const { isTransitionAllowed } = require('../utils/statusTransition');
const { ROLES } = require('../config/constants');

describe('isTransitionAllowed', () => {
  test('allows the normal forward path', () => {
    expect(isTransitionAllowed('Handover Pending', 'Received', ROLES.WAREHOUSE_STAFF)).toBe(true);
    expect(isTransitionAllowed('Received', 'In Warehouse', ROLES.WAREHOUSE_STAFF)).toBe(true);
    expect(isTransitionAllowed('In Warehouse', 'Available for Sale', ROLES.WAREHOUSE_STAFF)).toBe(true);
    expect(isTransitionAllowed('In Warehouse', 'Under Refurbishment', ROLES.WAREHOUSE_STAFF)).toBe(true);
  });

  test('rejects skipping multiple steps forward', () => {
    expect(isTransitionAllowed('Handover Pending', 'Available for Sale', ROLES.WAREHOUSE_STAFF)).toBe(false);
    expect(isTransitionAllowed('Received', 'Sold', ROLES.ADMIN)).toBe(false);
  });

  test('rejects any forward move out of Closed, and rejects non-correction roles entirely', () => {
    expect(isTransitionAllowed('Closed', 'Dispatched', ROLES.WAREHOUSE_STAFF)).toBe(false);
    expect(isTransitionAllowed('Closed', 'Handover Pending', ROLES.ADMIN)).toBe(false);
  });

  test('Admin/Warehouse Manager may even correct a Closed item back one step', () => {
    // This is a deliberate consequence of the generic "one step back" correction
    // rule - documented in utils/statusTransition.js - rather than a special case.
    expect(isTransitionAllowed('Closed', 'Dispatched', ROLES.ADMIN)).toBe(true);
  });

  test('allows Admin/Warehouse Manager to correct one step backward', () => {
    expect(isTransitionAllowed('In Warehouse', 'Received', ROLES.ADMIN)).toBe(true);
    expect(isTransitionAllowed('In Warehouse', 'Received', ROLES.WAREHOUSE_MANAGER)).toBe(true);
  });

  test('does not allow other roles to correct backward', () => {
    expect(isTransitionAllowed('In Warehouse', 'Received', ROLES.WAREHOUSE_STAFF)).toBe(false);
    expect(isTransitionAllowed('In Warehouse', 'Received', ROLES.SALES_MANAGER)).toBe(false);
  });

  test('rejects an unknown target status', () => {
    expect(isTransitionAllowed('In Warehouse', 'Nonexistent Status', ROLES.ADMIN)).toBe(false);
  });
});
