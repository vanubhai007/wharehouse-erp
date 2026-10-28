import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { rememberSignup } from './signupSession';
import './Auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public sign-up: the server emails a 6-digit code; the account is verified on
// the next screen and then needs an administrator's approval before sign-in.
export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function validate() {
    const next = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 100) next.name = 'Enter your name (2-100 characters).';
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 8 || form.password.length > 128) next.password = 'Use 8-128 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    const email = form.email.trim().toLowerCase();
    try {
      const res = await authApi.signup({ name: form.name.trim(), email, password: form.password });
      rememberSignup(email, form.password);
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
        state: { sent: res.data.message, cooldown: res.data.resendCooldownSeconds },
      });
    } catch (err) {
      const details = err?.response?.data?.details;
      setError(Array.isArray(details) && details.length ? details.map((d) => d.message).join(' ') : apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Create an account</h2>
        <p className="auth-subtitle">We will email you a code to verify your address. An administrator then approves new accounts.</p>
        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label>Full Name <span className="required">*</span></label>
            <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={100} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-field">
            <label>Email <span className="required">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@gmail.com" maxLength={254} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
          <div className="form-field">
            <label>Password <span className="required">*</span></label>
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" maxLength={128} />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>
          <div className="form-field">
            <label>Confirm Password <span className="required">*</span></label>
            <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" maxLength={128} />
            {errors.confirm && <span className="form-error">{errors.confirm}</span>}
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/verify-email">Already have a code?</Link>
          {' · '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
