import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar, { FLAT_NAV } from './Sidebar';
import Topbar from './Topbar';
import './Layout.css';

// Derives breadcrumbs from the current path and the same nav list the
// sidebar uses, so there is one source of truth for page labels instead of
// hand-written breadcrumbs on every page.
function Breadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  const match = FLAT_NAV.filter((item) => item.to !== '/' && pathname.startsWith(item.to)).sort(
    (a, b) => b.to.length - a.to.length
  )[0];
  if (!match) return null;

  const hasDetailSegment = pathname.length > match.to.length;

  return (
    <div className="breadcrumbs">
      <Link to="/">Dashboard</Link>
      <span className="sep">/</span>
      {hasDetailSegment ? (
        <Link to={match.to}>{match.label}</Link>
      ) : (
        <span className="current">{match.label}</span>
      )}
      {hasDetailSegment && (
        <>
          <span className="sep">/</span>
          <span className="current">Details</span>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Topbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main>
          <div className="breadcrumb-bar">
            <Breadcrumbs />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
