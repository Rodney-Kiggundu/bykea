import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { saveDriverSession } from '../lib/driverSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './driverPortal.css';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M15.5 19.5L8 12l7.5-7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
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

export default function DriverLoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setUnverifiedEmail('');
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Add env vars and restart the dev server.');
      return;
    }
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !password) return;

    setIsSubmitting(true);
    try {
      const { data: rows, error: qErr } = await supabase
        .from('driver_registrations')
        .select(
          'id, full_name, email, phone, phone_country_code, password, status, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, email_verified_at',
        )
        .eq('email', emailTrim)
        .order('created_at', { ascending: false })
        .limit(8);

      if (qErr) {
        setErrorMessage(qErr.message || 'Could not verify your account.');
        return;
      }

      const list = rows || [];
      const approved = list.find((r) => String(r.status || '').toLowerCase() === 'approved');
      const latest = list[0];

      if (approved) {
        if (approved.password !== password) {
          setErrorMessage('Incorrect password.');
          return;
        }
        if (approved.email_verified_at == null) {
          setUnverifiedEmail(emailTrim);
          setErrorMessage('Please verify your email before logging in. Use the link below to enter your code.');
          return;
        }
        saveDriverSession(approved);
        const from = state?.from;
        const target =
          typeof from === 'string' && from.startsWith('/driver') && !from.startsWith('/driver/login')
            ? from
            : '/driver/home';
        navigate(target, { replace: true });
        return;
      }

      if (latest) {
        const st = String(latest.status || '').toLowerCase();
        if (st === 'pending') {
          setErrorMessage('Your application is still pending approval. You can sign in once an admin approves it.');
          return;
        }
        if (st === 'rejected') {
          setErrorMessage('This application was not approved. Contact support if you need help.');
          return;
        }
      }

      setErrorMessage('No driver account found for this email. Register first, then wait for approval.');
    } catch {
      setErrorMessage('Network error. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dp">
      <header className="dp-h">
        <button type="button" className="dp-back" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <div className="dp-tit" aria-hidden style={{ minHeight: '1.2rem' }} />
      </header>
      <form className="dp-log" onSubmit={submit} autoComplete="on">
        {state?.passwordReset && (
          <p style={{ textAlign: 'center', color: '#2a7a3a', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
            Password updated. Sign in with your new password.
          </p>
        )}
        {state?.emailVerified && (
          <p style={{ textAlign: 'center', color: '#2a7a3a', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
            Email verified. Sign in when your application is approved.
          </p>
        )}
        {state?.registered && (
          <p style={{ textAlign: 'center', color: '#2a7a3a', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
            Application received. You can sign in when approved.
          </p>
        )}
        <div className="dp-logo" aria-hidden>
          InGo
        </div>
        <div className="dp-badge" role="status">
          Driver Portal
        </div>
        <h1 className="dp-h1">Welcome Back, Driver</h1>
        <p className="dp-sub">Login to start delivering (approved drivers only)</p>

        {errorMessage ? (
          <p style={{ textAlign: 'center', color: '#b42318', fontSize: '0.8rem', fontWeight: 600, margin: '0 0 0.5rem' }} role="alert">
            {errorMessage}
          </p>
        ) : null}
        {unverifiedEmail && unverifiedEmail === email.trim().toLowerCase() ? (
          <p style={{ textAlign: 'center', margin: '0 0 0.5rem' }}>
            <Link
              to={`/verify-email?realm=driver&email=${encodeURIComponent(unverifiedEmail)}`}
              style={{ color: '#1754d8', fontSize: '0.82rem', fontWeight: 600 }}
            >
              Verify email or resend code
            </Link>
          </p>
        ) : null}

        <label className="dp-lab" htmlFor="dlem">
          Email
        </label>
        <input
          className="dp-inp"
          id="dlem"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setUnverifiedEmail('');
          }}
          autoComplete="email"
          placeholder="you@example.com"
          style={{ marginBottom: 0 }}
          required
        />
        <label className="dp-lab" htmlFor="dlpw">
          Password
        </label>
        <div className="pwR">
          <input
            className="dp-inp"
            id="dlpw"
            name="password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            className="pwE"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff /> : <EyeOn />}
          </button>
        </div>
        <div className="dp-forg">
          <Link to="/forgot-password?realm=driver" style={{ color: 'inherit', font: 'inherit', textDecoration: 'underline' }}>
            Forgot password
          </Link>
        </div>
        <button type="submit" className="dp-btn" style={{ marginTop: '0.2rem' }} disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Login'}
        </button>
        <div className="divOr" aria-hidden>
          or
        </div>
        <Link to="/driver/register" className="dp-ol" style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
          Register as a Driver
        </Link>
        <p className="dp-btmL">
          <Link to="/login">Are you a customer?</Link>
        </p>
      </form>
    </div>
  );
}
