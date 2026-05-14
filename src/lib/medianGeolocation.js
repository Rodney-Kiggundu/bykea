/**
 * Median.co (GoNative) WebView: on iOS, native calls `window.median_geolocation_ready`
 * after location services initialize. Geolocation API calls must wait to avoid duplicate prompts.
 *
 * @see https://docs.median.co/me/docs/location-services
 */

const LOG_PREFIX = '[geolocation]';

/** Median iOS / legacy GoNative iOS — the platform that invokes median_geolocation_ready. */
export function isMedianIosWebView() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /MedianIOS/i.test(ua) || /GoNativeIOS/i.test(ua);
}

let settled = false;
let readyPromise = Promise.resolve();
let resolveReady = () => {};

function resolveMedianReady(reason) {
  if (settled) return;
  settled = true;
  console.log(`${LOG_PREFIX} Median bridge ready — proceeding with geolocation (${reason})`);
  resolveReady();
}

function installMedianCallback() {
  if (typeof window === 'undefined') return;

  readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const previous =
    typeof window.median_geolocation_ready === 'function' ? window.median_geolocation_ready : null;

  window.median_geolocation_ready = function median_geolocation_ready() {
    console.log(`${LOG_PREFIX} window.median_geolocation_ready() invoked (Median native)`);
    if (previous && previous !== window.median_geolocation_ready) {
      try {
        previous();
      } catch (e) {
        console.error(`${LOG_PREFIX} previous median_geolocation_ready handler failed`, e);
      }
    }
    resolveMedianReady('native_callback');
  };

  if (!isMedianIosWebView()) {
    resolveMedianReady('browser_or_non_ios_median');
    return;
  }

  console.log(
    `${LOG_PREFIX} Median iOS WebView detected — geolocation API calls wait for median_geolocation_ready()`,
  );

  const SAFETY_MS = 45000;
  setTimeout(() => {
    if (!settled) {
      console.warn(
        `${LOG_PREFIX} median_geolocation_ready() not received within ${SAFETY_MS}ms — using fallback so the app is not blocked`,
      );
      resolveMedianReady('timeout_fallback');
    }
  }, SAFETY_MS);
}

installMedianCallback();

/**
 * Resolves before any `navigator.geolocation` read/watch should run.
 * Immediate in browsers and Median Android; on Median iOS waits for native callback (or safety timeout).
 */
export function whenMedianGeolocationReady() {
  if (typeof window === 'undefined') return Promise.resolve();
  return readyPromise;
}
