import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { approvalApi, itemApi, customerApi, buyerApi } from '../../api/endpoints';

// Global quick search: reuses the existing per-module list endpoints (each
// already supports ?search=&limit=) instead of standing up a second,
// competing search system. Debounced; results are grouped by type and
// each one opens that record's own existing detail page.
function useGlobalSearch(term) {
  const [results, setResults] = useState({ items: [], customers: [], buyers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults({ items: [], customers: [], buyers: [] });
      setError(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(false);
      Promise.all([
        itemApi.list({ search: q, limit: 5 }).catch(() => null),
        customerApi.list({ search: q, limit: 5 }).catch(() => null),
        buyerApi.list({ search: q, limit: 5 }).catch(() => null),
      ])
        .then(([itemsRes, customersRes, buyersRes]) => {
          if (cancelled) return;
          if (!itemsRes && !customersRes && !buyersRes) setError(true);
          setResults({
            items: itemsRes?.data?.data || [],
            customers: customersRes?.data?.data || [],
            buyers: buyersRes?.data?.data || [],
          });
        })
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  return { results, loading, error };
}

export default function Topbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const searchBoxRef = useRef(null);
  const { results, loading, error } = useGlobalSearch(search);
  const hasResults = results.items.length + results.customers.length + results.buyers.length > 0;

  useEffect(() => {
    approvalApi
      .pending()
      .then((res) => setPendingApprovals(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(search.trim())}`);
      setSearchOpen(false);
    }
  }

  function goTo(path) {
    setSearchOpen(false);
    setSearch('');
    navigate(path);
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
      <form className="topbar-search" onSubmit={handleSearch} ref={searchBoxRef} style={{ position: 'relative' }}>
        <input
          placeholder="Search items, customers, buyers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
        />
        {searchOpen && search.trim().length >= 2 && (
          <div className="dropdown search-dropdown" style={{ left: 0, right: 'auto', top: 44, width: '100%', maxHeight: 360, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-muted)' }}>Searching...</div>}
            {!loading && error && (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--color-danger)' }}>Search failed. Try again.</div>
            )}
            {!loading && !error && !hasResults && (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-muted)' }}>No results for "{search.trim()}".</div>
            )}
            {!loading && !error && results.items.length > 0 && (
              <>
                <div className="search-group-label">Inventory</div>
                {results.items.map((i) => (
                  <button key={i._id} className="dropdown-item" onClick={() => goTo(`/inventory/${i._id}`)}>
                    <strong>{i.itemId}</strong> - {i.name}
                    {i.owner?.businessName || i.owner?.name ? ` · ${i.owner.businessName || i.owner.name}` : ''}
                  </button>
                ))}
              </>
            )}
            {!loading && !error && results.customers.length > 0 && (
              <>
                <div className="search-group-label">Customers / Owners</div>
                {results.customers.map((c) => (
                  <button key={c._id} className="dropdown-item" onClick={() => goTo(`/customers/${c._id}`)}>
                    <strong>{c.customerId}</strong> - {c.businessName || c.name}
                  </button>
                ))}
              </>
            )}
            {!loading && !error && results.buyers.length > 0 && (
              <>
                <div className="search-group-label">Buyers</div>
                {results.buyers.map((b) => (
                  <button key={b._id} className="dropdown-item" onClick={() => goTo(`/buyers/${b._id}`)}>
                    <strong>{b.buyerId}</strong> - {b.businessName || b.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
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
