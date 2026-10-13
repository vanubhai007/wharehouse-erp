import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from './States';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState label="Loading HR Warehouse ERP..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RoleRoute({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) {
    return (
      <div className="page">
        <div className="card">
          <h3>Access restricted</h3>
          <p>Your role ({user?.role}) does not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
