import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CarIcon from '../components/icons/CarIcon';
import LiveUserGoogleMap from '../components/LiveUserGoogleMap';
import GoogleMapEmbed from '../components/GoogleMapEmbed';
import LocationPermissionPrompt from '../components/LocationPermissionPrompt';
import '../components/customer/CustomerApp.css';
import { getCustomerSession } from '../lib/customerSession';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { getGoogleMapsApiKey, publicViewMapUrl } from '../lib/googleMapsConfig';

const LOCATION = 'London, Shoreditch';
/** Stable map center when GPS is off (avoids wrong city from text-only embeds). */
const HOME_MAP_FALLBACK = { lat: 51.5246, lng: -0.0772 };

/** First word of `full_name`, else email local-part — matches `app_users` / session shape. */
function greetingFirstName(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const full = String(profile.full_name || '').trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    return first || full;
  }
  const email = String(profile.email || '').trim();
  if (email && email.includes('@')) {
    return email.split('@')[0] || '';
  }
  return '';
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path
        d="M12 3a4.5 4.5 0 0 0-4.5 4.5V10l-1.2 2.4A1 1 0 0 1 7.2 14h9.6a1 1 0 0 1 .9-1.6L17 10V7.5A4.5 4.5 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M10.5 18a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M12 2.2a4.1 4.1 0 0 0-4.1 4.1c0 3.1 4.1 7.4 4.1 7.4s4.1-4.3 4.1-7.4A4.1 4.1 0 0 0 12 2.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      <circle cx="12" cy="6.3" r="1" fill="#fff" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="ch-search__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="5.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M15.2 15.2L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function IconCar() {
  return <CarIcon size={22} />;
}
function IconBag() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M6 7h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
const services = [
  { id: 'delivery', label: 'Delivery', Icon: IconBox },
  { id: 'taxi', label: 'Taxi', Icon: IconCar },
  { id: 'shop', label: 'Shop', Icon: IconBag },
];

/** When true, home skips Maps JavaScript API and uses embed only (e.g. if JS stays blocked). */
function useHomeMapsEmbedOnly() {
  return useMemo(
    () => String(process.env.REACT_APP_HOME_USE_MAPS_EMBED_ONLY || '').trim().toLowerCase() === 'true',
    [],
  );
}

export default function CustomerHomePage() {
  const navigate = useNavigate();
  const displayName = useMemo(() => greetingFirstName(getCustomerSession()), []);
  const live = useLiveLocation({ mapThrottleMs: 4000 });
  const { refreshFromUserGesture } = live;
  const homeEmbedOnly = useHomeMapsEmbedOnly();
  const hasMapsKey = Boolean(getGoogleMapsApiKey());
  const [homeJsMapFailed, setHomeJsMapFailed] = useState(false);
  const useEmbedHomeMap = homeEmbedOnly || !hasMapsKey || homeJsMapFailed;
  const homeMapSrc = useMemo(() => {
    const c = live.mapCenter;
    if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
      return publicViewMapUrl(c.lat, c.lng, 15);
    }
    return publicViewMapUrl(HOME_MAP_FALLBACK.lat, HOME_MAP_FALLBACK.lng, 14);
  }, [live.mapCenter]);

  /** JS map: follow raw lat/lng so marker/center stay in sync with GPS (mapCenter is throttled for embed URLs). */
  const homeJsMapCenter = useMemo(() => {
    if (live.hasFix && live.lat != null && live.lng != null) {
      return { lat: live.lat, lng: live.lng };
    }
    return live.mapCenter;
  }, [live.hasFix, live.lat, live.lng, live.mapCenter]);

  const refreshLocation = useCallback(async () => {
    try {
      await refreshFromUserGesture();
    } catch {
      /* watchPosition may still deliver a fix; user can try again */
    }
  }, [refreshFromUserGesture]);

  const chMapModifier = !useEmbedHomeMap || homeMapSrc ? ' ch-map--gmap' : '';

  return (
    <div className="ch-home" role="main" aria-label="InGo home">
      <div
        className={`ch-map${chMapModifier}`}
        role="region"
        aria-label="Map and your location"
      >
        {useEmbedHomeMap ? (
          <GoogleMapEmbed src={homeMapSrc} title="Map near your location" loading="eager" />
        ) : (
          <LiveUserGoogleMap
            mapCenter={homeJsMapCenter}
            fallbackCenter={HOME_MAP_FALLBACK}
            hasFix={live.hasFix}
            accurate={live.hasFix}
            accuracyM={live.accuracy}
            onLoadError={() => setHomeJsMapFailed(true)}
          />
        )}
        {homeJsMapFailed && hasMapsKey && !homeEmbedOnly ? (
          <p className="ch-map__keyHint" role="status">
            Interactive map was blocked by your Google Cloud key (common:{' '}
            <strong>ApiTargetBlockedMapError</strong>). Using the embed map instead. Fix: Google Cloud Console → APIs and
            Services → Credentials → your browser key → add this origin under <strong>HTTP referrers</strong> (e.g.{' '}
            <code className="ch-map__keyHintCode">http://localhost:3000/*</code> and{' '}
            <code className="ch-map__keyHintCode">http://127.0.0.1:3000/*</code>) and ensure <strong>Maps JavaScript API</strong>{' '}
            is allowed. To skip JS and use embed only, set{' '}
            <code className="ch-map__keyHintCode">REACT_APP_HOME_USE_MAPS_EMBED_ONLY=true</code>.
          </p>
        ) : null}
        {!live.hasFix && live.geoError !== 'denied' && (
          <button type="button" className="ch-locateBtn" onClick={refreshLocation} aria-label="Find my location">
            <span className="ch-locateBtn__ic" aria-hidden>
              ◎
            </span>
            <span className="ch-locateBtn__tx">My location</span>
          </button>
        )}
      </div>

      <header className="ch-header">
        <div className="ch-topbar">
          <h1 className="ch-greeting">{displayName ? `Hello, ${displayName}` : 'Hello'}</h1>
          <div className="ch-actions">
            <button
              type="button"
              className="ch-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate('/notifications')}
            >
              <BellIcon />
            </button>
          </div>
        </div>
        <div className="ch-loc">
          <span className="ch-loc__pin" aria-hidden>
            <PinIcon />
          </span>
          <span className="ch-loc__text" title={LOCATION}>
            {LOCATION}
          </span>
        </div>
      </header>

      <div className="ch-stack">
        <div className="ch-sheet">
          <div className="ch-sheet__scroll">
            <div className="ch-search" role="search">
              <SearchIcon />
              <input
                className="ch-search__input"
                type="search"
                placeholder="Where are you going or what do you need?"
                aria-label="Search destination or service"
              />
            </div>

            <section className="ch-sec--services" aria-label="Services">
              <div className="ch-services">
                {services.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className="ch-svc"
                    aria-label={label}
                    onClick={() => {
                      if (id === 'delivery') navigate('/request-delivery');
                      if (id === 'taxi') navigate('/book-ride');
                      if (id === 'shop') navigate('/shops');
                    }}
                  >
                    <span className="ch-svc__icon">
                      <Icon />
                    </span>
                    <span className="ch-svc__label">{label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="ch-cta-wrap">
          <button
            type="button"
            className="ch-cta"
            onClick={() => navigate('/request-now')}
          >
            Request Now
          </button>
        </div>
      </div>
      <LocationPermissionPrompt live={live} placement="customer" />
    </div>
  );
}
