const Expense = require('../models/Expense');
const Settings = require('../models/Settings');
const { calculateItemRental } = require('./rentalService');

// Formula (section 10 of the spec):
//   Total Item Cost = Base/Purchase Cost + Accumulated Rental + Refurbishment
//                    + Marketing + Applicable Logistics + Other Expenses
//
// Accumulated rental is computed live from the item's locationHistory
// (services/rentalService.js) rather than requiring a manual expense entry
// for every month. Any manually-entered "Warehouse Rental" expense (e.g. an
// adjustment or externally-invoiced charge) is added on top so it is never
// silently dropped, but is never auto-generated twice for the same period.
// All other categories are summed straight from Expense documents so each
// component stays visible and auditable - nothing is combined into an
// unexplained lump sum.
async function getItemCostSheet(item) {
  const settings = await Settings.getSettings();
  const expenses = await Expense.find({ item: item._id });

  const sum = (category) => expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0);

  const liveRental = calculateItemRental(item, settings);
  const manualRentalAdjustment = sum('Warehouse Rental');

  const breakdown = {
    baseCost: item.purchaseCost || 0,
    rental: Math.round((liveRental.amount + manualRentalAdjustment) * 100) / 100,
    refurbishment: sum('Refurbishment'),
    marketing: sum('Marketing'),
    logistics: sum('Inbound Logistics') + sum('Outbound Logistics'),
    commission: sum('Commission'),
    other: sum('Other'),
  };

  const totalCost =
    breakdown.baseCost +
    breakdown.rental +
    breakdown.refurbishment +
    breakdown.marketing +
    breakdown.logistics +
    breakdown.commission +
    breakdown.other;

  return {
    ...breakdown,
    totalCost: Math.round(totalCost * 100) / 100,
    rentalDetail: liveRental.details,
    expenses,
  };
}

module.exports = { getItemCostSheet };
