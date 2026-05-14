import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { saveShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

function EyeOn() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M9.5 9.5A3 3 0 0 0 12 15a3 3 0 0 0 2.2-4.7M6.4 6.4C4.6 7.5 3.2 9.1 2.3 11.1c1.4 3.3 4.7 5.6 8.5 5.6a8.4 8.4 0 0 0 3.4-.7M10.5 4.2A8.4 8.4 0 0 1 12 4c4.2 0 7.6 2.7 9 6.5a9.4 9.4 0 0 1-1.4 2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function ShopOwnerLoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setUnverifiedEmail('');
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Add env vars and restart npm start.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: row, error } = await supabase
        .from('shop_owners')
        .select('id, business_name, owner_full_name, phone, email, shop_image_url, password, email_verified_at')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message || 'Could not log in right now.');
        return;
      }
      if (!row || row.password !== password) {
        setErrorMessage('Invalid email or password.');
        return;
      }
      if (row.email_verified_at == null) {
        setUnverifiedEmail(normalizedEmail);
        setErrorMessage(
          'Please verify your email before logging in. Check your inbox or use the link below.',
        );
        return;
      }

      saveShopOwnerSession(
        {
          id: row.id,
          business_name: row.business_name,
          owner_full_name: row.owner_full_name,
          phone: row.phone,
          email: row.email,
          shop_image_url: row.shop_image_url,
        },
        { rememberMe: remember },
      );
      const to = state?.from?.pathname || '/shop-owner/dashboard';
      navigate(to, { replace: true });
    } catch {
      setErrorMessage('Network error. Please check internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sop sopAuth" role="main">
      <div className="sopLeft">
        <Link to="/" className="sopBrand" aria-label="InGo home">
          InGo
        </Link>
        <h1 className="sopH1L">Grow your business with InGo</h1>
        <p className="sopSubL">Reach more customers and manage your deliveries in one place.</p>
      </div>
      <div className="sopRight">
        <p className="sopPtl">Shop owner portal</p>
        <h1 className="sopH1R">Welcome back</h1>
        <p className="sopSubR">Login to your dashboard</p>
        <form className="sopF" onSubmit={submit} autoComplete="on">
          {state?.passwordReset && (
            <p style={{ color: '#2a7a3a', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
              Password updated. Sign in with your new password.
            </p>
          )}
          {state?.registered && (
            <p style={{ color: '#A85612', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
              Your shop is registered. You can sign in now.
            </p>
          )}
          {errorMessage ? (
            <p role="alert" style={{ color: '#c62828', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
              {errorMessage}
            </p>
          ) : null}
          {unverifiedEmail && unverifiedEmail === email.trim().toLowerCase() ? (
            <p style={{ margin: '0 0 0.4rem' }}>
              <Link
                to={`/verify-email?realm=shop_owner&email=${encodeURIComponent(unverifiedEmail)}`}
                className="sopLink"
              >
                Verify email or resend code
              </Link>
            </p>
          ) : null}
          <label className="sopL" htmlFor="sop-em">
            Email
          </label>
          <input
            className="sopI"
            id="sop-em"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setUnverifiedEmail('');
            }}
            placeholder="you@shop.com"
            required
          />
          <label className="sopL" htmlFor="sop-pw">
            Password
          </label>
          <div className="sopPwR" style={{ marginBottom: '0.1rem' }}>
            <input
              className="sopI sopPwI"
              id="sop-pw"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="sopPwT" tabIndex={-1} onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOn /> : <EyeOff />}
            </button>
          </div>
          <div className="sopRow" style={{ margin: '0.1rem 0' }}>
            <label className="sopChkL">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <Link to="/forgot-password?realm=shop_owner" className="sopLink">
              Forgot password
            </Link>
          </div>
          <button className="sopBtn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Login'}
          </button>
        </form>
        <p className="sopDivR" aria-hidden>
          or
        </p>
        <Link to="/shop-owner/register" className="sopOutL" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
          Register your shop
        </Link>
      </div>
    </div>
  );
}
