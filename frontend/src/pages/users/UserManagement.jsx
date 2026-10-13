import { useEffect, useState } from 'react';
import { userApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ALL_ROLES } from '../../utils/constants';
import UserForm from './UserForm';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  function load() {
    setLoading(true);
    userApi
      .list({ limit: 100 })
      .then((res) => setUsers(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRoleChange(user, role) {
    await userApi.update(user._id, { role });
    load();
  }

  async function handleDeactivate() {
    try {
      await userApi.deactivate(deactivateTarget._id);
      setDeactivateTarget(null);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
      setDeactivateTarget(null);
    }
  }

  async function handleResetPassword() {
    try {
      await userApi.resetPassword(resetTarget._id, { password: newPassword });
      setResetTarget(null);
      setNewPassword('');
      alert('Password updated.');
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New User</button>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)}>
                    {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td><StatusBadge status={u.isActive ? 'Active' : 'Inactive'} /></td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setResetTarget(u)}>Reset Password</button>{' '}
                  {u.isActive && <button className="btn btn-sm btn-danger" onClick={() => setDeactivateTarget(u)}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && <UserForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {deactivateTarget && (
        <ConfirmDialog
          title="Deactivate user?"
          message={`Are you sure you want to deactivate ${deactivateTarget.name}? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {resetTarget && (
        <Modal title={`Reset password for ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <div className="form-field">
            <label>New Password</label>
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetPassword} disabled={newPassword.length < 8}>Update Password</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
