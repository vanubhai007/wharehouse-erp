import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', roles: null },
  { to: '/customers', label: 'Customers / Owners', icon: '🏢', roles: null },
  { to: '/buyers', label: 'Buyers', icon: '🤝', roles: null },
  { to: '/buyer-inquiries', label: 'Buyer Inquiries', icon: '💬', roles: null },
  { to: '/sales-inquiries', label: 'Sales Inquiries', icon: '📞', roles: null },
  { to: '/inventory', label: 'Inventory', icon: '📦', roles: null },
  { to: '/stickers', label: 'Sticker Generator', icon: '🏷️', roles: null },
  { to: '/warehouse', label: 'Warehouse Map', icon: '🗺️', roles: null },
  { to: '/refurbishment', label: 'Refurbishment', icon: '🛠️', roles: null },
  { to: '/sales', label: 'Sale Proposals', icon: '💼', roles: null },
  { to: '/approvals', label: 'Approvals', icon: '✅', roles: null },
  { to: '/invoices', label: 'Invoices', icon: '🧾', roles: null },
  { to: '/dispatch', label: 'Dispatch', icon: '🚚', roles: null },
  { to: '/settlements', label: 'Settlements', icon: '💰', roles: null },
  { to: '/reports', label: 'Reports', icon: '📈', roles: null },
  { to: '/users', label: 'User Management', icon: '👤', roles: ['Admin'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['Admin'] },
];

export default function Sidebar({ open, onNavigate }) {
  const { user } = useAuth();

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">HR Warehouse ERP</div>
      <nav className="sidebar-nav">
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
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
      </nav>
    </aside>
  );
}
