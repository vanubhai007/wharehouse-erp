import { useEffect, useState } from 'react';
import { reportApi } from '../../api/endpoints';
import { apiErrorMessage, downloadAuthenticated } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { ROLES, ALL_ROLES } from '../../utils/constants';

// Mirrors REPORT_ACCESS in backend/config/constants.js. The backend enforces
// access; this only hides tabs the current role cannot open.
const REPORT_ROLES = {
  operational: ALL_ROLES,
  costs: [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS, ROLES.OWNER_APPROVER],
  sales: [ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.SALES_MANAGER, ROLES.OWNER_APPROVER],
  finance: [ROLES.ADMIN, ROLES.ACCOUNTS, ROLES.OWNER_APPROVER],
  audit: [ROLES.ADMIN],
};

const REPORTS = [
  {
    key: 'inventory', label: 'Current Inventory', path: '/reports/inventory', fetch: reportApi.inventory, csv: true,
    roles: REPORT_ROLES.operational,
    columns: [
      { header: 'Item ID', cell: (r) => r.itemId },
      { header: 'Name', cell: (r) => r.name },
      { header: 'Owner', cell: (r) => r.owner?.businessName || r.owner?.name },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
      { header: 'Location', cell: (r) => r.currentLocation?.code || '-' },
      { header: 'Purchase Cost', cell: (r) => formatCurrency(r.purchaseCost) },
    ],
  },
  {
    key: 'cost-sheet', label: 'Item-wise Cost Sheet', path: '/reports/cost-sheet', fetch: reportApi.costSheet, csv: true,
    roles: REPORT_ROLES.costs,
    rows: (data) => data,
    columns: [
      { header: 'Item', cell: (r) => `${r.item.itemId} - ${r.item.name}` },
      { header: 'Base Cost', cell: (r) => formatCurrency(r.costSheet.baseCost) },
      { header: 'Rental', cell: (r) => formatCurrency(r.costSheet.rental) },
      { header: 'Refurbishment', cell: (r) => formatCurrency(r.costSheet.refurbishment) },
      { header: 'Marketing', cell: (r) => formatCurrency(r.costSheet.marketing) },
      { header: 'Logistics', cell: (r) => formatCurrency(r.costSheet.logistics) },
      { header: 'Total Cost', cell: (r) => formatCurrency(r.costSheet.totalCost) },
    ],
  },
  {
    key: 'expenses', label: 'Expense Report', path: '/reports/expenses', fetch: reportApi.expenses, csv: true,
    roles: REPORT_ROLES.costs,
    rows: (data) => data.expenses,
    columns: [
      { header: 'Date', cell: (r) => formatDate(r.date) },
      { header: 'Item', cell: (r) => r.item?.itemId },
      { header: 'Category', cell: (r) => r.category },
      { header: 'Amount', cell: (r) => formatCurrency(r.amount) },
      { header: 'Vendor', cell: (r) => r.vendor || '-' },
      { header: 'Status', cell: (r) => <StatusBadge status={r.paymentStatus} /> },
    ],
  },
  {
    key: 'refurbishment', label: 'Refurbishment Report', path: '/reports/refurbishment', fetch: reportApi.refurbishment,
    roles: REPORT_ROLES.operational,
    columns: [
      { header: 'Item', cell: (r) => r.item?.itemId },
      { header: 'Work', cell: (r) => r.workDescription },
      { header: 'Assigned To', cell: (r) => r.assignedTo },
      { header: 'Cost', cell: (r) => formatCurrency(r.repairCost) },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  {
    key: 'sales', label: 'Sales Report', path: '/reports/sales', fetch: reportApi.sales, csv: true,
    roles: REPORT_ROLES.sales,
    rows: (data) => data.proposals,
    columns: [
      { header: 'Proposal #', cell: (r) => r.proposalNumber },
      { header: 'Item', cell: (r) => r.item?.itemId },
      { header: 'Buyer', cell: (r) => r.buyer?.businessName || r.buyer?.name },
      { header: 'Price', cell: (r) => formatCurrency(r.proposedPrice) },
      { header: 'Margin', cell: (r) => formatCurrency(r.marginAmount) },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  {
    key: 'pending-approvals', label: 'Pending Approvals', path: '/reports/pending-approvals', fetch: reportApi.pendingApprovals,
    roles: REPORT_ROLES.operational,
    columns: [
      { header: 'Proposal #', cell: (r) => r.saleProposal?.proposalNumber },
      { header: 'Requested', cell: (r) => formatDate(r.requestedAt) },
      { header: 'Decision', cell: (r) => <StatusBadge status={r.decision} /> },
    ],
  },
  {
    key: 'outstanding', label: 'Outstanding Payments', path: '/reports/outstanding-payments', fetch: reportApi.outstandingPayments, csv: true,
    roles: REPORT_ROLES.finance,
    rows: (data) => data.invoices,
    columns: [
      { header: 'Invoice #', cell: (r) => r.invoiceNumber },
      { header: 'Buyer', cell: (r) => r.buyer?.businessName || r.buyer?.name },
      { header: 'Grand Total', cell: (r) => formatCurrency(r.grandTotal) },
      { header: 'Paid', cell: (r) => formatCurrency(r.amountPaid) },
      { header: 'Balance', cell: (r) => formatCurrency(r.grandTotal - r.amountPaid) },
      { header: 'Status', cell: (r) => <StatusBadge status={r.paymentStatus} /> },
    ],
  },
  {
    key: 'settlements', label: 'Commission & Settlement', path: '/reports/settlements', fetch: reportApi.settlements,
    roles: REPORT_ROLES.finance,
    rows: (data) => data.settlements,
    columns: [
      { header: 'Item', cell: (r) => r.item?.itemId },
      { header: 'Owner', cell: (r) => r.owner?.businessName || r.owner?.name },
      { header: 'Commission', cell: (r) => formatCurrency(r.commissionAmount) },
      { header: 'Owner Payable', cell: (r) => formatCurrency(r.ownerPayable) },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  {
    key: 'dispatch', label: 'Dispatch Report', path: '/reports/dispatch', fetch: reportApi.dispatch,
    roles: REPORT_ROLES.operational,
    columns: [
      { header: 'Dispatch #', cell: (r) => r.dispatchNumber },
      { header: 'Item', cell: (r) => r.item?.itemId },
      { header: 'Buyer', cell: (r) => r.buyer?.businessName || r.buyer?.name },
      { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    ],
  },
  {
    key: 'audit', label: 'Audit / Activity Log', path: '/reports/audit', fetch: reportApi.audit,
    roles: REPORT_ROLES.audit,
    columns: [
      { header: 'When', cell: (r) => formatDate(r.createdAt) },
      { header: 'Entity', cell: (r) => r.entityType },
      { header: 'Action', cell: (r) => r.action },
      { header: 'By', cell: (r) => r.performedByName || 'System' },
    ],
  },
];

export default function ReportsHub() {
  const { user } = useAuth();
  const visibleReports = REPORTS.filter((r) => r.roles.includes(user?.role));
  const [active, setActive] = useState(visibleReports[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    active
      .fetch()
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [active]);

  async function handleExport() {
    try {
      await downloadAuthenticated(reportApi.csvPath(active.path), `${active.key}.csv`);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  const rows = data ? (active.rows ? active.rows(data) : Array.isArray(data) ? data : []) : [];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        {active.csv && (
          <button className="btn btn-secondary" onClick={handleExport}>Export CSV</button>
        )}
      </div>

      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        {visibleReports.map((r) => (
          <button key={r.key} className={`btn btn-sm ${active.key === r.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActive(r)}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : rows.length === 0 ? (
        <EmptyState message="No data for this report yet." />
      ) : (
        <table className="data-table">
          <thead><tr>{active.columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row._id || idx}>
                {active.columns.map((c) => <td key={c.header}>{c.cell(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
