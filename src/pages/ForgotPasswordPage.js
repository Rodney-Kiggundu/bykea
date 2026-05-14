import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { passwordResetConfirm, passwordResetSend } from '../lib/passwordReset';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './auth.css';

function parseRealm(raw) {
  const r = String(raw ?? 'customer').trim().toLowerCase();
  if (r === 'driver' || r === 'shop_owner') return r;
  return 'customer';
}

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 18.5L8.5 12l7-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isValidEmail(value) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const realm = useMemo(() => parseRealm(searchParams.get('realm')), [searchParams]);

  const loginPath = realm === 'driver' ? '/driver/login' : realm === 'shop_owner' ? '/shop-owner/login' : '/login';
  const portalLabel =
    realm === 'driver' ? 'Driver' : realm === 'shop_owner' ? 'Shop owner' : 'Customer';

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setEmail(String(q).trim().toLowerCase());
  }, [searchParams]);

  const codeOk = /^\d{6}$/.test(resetCode.trim());
  const passwordsMatch = newPassword.length >= 6 && newPassword === confirmPassword;

  const onSendCode = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Add env vars and restart the dev server.');
      return;
    }
    setBusy(true);
    try {
      const r = await passwordResetSend({ email: email.trim().toLowerCase(), realm });
      if (!r.ok) {
        setErrorMessage(r.error || 'Could not send reset code.');
        return;
      }
      setStep('reset');
      setInfoMessage(
        'If an account exists for this email, we sent a 6-digit code. Enter it below with your new password.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onConfirmReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!codeOk) {
      setErrorMessage('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }
    setBusy(true);
    try {
      const r = await passwordResetConfirm({
        email: email.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword,
        realm,
      });
      if (!r.ok) {
        setErrorMessage(r.error || 'Could not reset password.');
        return;
      }
      navigate(loginPath, { replace: true, state: { passwordReset: true } });
    } finally {
      setBusy(false);
    }
  };

  const onResendCode = async () => {
    setErrorMessage('');
    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email above, then tap Resend code.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }
    setBusy(true);
    try {
      const r = await passwordResetSend({ email: email.trim().toLowerCase(), realm });
      if (!r.ok) {
        setErrorMessage(r.error || 'Could not resend code.');
        return;
      }
      setInfoMessage('If this email is registered, a new code was sent.');
    } finally {
      setBusy(false);
    }
  };

  const tryDifferentEmail = () => {
    setStep('email');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setInfoMessage('');
  };

  return (
    <div className="auth-page auth-page--register auth-page--forgot">
      <div className="auth-top">
        <Link to={loginPath} className="auth-back" aria-label="Back to login">
          <IconBack />
        </Link>
      </div>

      <div className="auth-card">
        <p className="auth-logo">InGo</p>

        {step === 'email' ? (
          <>
            <h1 className="auth-title auth-title--subhead-gap">Forgot password?</h1>
            <p className="auth-subtitle">
              {portalLabel} account — enter your email and we will send a code to reset your password.
            </p>
            <form onSubmit={onSendCode} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="forgot-email">
                  Email address
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="forgot-email"
                    className="auth-input"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {errorMessage ? <p className="auth-message auth-message--error">{errorMessage}</p> : null}
              <button type="submit" className="auth-btn-primary" disabled={busy}>
                {busy ? 'Please wait…' : 'Send reset code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title auth-title--subhead-gap">Set a new password</h1>
            <p className="auth-subtitle">Enter the code from your email and choose a new password (min. 6 characters).</p>
            <form onSubmit={onConfirmReset} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="forgot-email2">
                  Email
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="forgot-email2"
                    className="auth-input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="forgot-code">
                  Reset code
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="forgot-code"
                    className="auth-input"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="forgot-np">
                  New password
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="forgot-np"
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
              </div>
              <div className="auth-field auth-field--last">
                <label className="auth-label" htmlFor="forgot-np2">
                  Confirm new password
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="forgot-np2"
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
              </div>
              {errorMessage ? <p className="auth-message auth-message--error">{errorMessage}</p> : null}
              {infoMessage ? <p className="auth-message auth-message--success" role="status">{infoMessage}</p> : null}
              <button type="button" className="auth-btn-secondary" style={{ marginBottom: '0.65rem', width: '100%' }} disabled={busy} onClick={onResendCode}>
                Resend code
              </button>
              <button type="submit" className="auth-btn-primary" disabled={busy || !codeOk || !passwordsMatch}>
                {busy ? 'Please wait…' : 'Update password'}
              </button>
            </form>
            <button type="button" className="auth-btn-secondary" style={{ marginTop: '0.65rem', width: '100%' }} onClick={tryDifferentEmail}>
              Use a different email
            </button>
            <Link to={loginPath} className="auth-btn-primary auth-btn-primary--link auth-btn-primary--stacked">
              Back to login
            </Link>
          </>
        )}

        <p className="auth-foot">
          Remember your password?{' '}
          <Link to={loginPath} className="auth-link-inline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
