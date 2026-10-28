import { useEffect, useState } from 'react';
import { userApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ALL_ROLES } from '../../utils/constants';
import UserForm from './UserForm';

// Public sign-ups need email verification and an Admin's approval (with a
// role chosen here) before they can sign in.
const awaitingDecision = (u) => u.signupSource === 'public' && u.approvalStatus !== 'approved';
function accountStatus(u) {
  if (u.signupSource === 'public' && u.emailVerified === false) return 'Unverified';
  if (u.signupSource === 'public' && u.approvalStatus === 'pending') return 'Pending';
  if (u.signupSource === 'public' && u.approvalStatus === 'rejected') return 'Rejected';
  return u.isActive ? 'Active' : 'Inactive';
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveRole, setApproveRole] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

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

  async function handleApprove() {
    try {
      await userApi.approve(approveTarget._id, { role: approveRole });
      setApproveTarget(null);
      setApproveRole('');
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function handleReject() {
    try {
      await userApi.reject(rejectTarget._id);
      setRejectTarget(null);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
      setRejectTarget(null);
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
                  {awaitingDecision(u) ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>Chosen on approval</span>
                  ) : (
                    <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)}>
                      {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td><StatusBadge status={accountStatus(u)} /></td>
                <td>
                  {awaitingDecision(u) && u.emailVerified !== false && (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => { setApproveTarget(u); setApproveRole(''); }}>Approve</button>{' '}
                    </>
                  )}
                  {u.signupSource === 'public' && u.approvalStatus === 'pending' && (
                    <>
                      <button className="btn btn-sm btn-danger" onClick={() => setRejectTarget(u)}>Reject</button>{' '}
                    </>
                  )}
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

      {approveTarget && (
        <Modal title={`Approve ${approveTarget.name}`} onClose={() => setApproveTarget(null)}>
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {approveTarget.email} signed up and verified this email address. Choose the role this account should have.
          </p>
          <div className="form-field">
            <label>Role</label>
            <select value={approveRole} onChange={(e) => setApproveRole(e.target.value)}>
              <option value="">Select a role...</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setApproveTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleApprove} disabled={!approveRole}>Approve</button>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject sign-up?"
          message={`Reject the registration of ${rejectTarget.name} (${rejectTarget.email})? They will not be able to sign in.`}
          confirmLabel="Reject"
          danger
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
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
