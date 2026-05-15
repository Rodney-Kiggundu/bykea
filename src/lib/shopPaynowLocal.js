/** Live Paynow API (Railway). Override with `REACT_APP_SHOP_PAYNOW_LOCAL_URL` if you deploy elsewhere. */
export const DEFAULT_SHOP_PAYNOW_ORIGIN = 'https://bykea-production.up.railway.app';

function isLocalLoopbackPaynowUrl(raw) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(raw || '').trim());
}

/**
 * Paynow calls always go to Railway by default. Values like `http://localhost:4000` in `.env.local`
 * are ignored so a stale local URL does not break checkout; set a non-loopback URL to override.
 */
function effectivePaynowOriginRaw() {
  const fromEnv = String(process.env.REACT_APP_SHOP_PAYNOW_LOCAL_URL || '').trim();
  if (!fromEnv || isLocalLoopbackPaynowUrl(fromEnv)) return DEFAULT_SHOP_PAYNOW_ORIGIN;
  return fromEnv;
}

/** `http://localhost:4000`, full `…/paynow/initiate`, or Railway origin — Paynow Node API (repo `server/`). */
export function resolveShopPaynowLocalInitiateUrl() {
  const raw = effectivePaynowOriginRaw();
  const noTrail = raw.replace(/\/$/, '');
  if (/\/paynow\/initiate$/i.test(noTrail)) return noTrail;
  return `${noTrail}/paynow/initiate`;
}

/** Base origin only (no `/paynow/initiate`), for diagnostics. */
export function resolveShopPaynowLocalBaseUrl() {
  const raw = effectivePaynowOriginRaw().replace(/\/$/, '');
  return raw.replace(/\/paynow\/initiate$/i, '');
}

function paynowNetworkFailureHint() {
  const base = resolveShopPaynowLocalBaseUrl();
  return ` Confirm ${base}/health in your browser. If it loads, open DevTools → Network for the /paynow/initiate request. On Railway set PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, PAYNOW_RESULT_URL, PAYNOW_RETURN_URL.`;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ ok: boolean, redirectUrl?: string, error?: string }>}
 */
export async function postLocalPaynowInitiate(body) {
  const url = resolveShopPaynowLocalInitiateUrl();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let payData = await r.json().catch(() => ({}));
    if (!r.ok && payData && typeof payData === 'object' && !payData.error && !payData.ok) {
      payData = { ...payData, error: `HTTP ${r.status}` };
    } else if (!r.ok && (!payData || typeof payData !== 'object')) {
      payData = {
        ok: false,
        error: `Paynow API returned ${r.status} (non-JSON). Check the server is the Node Paynow app, not a static site.`,
      };
    }
    if (payData?.ok === false || !payData?.redirectUrl) {
      const fromBody = [
        payData?.details?.message,
        payData?.details?.hint,
        payData?.details?.error,
        payData?.details?.status,
        payData?.error,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        ok: false,
        error:
          fromBody ||
          'Could not start Paynow. On the API host, set PAYNOW_* env vars in `server/.env` (or Railway Variables) and redeploy.',
      };
    }
    return { ok: true, redirectUrl: payData.redirectUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    const netHint =
      /Failed to fetch|NetworkError|load failed|fetch/i.test(msg) ||
      (err instanceof Error && String(err.cause?.message || '').toLowerCase().includes('fetch'))
        ? paynowNetworkFailureHint()
        : '';
    return { ok: false, error: (err instanceof Error ? err.message : 'Could not start Paynow.') + netHint };
  }
}
