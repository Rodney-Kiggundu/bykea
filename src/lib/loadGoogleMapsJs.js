import { getGoogleMapsApiKey } from './googleMapsConfig';

let loadPromise = null;
let gmAuthFailureHooked = false;

const GM_AUTH_EVENT = 'ingo-google-maps-auth-failure';

function hookGmAuthFailureOnce() {
  if (typeof window === 'undefined' || gmAuthFailureHooked) return;
  gmAuthFailureHooked = true;
  const prev = typeof window.gm_authFailure === 'function' ? window.gm_authFailure : null;
  window.gm_authFailure = function ingoGmAuthFailure() {
    try {
      if (prev && prev !== window.gm_authFailure) prev();
    } catch (_) {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(GM_AUTH_EVENT));
  };
}

export { GM_AUTH_EVENT };

/**
 * Loads the Maps JavaScript API once (shared across the app).
 * Enable **Maps JavaScript API** for the same browser key used for Embed.
 *
 * @returns {Promise<typeof globalThis.google>}
 */
export function loadGoogleMapsJs() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'));
  }
  if (window.google?.maps?.Map) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error('no api key'));
  }

  hookGmAuthFailureOnce();

  loadPromise = new Promise((resolve, reject) => {
    const cbName = '__ingoGoogleMapsJsCb';
    window[cbName] = () => {
      try {
        if (window.google?.maps?.Map) {
          resolve(window.google);
        } else {
          loadPromise = null;
          reject(new Error('maps api loaded without Map'));
        }
      } catch (e) {
        loadPromise = null;
        reject(e);
      } finally {
        try {
          delete window[cbName];
        } catch {
          window[cbName] = undefined;
        }
      }
    };

    const s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.dataset.ingGoogleMapsJs = '1';
    s.onerror = () => {
      loadPromise = null;
      try {
        delete window[cbName];
      } catch {
        window[cbName] = undefined;
      }
      reject(new Error('script blocked or failed'));
    };
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cbName}`;
    document.head.appendChild(s);
  });

  return loadPromise;
}

/** For tests or forced re-fetch after a failed load. */
export function resetGoogleMapsJsLoaderForTests() {
  loadPromise = null;
}
