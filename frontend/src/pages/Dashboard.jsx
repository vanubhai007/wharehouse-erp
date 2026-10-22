import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { dashboardApi } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { LoadingState, ErrorState } from '../components/common/States';
import { formatCurrency, formatDateTime } from '../utils/format';

const COLORS = ['#1a3d7c', '#2d5bb0', '#1a73e8', '#5b8def', '#8fb4f0', '#b7791f', '#1b8a5a', '#c62828'];

const CARD_DEFS = [
  { key: 'totalInventory', label: 'Total Inventory', format: 'number' },
  { key: 'totalCustomers', label: 'Customers / Owners', format: 'number' },
  { key: 'itemsReceived', label: 'Items Received', format: 'number' },
  { key: 'itemsInWarehouse', label: 'Items In Warehouse', format: 'number' },
  { key: 'warehouseOccupancyPercent', label: 'Warehouse Occupancy', format: 'percent' },
  { key: 'underRefurbishment', label: 'Under Refurbishment', format: 'number' },
  { key: 'availableForSale', label: 'Available For Sale', format: 'number' },
  { key: 'pendingApprovals', label: 'Pending Owner Approvals', format: 'number' },
  { key: 'totalSales', label: 'Total Sales (count)', format: 'number' },
  { key: 'totalSalesValue', label: 'Total Sales Value', format: 'currency' },
  { key: 'accumulatedRental', label: 'Accumulated Rental', format: 'currency' },
  { key: 'refurbishmentExpense', label: 'Refurbishment Expense', format: 'currency' },
  { key: 'marketingExpense', label: 'Marketing Expense', format: 'currency' },
  { key: 'logisticsExpense', label: 'Logistics Expense', format: 'currency' },
  { key: 'totalInventoryCost', label: 'Total Inventory Cost', format: 'currency' },
];

function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${value}%`;
  return value;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError('');
    dashboardApi
      .get()
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-cards">
        {CARD_DEFS.map((def) => {
          const card = data.cards[def.key];
          if (!card) return null;
          return (
            <div key={def.key} className="stat-card" onClick={() => navigate(card.link)}>
              <div className="label">{def.label}</div>
              <div className="value">{formatValue(card.value, def.format)}</div>
            </div>
          );
        })}
      </div>

      <div className="form-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Items by Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.charts.itemsByStatus} margin={{ left: -20 }}>
              <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a73e8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.access?.expenses !== false && (
        <div className="card">
          <h3>Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.charts.expensesByCategory} dataKey="total" nameKey="category" outerRadius={100} label>
                {data.charts.expensesByCategory.map((entry, idx) => (
                  <Cell key={entry.category} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>

      <div className="form-grid">
        {data.access?.recentActivity !== false && (
        <div className="card">
          <h3>Recent Activity</h3>
          {data.recentActivity.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No activity recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {data.recentActivity.map((a) => (
                <li key={a._id} style={{ marginBottom: 8 }}>
                  <strong>{a.action}</strong> on {a.entityType} by {a.performedByName || 'System'}
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{formatDateTime(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
        <div className="card">
          <h3>Pending Tasks</h3>
          <p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/approvals')}>
              {data.pendingTasks.pendingApprovals} pending owner approvals
            </button>
          </p>
          <p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/refurbishment')}>
              {data.pendingTasks.pendingRefurbishmentJobs} refurbishment jobs in progress
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
