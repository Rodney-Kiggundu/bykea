/** `http://localhost:4000` or full `…/paynow/initiate` — Paynow Node API (repo `server/`, e.g. Railway). */
export function resolveShopPaynowLocalInitiateUrl() {
  const raw = String(process.env.REACT_APP_SHOP_PAYNOW_LOCAL_URL || '').trim();
  if (!raw) return '';
  const noTrail = raw.replace(/\/$/, '');
  if (/\/paynow\/initiate$/i.test(noTrail)) return noTrail;
  return `${noTrail}/paynow/initiate`;
}

/** Base origin only (no `/paynow/initiate`), for diagnostics. */
export function resolveShopPaynowLocalBaseUrl() {
  const raw = String(process.env.REACT_APP_SHOP_PAYNOW_LOCAL_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  return raw.replace(/\/paynow\/initiate$/i, '');
}

function paynowNetworkFailureHint() {
  const base = resolveShopPaynowLocalBaseUrl();
  if (!base) {
    return ' Set REACT_APP_SHOP_PAYNOW_LOCAL_URL in `.env.development` / `.env.production` or `.env.local`, then restart `npm start` (or run a fresh `npm run build`).';
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(base)) {
    return ' Start the Paynow API (`cd server && npm start`) or change REACT_APP_SHOP_PAYNOW_LOCAL_URL to your live API (e.g. Railway HTTPS URL).';
  }
  return ` Open ${base}/health in a browser; confirm Railway is running the Paynow Docker service (not the React app). If you still have REACT_APP_SHOP_PAYNOW_LOCAL_URL=http://localhost:4000 in .env.local, remove or update it so it does not override .env.development.`;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ ok: boolean, redirectUrl?: string, error?: string }>}
 */
export async function postLocalPaynowInitiate(body) {
  const url = resolveShopPaynowLocalInitiateUrl();
  if (!url) {
    return { ok: false, error: 'Paynow is not configured (set REACT_APP_SHOP_PAYNOW_LOCAL_URL).' };
  }
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
