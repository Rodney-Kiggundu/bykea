import { useCallback, useEffect, useState } from 'react';
import './LocationPermissionPrompt.css';

const LS_SOFT = 'ingo_geo_prompt_soft_dismiss';
const LS_DENIED = 'ingo_geo_prompt_denied_dismiss';

function readLs(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeLs(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function isStandaloneDisplay() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.navigator?.standalone === true) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Shown when we still need a GPS fix. Primary button runs `live.refreshFromUserGesture()`
 * so the browser / PWA can show the system location permission dialog on a real tap.
 *
 * `placement="customer"` — fixed above bottom nav (uses inherited `--bnav-total`).
 * `placement="flow"` — inline between map and sheet on delivery / taxi screens.
 */
export default function LocationPermissionPrompt({ live, placement = 'customer' }) {
  const [busy, setBusy] = useState(false);
  const [softDismissed, setSoftDismissed] = useState(() => readLs(LS_SOFT));
  const [deniedDismissed, setDeniedDismissed] = useState(() => readLs(LS_DENIED));

  useEffect(() => {
    if (!live.hasFix) return;
    writeLs(LS_SOFT, '1');
    writeLs(LS_DENIED, '1');
  }, [live.hasFix]);

  const onAllow = useCallback(async () => {
    setBusy(true);
    try {
      await live.refreshFromUserGesture();
    } catch {
      // geoError / UI will reflect denied or unavailable
    } finally {
      setBusy(false);
    }
  }, [live]);

  const onSoftDismiss = useCallback(() => {
    setSoftDismissed(true);
    writeLs(LS_SOFT, '1');
  }, []);

  const onDeniedDismiss = useCallback(() => {
    setDeniedDismissed(true);
    writeLs(LS_DENIED, '1');
  }, []);

  if (live.hasFix) return null;
  if (live.geoError === 'unsupported') return null;

  const rootClass = placement === 'flow' ? 'loc-perm loc-perm--flow' : 'loc-perm loc-perm--customer';
  const standalone = isStandaloneDisplay();

  if (live.geoError === 'denied') {
    if (deniedDismissed) return null;
    return (
      <aside className={rootClass} role="alert" aria-label="Location permission">
        <p className="loc-perm__title">Location is off</p>
        <p className="loc-perm__text">
          {standalone
            ? 'For this installed app, open your device settings and allow Location for your browser or InGo. Then tap Retry.'
            : 'Allow location for this site in your browser settings, then tap Retry.'}
        </p>
        <div className="loc-perm__actions">
          <button type="button" className="loc-perm__btn loc-perm__btn--primary" disabled={busy} onClick={onAllow}>
            {busy ? 'Checking…' : 'Retry'}
          </button>
          <button type="button" className="loc-perm__btn loc-perm__btn--ghost" onClick={onDeniedDismiss}>
            Dismiss
          </button>
        </div>
      </aside>
    );
  }

  if (softDismissed) return null;

  return (
    <aside className={rootClass} role="region" aria-label="Location permission">
      <p className="loc-perm__title">{standalone ? 'Allow location for InGo' : 'Use your location'}</p>
      <p className="loc-perm__text">
        {standalone
          ? 'Tap Allow so we can show where you are on the map and fill pickup more accurately in this installed app.'
          : 'Tap Allow so we can show your position on the map and use “My current location” for pickup.'}
      </p>
      <div className="loc-perm__actions">
        <button type="button" className="loc-perm__btn loc-perm__btn--primary" disabled={busy} onClick={onAllow}>
          {busy ? 'Waiting…' : 'Allow location'}
        </button>
        <button type="button" className="loc-perm__btn loc-perm__btn--ghost" disabled={busy} onClick={onSoftDismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}
