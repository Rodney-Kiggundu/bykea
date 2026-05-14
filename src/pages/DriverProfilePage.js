import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearDriverSession, getDriverSession } from '../lib/driverSession';
import { formatGBP } from '../lib/currency';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { formatVehicleTypeForDisplay } from '../lib/vehicleTypeDisplay';
import './driverEarningsWalletProfile.css';

const DOC_ROWS = [
  { key: 'doc_national_id_url', label: 'National ID / Passport' },
  { key: 'doc_license_url', label: "Driver's license" },
  { key: 'doc_vehicle_registration_url', label: 'Vehicle registration' },
  { key: 'doc_profile_with_vehicle_url', label: 'Profile photo with vehicle' },
];

function initials(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || '').trim());
}

function docLinkLabel(url) {
  const u = String(url || '').trim();
  if (!u) return '—';
  if (u.startsWith('pending:')) return 'On file (pending upload)';
  if (isHttpUrl(u)) return 'Open file';
  return u.length > 40 ? `${u.slice(0, 40)}…` : u;
}

export default function DriverProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getDriverSession();
    if (!session?.id) {
      navigate('/driver/login', { replace: true });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setProfile(session);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase.from('driver_registrations').select('*').eq('id', session.id).maybeSingle();
      if (cancelled) return;
      const merged = { ...session, ...(data && !error ? data : {}) };
      setProfile(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onLogout = () => {
    clearDriverSession();
    navigate('/driver/login', { replace: true });
  };

  if (!profile && loading) {
    return (
      <div className="dpr" role="main" aria-label="Driver profile">
        <header className="dpr-hero">
          <div className="dpr-av" aria-hidden>
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
              }}
            />
          </div>
          <h1 className="dpr-n">Loading…</h1>
        </header>
      </div>
    );
  }

  if (!profile) return null;

  const photo = profile.profile_photo_url;
  const showPhoto = photo && isHttpUrl(photo);
  const deposit = Number(profile.deposit_required_gbp ?? 10);
  const paid = Boolean(profile.deposit_paid);

  return (
    <div className="dpr" role="main" aria-label="Driver profile">
      <header className="dpr-hero">
        <div className="dpr-av" aria-hidden>
          {showPhoto ? (
            <img
              src={photo}
              alt=""
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
                color: '#5a4030',
                background: 'linear-gradient(150deg, #F6B27E, #e8f5e9)',
              }}
            >
              {initials(profile.full_name)}
            </div>
          )}
        </div>
        <h1 className="dpr-n">{profile.full_name || 'Driver'}</h1>
        <p className="dpr-p">{profile.email || '—'}</p>
      </header>

      <div className="dpr-sc">
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: '#555', lineHeight: 1.45 }}>
          Details below are what you submitted when you registered. Contact support if anything needs updating.
        </p>
        <div className="dpr-secB" style={{ marginBottom: '0.65rem' }}>
          <Link
            to="/driver/chat"
            className="dprIt"
            style={{ textDecoration: 'none', display: 'block', textAlign: 'center', color: '#A85612' }}
          >
            Chat
          </Link>
        </div>

        <h2 className="dpr-secH">Contact &amp; ID</h2>
        <div className="dpr-secB dprRegCard">
          <div className="dprRegRow">
            <div className="dprRegLab">Phone</div>
            <div className="dprRegVal">
              {profile.phone_country_code ? `${profile.phone_country_code} ` : ''}
              {profile.phone || '—'}
            </div>
          </div>
          <div className="dprRegRow">
            <div className="dprRegLab">National ID / Passport</div>
            <div className="dprRegVal">{profile.national_id || '—'}</div>
          </div>
        </div>

        <h2 className="dpr-secH">Vehicle</h2>
        <div className="dpr-secB dprRegCard">
          <div className="dprRegRow">
            <div className="dprRegLab">Type</div>
            <div className="dprRegVal">
              {formatVehicleTypeForDisplay(profile.vehicle_type) || profile.vehicle_type || '—'}
            </div>
          </div>
          <div className="dprRegRow">
            <div className="dprRegLab">Make &amp; model</div>
            <div className="dprRegVal">
              {[profile.vehicle_make, profile.vehicle_model].filter(Boolean).join(' ') || '—'}
            </div>
          </div>
          <div className="dprRegRow">
            <div className="dprRegLab">Plate</div>
            <div className="dprRegVal">{profile.vehicle_plate || '—'}</div>
          </div>
          <div className="dprRegRow">
            <div className="dprRegLab">Color</div>
            <div className="dprRegVal">{profile.vehicle_color || '—'}</div>
          </div>
        </div>

        <h2 className="dpr-secH">Deposit (registration)</h2>
        <div className="dpr-secB dprRegCard">
          <div className="dprRegRow">
            <div className="dprRegLab">Amount</div>
            <div className="dprRegVal">{formatGBP(deposit)}</div>
          </div>
          <div className="dprRegRow">
            <div className="dprRegLab">Status</div>
            <div className="dprRegVal">{paid ? 'Paid' : 'Not paid yet'}</div>
          </div>
        </div>

        <h2 className="dpr-secH">Documents you uploaded</h2>
        <div className="dpr-secB dprRegCard">
          {DOC_ROWS.map(({ key, label }) => {
            const url = profile[key];
            const u = String(url || '').trim();
            const openable = isHttpUrl(u);
            return (
              <div key={key} className="dprRegRow">
                <div className="dprRegLab">{label}</div>
                <div className="dprRegVal">
                  {openable ? (
                    <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#F18631', fontWeight: 700 }}>
                      {docLinkLabel(u)}
                    </a>
                  ) : (
                    docLinkLabel(u)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="dpr-secB" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="dprIt dprIt--lo" onClick={onLogout} aria-label="Log out of driver app">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
