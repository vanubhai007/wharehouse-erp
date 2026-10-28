import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { forgetSignup, signupPasswordFor } from './signupSession';
import './Auth.css';

// Second step of public sign-up: enter the 6-digit code from the email.
// The password typed at sign-up is sent along when it is still in memory;
// otherwise (e.g. after a reload) the user enters it again.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const initialEmail = (params.get('email') || '').trim().toLowerCase();
  const [email, setEmail] = useState(initialEmail);
  const rememberedPassword = signupPasswordFor(initialEmail);
  const [password, setPassword] = useState(rememberedPassword);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(location.state?.sent || '');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(Number(location.state?.cooldown) || 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (!email || !password) {
      setError('Enter your email address and the password you chose when signing up.');
      return;
    }
    setVerifying(true);
    try {
      const res = await authApi.verifyEmail({ email: email.trim().toLowerCase(), code, password });
      forgetSignup();
      setVerified(res.data.message);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    if (!email) {
      setError('Enter your email address first.');
      return;
    }
    setResending(true);
    try {
      const res = await authApi.resendVerification({ email: email.trim().toLowerCase() });
      setMessage(res.data.message);
      setCooldown(res.data.resendCooldownSeconds || 60);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2>Email verified</h2>
          <p className="auth-subtitle">{verified}</p>
          <Link className="btn btn-primary" to="/login">Go to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Verify your email</h2>
        <p className="auth-subtitle">Enter the 6-digit code we emailed you. Codes expire after 10 minutes.</p>
        {message && <p className="auth-demo-box" style={{ marginTop: 0, marginBottom: 12 }}>{message}</p>}
        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleVerify} noValidate>
          <div className="form-field">
            <label>Email <span className="required">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" readOnly={Boolean(rememberedPassword)} />
          </div>
          <div className="form-field">
            <label>Verification Code <span className="required">*</span></label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              style={{ letterSpacing: 6, fontSize: 18, textAlign: 'center' }}
            />
          </div>
          {!rememberedPassword && (
            <div className="form-field">
              <label>Password <span className="required">*</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="The password you chose when signing up" />
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        <div className="auth-links">
          <button type="button" className="btn btn-sm btn-secondary" onClick={handleResend} disabled={resending || cooldown > 0}>
            {resending ? 'Sending...' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
        <div className="auth-links">
          <Link to="/register">Create an account</Link>
          {' · '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
