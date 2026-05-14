import { useCallback, useEffect, useRef, useState } from 'react';
import { readDeviceGpsPosition } from '../lib/devicePickupLocation';
import { isReliableGpsLatLng } from '../lib/googleMapsConfig';
import { whenMedianGeolocationReady } from '../lib/medianGeolocation';

const GEO_LOG = '[geolocation]';

const LAST_FIX_KEY = 'ingo_last_geo_fix';

function readCachedFix() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    const ts = Number(parsed?.ts);
    if (!isReliableGpsLatLng(lat, lng)) return null;
    if (!Number.isFinite(ts)) return null;
    return { lat, lng, ts };
  } catch {
    return null;
  }
}

function saveCachedFix(lat, lng) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {
    // ignore
  }
}

/** ~meters between two WGS84 points (good enough for “did we move?”). */
function metersApart(a, b) {
  if (!a || !b) return Infinity;
  const la = Number(a.lat);
  const lo = Number(a.lng);
  const lb = Number(b.lat);
  const ln = Number(b.lng);
  if (![la, lo, lb, ln].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const dLat = ((lb - la) * Math.PI) / 180;
  const dLng = ((ln - lo) * Math.PI) / 180;
  const m =
    dLat * dLat +
    Math.cos((la * Math.PI) / 180) * Math.cos((lb * Math.PI) / 180) * dLng * dLng;
  return R * Math.sqrt(Math.max(0, m));
}

/**
 * Live geolocation + optional compass heading for map overlays.
 * `mapCenter` is throttled so embed iframes are not constantly reloaded, but we always
 * publish a new center when the device moves meaningfully or after a forced refresh
 * (tab focus / mount) so returning to the app does not stick on last session’s coords.
 *
 * `refreshFromUserGesture()` — call from a click handler (e.g. “Use my current location”).
 * Updates lat/lng/map immediately; helps installed PWAs / iOS where watch-only is slow.
 */
export function useLiveLocation(options = {}) {
  const throttleMs = options.mapThrottleMs ?? 4000;
  const movePublishM = options.movePublishMeters ?? 55;
  const [lat, setLat] = useState(() => readCachedFix()?.lat ?? null);
  const [lng, setLng] = useState(() => readCachedFix()?.lng ?? null);
  const [accuracy, setAccuracy] = useState(null);
  const [mapCenter, setMapCenter] = useState(() => {
    const fix = readCachedFix();
    return fix ? { lat: fix.lat, lng: fix.lng } : null;
  });
  const [headingDeg, setHeadingDeg] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const lastMapTick = useRef(0); /* 0 => first fix always updates map center */
  const lastPublishedMapCenterRef = useRef(null);
  const gpsHeadingRef = useRef(null);

  const ingestPosition = useCallback(
    (position, opts = {}) => {
      const { forceMapUpdate = false } = opts;
      const { latitude, longitude, heading, accuracy: acc } = position.coords;
      if (!isReliableGpsLatLng(latitude, longitude)) {
        return false;
      }
      setGeoError(null);
      setLat(latitude);
      setLng(longitude);
      setAccuracy(typeof acc === 'number' ? acc : null);
      saveCachedFix(latitude, longitude);
      if (typeof heading === 'number' && !Number.isNaN(heading) && heading >= 0) {
        gpsHeadingRef.current = heading;
        setHeadingDeg(heading);
      } else {
        gpsHeadingRef.current = null;
      }
      const nextCenter = { lat: latitude, lng: longitude };
      const now = Date.now();
      const prev = lastPublishedMapCenterRef.current;
      const movedEnough = prev == null || metersApart(prev, nextCenter) >= movePublishM;
      const dueByTime = forceMapUpdate || now - lastMapTick.current >= throttleMs;
      if (dueByTime || movedEnough) {
        lastMapTick.current = now;
        lastPublishedMapCenterRef.current = nextCenter;
        setMapCenter(nextCenter);
      }
      return true;
    },
    [throttleMs, movePublishM],
  );

  const refreshFromUserGesture = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const e = new Error('unsupported');
      e.code = 0;
      throw e;
    }
    const pos = await readDeviceGpsPosition();
    const ok = ingestPosition(pos, { forceMapUpdate: true });
    if (!ok) {
      const e = new Error('invalid');
      e.code = 2;
      throw e;
    }
    return pos.coords;
  }, [ingestPosition]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('unsupported');
      return undefined;
    }
    let cancelled = false;
    let watchId = null;
    (async () => {
      try {
        await whenMedianGeolocationReady();
        if (cancelled || !navigator.geolocation) return;
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            ingestPosition(pos, { forceMapUpdate: false });
          },
          (err) => {
            console.error(`${GEO_LOG} watchPosition error`, {
              code: err.code,
              message: err.message,
            });
            setGeoError(err.code === 1 ? 'denied' : 'unavailable');
          },
          {
            enableHighAccuracy: true,
            /* Prefer fresh fixes after reopen / travel; cache still used only until first callback */
            maximumAge: 0,
            /* Mobile / PWA: allow slow first fix instead of constant timeout errors */
            timeout: 90000,
          },
        );
        console.log(`${GEO_LOG} watchPosition started`);
      } catch (e) {
        console.error(`${GEO_LOG} watchPosition setup failed`, e);
        setGeoError('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [ingestPosition]);

  /** Fresh read on mount so we do not stay on localStorage / last session until watch catches up. */
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let cancelled = false;
    readDeviceGpsPosition()
      .then((pos) => {
        if (!cancelled) ingestPosition(pos, { forceMapUpdate: true });
      })
      .catch(() => {
        /* watchPosition may still deliver; permission may need a gesture */
      });
    return () => {
      cancelled = true;
    };
  }, [ingestPosition]);

  /** User left the tab or closed laptop, then came back — re-read real position. */
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      readDeviceGpsPosition()
        .then((pos) => {
          ingestPosition(pos, { forceMapUpdate: true });
        })
        .catch(() => {});
    };
    const onPageShow = (e) => {
      if (e.persisted) onVisible();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [ingestPosition]);

  useEffect(() => {
    if (!navigator.permissions?.query) return undefined;
    let perm;
    const onChange = () => {
      if (perm && perm.state === 'granted') {
        refreshFromUserGesture().catch(() => {});
      }
    };
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (cancelled) return;
        perm = p;
        p.addEventListener('change', onChange);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (perm) perm.removeEventListener('change', onChange);
    };
  }, [refreshFromUserGesture]);

  useEffect(() => {
    if (lat != null || lng != null) return undefined;
    const once = () => {
      refreshFromUserGesture().catch(() => {});
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('touchstart', once, true);
    };
    window.addEventListener('pointerdown', once, true);
    window.addEventListener('touchstart', once, true);
    return () => {
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('touchstart', once, true);
    };
  }, [lat, lng, refreshFromUserGesture]);

  useEffect(() => {
    const onOrient = (e) => {
      if (gpsHeadingRef.current != null) return;
      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        setHeadingDeg(e.webkitCompassHeading);
        return;
      }
      if (e.absolute && typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        setHeadingDeg((360 - e.alpha + 360) % 360);
      }
    };
    window.addEventListener('deviceorientation', onOrient, true);
    return () => window.removeEventListener('deviceorientation', onOrient, true);
  }, []);

  return {
    lat,
    lng,
    accuracy,
    mapCenter,
    headingDeg,
    geoError,
    hasFix: lat != null && lng != null,
    refreshFromUserGesture,
  };
}
