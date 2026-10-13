import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { approvalApi } from '../../api/endpoints';

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    approvalApi
      .pending()
      .then((res) => setPendingApprovals(res.data.data))
      .catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/inventory?search=${encodeURIComponent(search.trim())}`);
  }

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="topbar">
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
        ☰
      </button>
      <form className="topbar-search" onSubmit={handleSearch}>
        <input
          placeholder="Search inventory by name, SKU, item ID, serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className="topbar-right">
        <div style={{ position: 'relative' }}>
          <button className="topbar-icon-btn" onClick={() => setNotifOpen((v) => !v)} aria-label="Notifications">
            🔔
            {pendingApprovals.length > 0 && <span className="notif-dot" />}
          </button>
          {notifOpen && (
            <div className="dropdown" style={{ width: 280 }}>
              <div style={{ padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Notifications</div>
              {pendingApprovals.length === 0 ? (
                <div style={{ padding: 14, color: 'var(--color-text-muted)', fontSize: 13 }}>No pending approvals.</div>
              ) : (
                pendingApprovals.slice(0, 5).map((a) => (
                  <button
                    key={a._id}
                    className="dropdown-item"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/approvals');
                    }}
                  >
                    Approval pending: {a.saleProposal?.proposalNumber || 'Sale proposal'}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="profile-menu-btn" onClick={() => setProfileOpen((v) => !v)}>
            <span className="avatar">{initials}</span>
            <span style={{ display: 'none' }}>{user?.name}</span>
          </button>
          {profileOpen && (
            <div className="dropdown">
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600 }}>{user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{user?.role}</div>
              </div>
              <button className="dropdown-item" onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
