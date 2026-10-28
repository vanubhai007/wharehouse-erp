import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiErrorMessage } from '../../api/client';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
      // Sent only after a correct password (see the backend login check).
      setNeedsVerification(err?.response?.data?.details?.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>HR Warehouse ERP</h2>
        <p className="auth-subtitle">Sign in to manage assets, warehousing and sales</p>
        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
        {needsVerification && (
          <p style={{ marginBottom: 12, fontSize: 13 }}>
            <Link to={`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`}>Enter your verification code</Link>
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@hrwarehouse.com"
            />
          </div>
          <div className="form-field">
            <label>
              Password <span className="required">*</span>
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          {' · '}
          <Link to="/register">Create an account</Link>
          {' · '}
          <Link to="/setup">First time setup</Link>
        </div>
      </div>
    </div>
  );
}
