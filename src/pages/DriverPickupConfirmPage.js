import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_DRIVER_ORDER } from '../data/driverOrderDefaults';
import './driverDelivery.css';

const CHK = ['Package matches description', 'Package is sealed properly', 'Correct package size'];

function Back() {
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
function LocPin() {
  return (
    <svg className="pu-icoG" viewBox="0 0 24 24" width="40" height="40" fill="none" aria-hidden>
      <path
        d="M12 2.2a4.2 4.2 0 0 0-3.5 1.5L2.1 9.1a.6.6 0 0 0 .1.8L12 22.2l9.6-10.1a.6.6 0 0 0 0-1.2L15.4 3.7A4.1 4.1 0 0 0 12 2.2Z"
        fill="#F18631"
      />
      <circle cx="12" cy="8.2" r="1.2" fill="#fff" />
    </svg>
  );
}

export default function DriverPickupConfirmPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const o = useMemo(
    () => (state?.order ? { ...DEFAULT_DRIVER_ORDER, ...state.order } : { ...DEFAULT_DRIVER_ORDER }),
    [state],
  );
  const [otp, setOtp] = useState(['', '', '', '']);
  const [focus, setFocus] = useState(0);
  const [checks, setChecks] = useState(() => ({}));
  const [hasPhoto, setHasPhoto] = useState(false);

  const onOtp = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const n = [...otp];
    n[i] = d;
    setOtp(n);
    if (d && i < 3) setFocus(i + 1);
  };
  const toggleC = (label) => {
    setChecks((c) => ({ ...c, [label]: !c[label] }));
  };
  const can = CHK.every((c) => checks[c]) && otp.join('').length === 4 && hasPhoto;
  const next = useCallback(
    () =>
      navigate('/driver/delivery-status', { state: { order: o, fromPickup: true } }),
    [navigate, o],
  );

  return (
    <div className="pu-page dd" role="main" aria-label="Confirm pickup">
      <header
        className="pu-h"
        style={{ position: 'relative' }}
      >
        <button type="button" className="pu-bk" onClick={() => navigate(-1)} aria-label="Back">
          <Back />
        </button>
        <h1>Confirm Pickup</h1>
      </header>
      <div
        className="pu-m"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 120 80"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          aria-hidden
        >
          <rect width="120" height="80" fill="url(#g0)" />
          <defs>
            <linearGradient id="g0" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5a6a7a" />
              <stop offset="1" stopColor="#3a4a5a" />
            </linearGradient>
          </defs>
        </svg>
        <div className="pu-pinPulse" style={{ position: 'relative', zIndex: 1 }} aria-hidden />
      </div>
      <div className="pu-c">
        <LocPin />
        <p className="pu-ib">You are at pickup location</p>
        <p className="pu-ia2">{o.from}</p>
      </div>
      <div className="pu-s">
        <h2 className="pu-secL">Verify with customer</h2>
        <div className="pu-otpR" role="group" aria-label="Enter 4 digit OTP from customer">
          {otp.map((d, i) => (
            <input
              key={i}
              className="dd-inp"
              value={d}
              inputMode="numeric"
              maxLength={1}
              onFocus={() => setFocus(i)}
              style={{ borderColor: focus === i ? '' : undefined }}
              onChange={(e) => onOtp(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && setFocus(i - 1)}
              id={`op-${i}`}
            />
          ))}
        </div>
        <h2 className="pu-secL" style={{ marginTop: 8 }}>Confirm package details</h2>
        <div className="pu-chL" role="list">
          {CHK.map((label) => (
            <button
              type="button"
              key={label}
              className="pu-chI"
              onClick={() => toggleC(label)}
            >
              <span
                className={checks[label] ? 'pu-cb pu-cb--on' : 'pu-cb'}
                aria-hidden
              >
                {checks[label] ? '✓' : ''}
              </span>
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pu-pic"
          onClick={() => setHasPhoto(true)}
        >
          <div style={{ color: '#7a7a7a' }}>📷</div>
          <span className="pu-ptx">Take package photo</span>
          {hasPhoto && <span className="pu-ps" aria-live="polite">Photo attached (demo)</span>}
        </button>
        <button type="button" className="pu-sub" onClick={next} disabled={!can}>
          Confirm &amp; Start Delivery
        </button>
        {!can && (
          <p className="pu-ia2" style={{ textAlign: 'center', color: '#999', fontSize: 11, margin: '0.1rem' }}>
            Complete checklist, photo, and OTP
          </p>
        )}
      </div>
    </div>
  );
}
