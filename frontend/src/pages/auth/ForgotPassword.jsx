import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setDemoUrl('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      setMessage(res.data.message);
      if (res.data.demoMode) setDemoUrl(res.data.demoResetUrl);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Forgot Password</h2>
        <p className="auth-subtitle">Enter your account email to receive a reset link</p>
        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
        {message && <p style={{ color: 'var(--color-success)', marginBottom: 12 }}>{message}</p>}
        {demoUrl && (
          <div className="auth-demo-box">
            <strong>Demo mode</strong> (no email provider configured). Use this link directly:
            <br />
            <Link to={demoUrl.replace(window.location.origin, '')}>{demoUrl}</Link>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
