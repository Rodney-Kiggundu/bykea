import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCustomerSession, isCustomerMarkedSignedIn, saveCustomerSession } from '../lib/customerSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './auth.css';

function IconEye({ open }) {
  if (open) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 10.5a3 3 0 0 0 3 3M5.2 5.2C3.1 6.4 1.5 8.1 1 9.5c0 0 4 7 11 7 1.2 0 2.3-.2 3.3-.5M8.2 4.2C9.3 3.8 10.6 3.5 12 3.5c7 0 11 6.5 11 6.5-.2.4-1.1 1.6-2.4 2.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  if (isCustomerMarkedSignedIn() && getCustomerSession()) {
    return <Navigate to="/home" replace />;
  }

  const goHome = () => {
    navigate('/home', { replace: true });
  };

  const handleLoginSubmit = async (e) => {
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
        .from('app_users')
        .select('id, full_name, phone, email, password, email_verified_at')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message || 'Could not login right now.');
        return;
      }
      if (!row || row.password !== password) {
        setErrorMessage('Invalid email or password.');
        return;
      }
      if (row.email_verified_at === null) {
        setUnverifiedEmail(normalizedEmail);
        setErrorMessage(
          'Please verify your email before logging in. Check your inbox or use the link below.',
        );
        return;
      }

      saveCustomerSession(
        {
          id: row.id,
          full_name: row.full_name,
          phone: row.phone,
          email: row.email,
        },
        { rememberMe },
      );
      goHome();
    } catch {
      setErrorMessage('Network error. Please check internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleLoginSubmit} noValidate>
        <p className="auth-logo">InGo</p>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Login to your account</p>
        {state?.passwordReset ? (
          <p className="auth-message auth-message--success" role="status" style={{ marginBottom: '0.75rem' }}>
            Your password was updated. Sign in with your new password.
          </p>
        ) : null}
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">
            Email Address
          </label>
          <div className="auth-input-wrap">
            <input
              id="login-email"
              className="auth-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setUnverifiedEmail('');
              }}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">
            Password
          </label>
          <div className="auth-input-wrap">
            <input
              id="login-password"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-input-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <IconEye open={!showPassword} />
            </button>
          </div>
        </div>

        <div className="auth-options-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password?realm=customer" className="auth-forgot">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="auth-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
        {errorMessage ? <p className="auth-message auth-message--error">{errorMessage}</p> : null}
        {unverifiedEmail && unverifiedEmail === email.trim().toLowerCase() ? (
          <p className="auth-foot" style={{ marginTop: '0.5rem' }}>
            <Link
              to={`/verify-email?realm=customer&email=${encodeURIComponent(unverifiedEmail)}`}
              className="auth-link-inline"
            >
              Verify email or resend code
            </Link>
          </p>
        ) : null}
      </form>

      <p className="auth-foot">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="auth-link-inline">
          Register
        </Link>
      </p>
      <p className="auth-role-note">
        Are you a driver or shop owner? Use{' '}
        <Link to="/driver/login" className="auth-link-inline">
          Driver Login
        </Link>{' '}
        or{' '}
        <Link to="/shop-owner/login" className="auth-link-inline">
          Shop Owner Login
        </Link>
        .
      </p>
    </div>
  );
}
