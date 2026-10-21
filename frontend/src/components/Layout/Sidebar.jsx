import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Grouped for sensible navigation (Phase 1 redesign): related modules sit
// together under a small section label instead of one long flat list.
const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: '/', label: 'Dashboard', icon: '📊', roles: null }],
  },
  {
    label: 'Parties',
    items: [
      { to: '/customers', label: 'Customers / Owners', icon: '🏢', roles: null },
      { to: '/buyers', label: 'Buyers', icon: '🤝', roles: null },
      { to: '/buyer-inquiries', label: 'Buyer Inquiries', icon: '💬', roles: null },
      { to: '/sales-inquiries', label: 'Sales Inquiries', icon: '📞', roles: null },
    ],
  },
  {
    label: 'Warehouse & Stock',
    items: [
      { to: '/inventory', label: 'Inventory', icon: '📦', roles: null },
      { to: '/warehouse', label: 'Warehouse Map', icon: '🗺️', roles: null },
      { to: '/refurbishment', label: 'Refurbishment', icon: '🛠️', roles: null },
    ],
  },
  {
    label: 'Sales & Fulfillment',
    items: [
      { to: '/sales', label: 'Sale Proposals', icon: '💼', roles: null },
      { to: '/approvals', label: 'Approvals', icon: '✅', roles: null },
      { to: '/invoices', label: 'Invoices', icon: '🧾', roles: null },
      { to: '/dispatch', label: 'Dispatch', icon: '🚚', roles: null },
    ],
  },
  {
    label: 'Finance & Insights',
    items: [
      { to: '/settlements', label: 'Settlements', icon: '💰', roles: null },
      { to: '/reports', label: 'Reports', icon: '📈', roles: null },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'User Management', icon: '👤', roles: ['Admin'] },
      { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['Admin'] },
    ],
  },
];

// Flat lookup reused by Layout.jsx to build breadcrumbs from the same
// single source of nav labels, instead of a second hardcoded list.
export const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function Sidebar({ open, onNavigate }) {
  const { user } = useAuth();

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">HR Warehouse ERP</div>
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(user?.role));
          if (items.length === 0) return null;
          return (
            <div key={group.label || 'top'}>
              {group.label && <div className="sidebar-group-label">{group.label}</div>}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onNavigate}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
