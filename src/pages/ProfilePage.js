import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearCustomerSession,
  getCustomerSession,
  getSessionEmail,
  isCustomerMarkedSignedIn,
  saveCustomerSession,
} from '../lib/customerSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './customerAccount.css';

function formatPhoneDisplay(phone) {
  const p = String(phone || '').trim();
  if (!p) return '—';
  if (p.startsWith('+')) return p;
  return `+44 ${p}`;
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function RowArrow() {
  return (
    <span className="pf-item__arrow" aria-hidden>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ display: 'block' }}>
        <path
          d="M9.5 7.5L14 12l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function IcPencil() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M4 19.2L4.3 16l7.8-7.8a1.1 1.1 0 0 0 0-1.5L12 5.5a1.1 1.1 0 0 0-1.5 0L2.5 14.1 2.2 18.5 4.5 20l-0.4-0.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IcChatSupport() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M20 13.5v-5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v5l-2 2.5v.5h6.2l1.18 2.06a2 2 0 0 0 3.48 0L16.06 21H21v-.5l-2-2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="9.5" cy="11" r=".75" fill="currentColor" />
      <circle cx="12" cy="11" r=".75" fill="currentColor" />
      <circle cx="14.5" cy="11" r=".75" fill="currentColor" />
    </svg>
  );
}

function IcHelp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M9.2 9.2a2.8 2.8 0 0 1 3.1-.7 2 2 0 0 1 .2 3.1c-.4.3-.5.4-.5 1.1V13"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function IcDoc() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="6" y="4" width="10" height="15" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IcLock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="5" y="9.5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M8.5 9.5V7.5A3.5 3.5 0 0 1 12 4v0a3.5 3.5 0 0 1 3.5 3.5V9.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
      <rect x="2.5" y="6" width="18" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(() => getCustomerSession());
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const cached = getCustomerSession();
    if (cached) setProfile(cached);

    async function loadFromSupabase() {
      if (!isSupabaseConfigured || !supabase) return;

      const selectCols = 'id, full_name, phone, email';
      let row = null;

      if (cached?.id) {
        const { data, error } = await supabase
          .from('app_users')
          .select(selectCols)
          .eq('id', cached.id)
          .maybeSingle();
        if (!cancelled && !error && data) row = data;
      }

      if (!row && isCustomerMarkedSignedIn()) {
        const email = getSessionEmail();
        if (email) {
          const { data, error } = await supabase
            .from('app_users')
            .select(selectCols)
            .eq('email', email)
            .maybeSingle();
          if (!cancelled && !error && data) row = data;
        }
      }

      if (cancelled || !row) return;
      saveCustomerSession(row);
      setProfile(row);
    }

    loadFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  const display = useMemo(() => {
    const name = profile?.full_name?.trim() || '';
    const email = profile?.email?.trim() || '';
    return {
      name: name || 'Guest',
      phone: formatPhoneDisplay(profile?.phone),
      email,
      initials: initialsFromName(name),
    };
  }, [profile]);

  const showSessionHint = useMemo(() => {
    return isCustomerMarkedSignedIn() && !profile?.id && !getSessionEmail();
  }, [profile]);

  const logout = () => {
    clearCustomerSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="cust pf-page" style={{ background: 'transparent' }}>
      <div className="pf-hero">
        <div className="pf-hero__h" />
        <div className="pf-ava" aria-label="Profile photo">
          <span style={{ lineHeight: '5.2rem', fontSize: '2.2rem', userSelect: 'none' }} aria-hidden>
            {display.initials}
          </span>
          <button
            type="button"
            className="pf-ava__btn"
            aria-label="Change profile photo"
            title="Change photo"
          >
            <CameraIcon />
          </button>
        </div>
        <h2>{display.name}</h2>
        <p>{display.phone}</p>
        {display.email ? (
          <p className="pf-hero__email" title={display.email}>
            {display.email}
          </p>
        ) : null}
        {showSessionHint ? (
          <p className="pf-hero__hint">
            Log in once on this device to load your saved name, phone, and email from your account.
          </p>
        ) : null}
      </div>

      <div className="pf-bwrap" style={{ flex: 1, minHeight: 0 }}>
        <div className="pf-bwrap__scroll">
          <h3 className="pf-secT">Personal</h3>
          <div className="pf-secB">
            <button type="button" className="pf-item" onClick={() => navigate('/profile/edit')}>
              <span className="pf-icoL">
                <IcPencil />
              </span>
              <span className="pf-item__txt">Edit Profile</span>
              <RowArrow />
            </button>
          </div>

          <h3 className="pf-secT">Support</h3>
          <div className="pf-secB">
            <button type="button" className="pf-item pf-item--chat" onClick={() => navigate('/chat/support')}>
              <span className="pf-icoL pf-icoL--accent">
                <IcChatSupport />
              </span>
              <span className="pf-item__txt">
                Chat with admin
                <small className="pf-item__sub">InGo Support · bot + team</small>
              </span>
              <RowArrow />
            </button>
            <button type="button" className="pf-item" onClick={() => navigate('/help-support')}>
              <span className="pf-icoL">
                <IcHelp />
              </span>
              <span className="pf-item__txt">Help &amp; Support</span>
              <RowArrow />
            </button>
            <button type="button" className="pf-item" onClick={() => navigate('/faqs')}>
              <span className="pf-icoL">
                <IcDoc />
              </span>
              <span className="pf-item__txt">FAQs</span>
              <RowArrow />
            </button>
          </div>

          <h3 className="pf-secT">Account</h3>
          <div className="pf-secB">
            <button type="button" className="pf-item" onClick={() => navigate('/privacy-policy')}>
              <span className="pf-icoL">
                <IcLock />
              </span>
              <span className="pf-item__txt">Privacy Policy</span>
              <RowArrow />
            </button>
            <button type="button" className="pf-item" onClick={() => navigate('/terms')}>
              <span className="pf-icoL">
                <IcDoc />
              </span>
              <span className="pf-item__txt">Terms &amp; Conditions</span>
              <RowArrow />
            </button>
            <button type="button" className="pf-item pf-item--logout" onClick={logout}>
              <span className="pf-icoL" style={{ color: 'transparent', width: '0.1rem' }} />
              <span className="pf-item__txt">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <button type="button" className="pf-chatFab" onClick={() => navigate('/chat/support')} aria-label="Open chat with admin support">
        <span style={{ display: 'flex', transform: 'scale(1.15)' }} aria-hidden>
          <IcChatSupport />
        </span>
      </button>
    </div>
  );
}
