const Item = require('../models/Item');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const Approval = require('../models/Approval');
const SaleProposal = require('../models/SaleProposal');
const WarehouseLocation = require('../models/WarehouseLocation');
const AuditLog = require('../models/AuditLog');
const Refurbishment = require('../models/Refurbishment');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const { calculateItemRental } = require('../services/rentalService');

// Every figure here is computed live from MongoDB - nothing is hardcoded.
// Cards map 1:1 to a filtered list page on the frontend via the "link" field.
const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalInventory,
    totalCustomers,
    received,
    inWarehouse,
    underRefurbishment,
    availableForSale,
    pendingApprovals,
    convertedProposals,
    occupancyAgg,
    totalLocationsAgg,
    expensesByCategory,
    recentAudit,
    pendingRefurbJobs,
    activeItems,
  ] = await Promise.all([
    Item.countDocuments({ isArchived: false }),
    Customer.countDocuments({ isActive: true }),
    Item.countDocuments({ status: 'Received' }),
    Item.countDocuments({ status: 'In Warehouse' }),
    Item.countDocuments({ status: 'Under Refurbishment' }),
    Item.countDocuments({ status: 'Available for Sale' }),
    Approval.countDocuments({ decision: 'Pending' }),
    SaleProposal.find({ status: 'Converted' }),
    Item.aggregate([
      { $match: { isArchived: false, currentLocation: { $ne: null } } },
      { $group: { _id: null, occupiedAreaSqFt: { $sum: '$storageAreaSqFt' } } },
    ]),
    WarehouseLocation.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalAreaSqFt: { $sum: '$areaSqFt' } } }]),
    Expense.aggregate([{ $group: { _id: '$category', total: { $sum: '$amount' } } }]),
    AuditLog.find().sort({ createdAt: -1 }).limit(15),
    Refurbishment.countDocuments({ status: { $in: ['Assigned', 'In Progress'] } }),
    Item.find({ isArchived: false }),
  ]);

  const totalSalesValue = convertedProposals.reduce((s, p) => s + (p.proposedPrice - p.discountAmount), 0);

  const settings = await Settings.getSettings();
  const totalRental = activeItems.reduce((s, item) => s + calculateItemRental(item, settings).amount, 0);

  const expenseTotals = {};
  for (const e of expensesByCategory) expenseTotals[e._id] = e.total;

  const occupiedAreaSqFt = occupancyAgg[0]?.occupiedAreaSqFt || 0;
  const totalAreaSqFt = totalLocationsAgg[0]?.totalAreaSqFt || 0;
  const occupancyPercent = totalAreaSqFt ? Math.round((occupiedAreaSqFt / totalAreaSqFt) * 100) : 0;

  const totalPurchaseCost = activeItems.reduce((s, i) => s + (i.purchaseCost || 0), 0);
  const totalInventoryCost =
    totalPurchaseCost +
    totalRental +
    (expenseTotals['Refurbishment'] || 0) +
    (expenseTotals['Marketing'] || 0) +
    (expenseTotals['Inbound Logistics'] || 0) +
    (expenseTotals['Outbound Logistics'] || 0) +
    (expenseTotals['Other'] || 0);

  const statusCounts = {};
  for (const item of activeItems) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

  res.json({
    success: true,
    data: {
      cards: {
        totalInventory: { value: totalInventory, link: '/inventory' },
        totalCustomers: { value: totalCustomers, link: '/customers' },
        itemsReceived: { value: received, link: '/inventory?status=Received' },
        itemsInWarehouse: { value: inWarehouse, link: '/inventory?status=In Warehouse' },
        warehouseOccupancyPercent: { value: occupancyPercent, link: '/warehouse' },
        underRefurbishment: { value: underRefurbishment, link: '/inventory?status=Under Refurbishment' },
        availableForSale: { value: availableForSale, link: '/inventory?status=Available for Sale' },
        pendingApprovals: { value: pendingApprovals, link: '/approvals' },
        totalSales: { value: convertedProposals.length, link: '/sales?status=Converted' },
        totalSalesValue: { value: Math.round(totalSalesValue * 100) / 100, link: '/sales?status=Converted' },
        accumulatedRental: { value: Math.round(totalRental * 100) / 100, link: '/warehouse/rental-report' },
        refurbishmentExpense: { value: expenseTotals['Refurbishment'] || 0, link: '/reports/expenses?category=Refurbishment' },
        marketingExpense: { value: expenseTotals['Marketing'] || 0, link: '/reports/expenses?category=Marketing' },
        logisticsExpense: {
          value: (expenseTotals['Inbound Logistics'] || 0) + (expenseTotals['Outbound Logistics'] || 0),
          link: '/reports/expenses',
        },
        totalInventoryCost: { value: Math.round(totalInventoryCost * 100) / 100, link: '/reports/cost-sheet' },
      },
      charts: {
        itemsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        expensesByCategory: Object.entries(expenseTotals).map(([category, total]) => ({ category, total })),
      },
      recentActivity: recentAudit,
      pendingTasks: {
        pendingApprovals,
        pendingRefurbishmentJobs: pendingRefurbJobs,
      },
    },
  });
});

module.exports = { getDashboard };
