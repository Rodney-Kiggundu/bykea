import { reverseGeocodeLatLng } from './reverseGeocode';
import { whenMedianGeolocationReady } from './medianGeolocation';

const GEO_LOG = '[geolocation]';

/** Longer timeouts help installed PWAs / mobile where the first fix is slow. */
const OPT_HIGH_ACCURACY = { enableHighAccuracy: true, maximumAge: 0, timeout: 90000 };
const OPT_NETWORK_FALLBACK = { enableHighAccuracy: false, maximumAge: 0, timeout: 120000 };
const REVERSE_GEO_MS = 12000;

/**
 * Human-readable coordinates when reverse geocoding is slow or unavailable.
 * Nominatim / Google geocode can usually resolve "lat, lng" strings.
 */
export function formatLatLngForPickup(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
  return `${la.toFixed(5)}, ${lo.toFixed(5)}`;
}

export function geolocationFailureMessage(code) {
  switch (code) {
    case 1:
      return 'Location permission denied. Allow location for this site in your browser or phone settings, then try again.';
    case 2:
      return 'Location unavailable. Try moving outdoors, turning on Wi‑Fi, or type your address.';
    case 3:
      return 'Location timed out. Try again, or type your pickup address.';
    default:
      return 'Could not use your location. Use HTTPS, update your browser, or type your address.';
  }
}

async function readCurrentPosition(options) {
  await whenMedianGeolocationReady();
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log(`${GEO_LOG} getCurrentPosition success`, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        resolve(position);
      },
      (err) => {
        console.error(`${GEO_LOG} getCurrentPosition error`, {
          code: err.code,
          message: err.message,
        });
        reject(err);
      },
      options,
    );
  });
}

/**
 * One-shot GPS read suitable for a button tap (satisfies mobile / PWA permission UX).
 * Retries with network / Wi‑Fi location if GPS times out or is unavailable.
 *
 * @returns {Promise<GeolocationPosition>}
 */
export async function readDeviceGpsPosition() {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    const err = new Error('insecure');
    err.code = 2;
    throw err;
  }

  try {
    return await readCurrentPosition(OPT_HIGH_ACCURACY);
  } catch (firstErr) {
    const c = firstErr?.code;
    if (c === 2 || c === 3) {
      return readCurrentPosition(OPT_NETWORK_FALLBACK);
    }
    throw firstErr;
  }
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>} Pickup line: reverse-geocoded address, or "lat, lng".
 */
export async function pickupLineFromCoords(latitude, longitude) {
  const coordLine = formatLatLngForPickup(latitude, longitude);
  const line = await Promise.race([
    reverseGeocodeLatLng(latitude, longitude),
    new Promise((resolve) => {
      setTimeout(() => resolve(''), REVERSE_GEO_MS);
    }),
  ]);

  const trimmed = String(line || '').trim();
  return trimmed || coordLine;
}

/**
 * @returns {Promise<string>} Pickup line: reverse-geocoded address, or "lat, lng".
 */
export async function resolvePickupLineFromDeviceGps() {
  const pos = await readDeviceGpsPosition();
  return pickupLineFromCoords(pos.coords.latitude, pos.coords.longitude);
}
