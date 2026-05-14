import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { customerEmailVerifySend, customerEmailVerifySubmit } from '../lib/customerEmailVerify';
import { getCustomerSession, isCustomerMarkedSignedIn, saveCustomerSession } from '../lib/customerSession';
import { getDriverSession, isDriverSignedIn } from '../lib/driverSession';
import { getShopOwnerSession, isShopOwnerSignedIn, saveShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './auth.css';

/** @typedef {'customer' | 'driver' | 'shop_owner'} VerifyRealm */

function parseRealm(raw) {
  const r = String(raw ?? 'customer').trim().toLowerCase();
  if (r === 'driver' || r === 'shop_owner') return /** @type {VerifyRealm} */ (r);
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

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const realm = useMemo(() => parseRealm(searchParams.get('realm')), [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setEmail(String(q).trim().toLowerCase());
  }, [searchParams]);

  const codeOk = useMemo(() => /^\d{6}$/.test(code.trim()), [code]);

  const backToLoginPath = realm === 'driver' ? '/driver/login' : realm === 'shop_owner' ? '/shop-owner/login' : '/login';

  if (realm === 'customer' && isCustomerMarkedSignedIn() && getCustomerSession()) {
    return <Navigate to="/home" replace />;
  }
  if (realm === 'driver' && isDriverSignedIn() && getDriverSession()) {
    return <Navigate to="/driver/home" replace />;
  }
  if (realm === 'shop_owner' && isShopOwnerSignedIn() && getShopOwnerSession()) {
    return <Navigate to="/shop-owner/dashboard" replace />;
  }

  const handleResend = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setErrorMessage('Enter your email and password to resend the code.');
      return;
    }
    setBusy(true);
    try {
      const r = await customerEmailVerifySend({ email: em, password, realm });
      if (!r.ok) {
        setErrorMessage(r.error || 'Could not resend code.');
        return;
      }
      setInfoMessage('A new code was sent to your email.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }
    const em = email.trim().toLowerCase();
    if (!em || !codeOk) {
      setErrorMessage('Enter your email and the 6-digit code from your inbox.');
      return;
    }
    setBusy(true);
    try {
      const v = await customerEmailVerifySubmit({ email: em, code: code.trim(), realm });
      if (!v.ok) {
        setErrorMessage(v.error || 'Verification failed.');
        return;
      }

      if (realm === 'customer') {
        const { data: row, error } = await supabase
          .from('app_users')
          .select('id, full_name, phone, email')
          .eq('email', em)
          .maybeSingle();
        if (error || !row) {
          setErrorMessage('Verified, but could not load your profile. Try logging in.');
          return;
        }
        try {
          localStorage.setItem('ingo_signed_in', '1');
          localStorage.setItem('ingo_onboarding_complete', '1');
        } catch {
          // ignore
        }
        saveCustomerSession(row, { rememberMe });
        navigate('/home', { replace: true });
        return;
      }

      if (realm === 'shop_owner') {
        const { data: row, error } = await supabase
          .from('shop_owners')
          .select('id, business_name, owner_full_name, phone, email, shop_image_url')
          .eq('email', em)
          .maybeSingle();
        if (error || !row) {
          setErrorMessage('Verified, but could not load your shop profile. Try logging in.');
          return;
        }
        saveShopOwnerSession(row, { rememberMe });
        navigate('/shop-owner/dashboard', { replace: true });
        return;
      }

      navigate('/driver/login', { replace: true, state: { emailVerified: true } });
    } finally {
      setBusy(false);
    }
  };

  const title =
    realm === 'driver' ? 'Verify your driver email' : realm === 'shop_owner' ? 'Verify your shop email' : 'Verify your email';
  const subtitle =
    realm === 'driver'
      ? 'Enter the 6-digit code we sent you. After verifying, sign in from Driver Login once an admin has approved your application.'
      : realm === 'shop_owner'
        ? 'Enter the 6-digit code we sent you. You can then sign in to your shop dashboard.'
        : 'Enter the 6-digit code we sent you. If you did not get a code, enter your password below and tap Resend.';

  return (
    <div className="auth-page auth-page--register">
      <div className="auth-top">
        <Link to={backToLoginPath} className="auth-back" aria-label="Back to login">
          <IconBack />
        </Link>
      </div>

      <form className="auth-card" onSubmit={handleVerify} noValidate>
        <p className="auth-logo">InGo</p>
        <h1 className="auth-title auth-title--subhead-gap">{title}</h1>
        <p className="auth-subtitle" style={{ marginBottom: '1rem' }}>
          {subtitle}
        </p>

        <div className="auth-field">
          <label className="auth-label" htmlFor="ve-email">
            Email
          </label>
          <div className="auth-input-wrap">
            <input
              id="ve-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="ve-code">
            Verification code
          </label>
          <div className="auth-input-wrap">
            <input
              id="ve-code"
              className="auth-input"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
        </div>

        <div className="auth-field auth-field--last">
          <label className="auth-label" htmlFor="ve-password">
            Password (for resend)
          </label>
          <div className="auth-input-wrap">
            <input
              id="ve-password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
            />
          </div>
        </div>

        {realm !== 'driver' ? (
          <div className="auth-options-row">
            <label className="auth-remember">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span>Remember me after sign-in</span>
            </label>
          </div>
        ) : null}

        <button type="submit" className="auth-btn-primary" disabled={busy || !codeOk}>
          {busy ? 'Please wait…' : realm === 'driver' ? 'Verify email' : 'Verify & continue'}
        </button>
        <button
          type="button"
          className="auth-btn-secondary"
          style={{ marginTop: '0.65rem', width: '100%' }}
          disabled={busy}
          onClick={handleResend}
        >
          Resend code
        </button>

        {errorMessage ? <p className="auth-message auth-message--error">{errorMessage}</p> : null}
        {infoMessage ? <p className="auth-message" style={{ color: '#1a7f37' }}>{infoMessage}</p> : null}
      </form>

      <p className="auth-foot">
        <Link to={backToLoginPath} className="auth-link-inline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
