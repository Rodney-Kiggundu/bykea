/** `http://localhost:4000` or full `…/paynow/initiate` — local Paynow API (repo `server/`). */
export function resolveShopPaynowLocalInitiateUrl() {
  const raw = String(process.env.REACT_APP_SHOP_PAYNOW_LOCAL_URL || '').trim();
  if (!raw) return '';
  const noTrail = raw.replace(/\/$/, '');
  if (/\/paynow\/initiate$/i.test(noTrail)) return noTrail;
  return `${noTrail}/paynow/initiate`;
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
        error: `Local Paynow server returned ${r.status}. Run \`cd server && npm start\` (default port 4000).`,
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
          'Could not start Paynow. Check `server/.env` (Paynow keys + URLs) and that the local API is running.',
      };
    }
    return { ok: true, redirectUrl: payData.redirectUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    const netHint =
      /Failed to fetch|NetworkError|fetch/i.test(msg) ||
      (err instanceof Error && String(err.cause?.message || '').includes('fetch'))
        ? ' Start the local API: `cd server && npm start`, and set `REACT_APP_SHOP_PAYNOW_LOCAL_URL` in `.env.local`. Restart the dev server after env changes.'
        : '';
    return { ok: false, error: (err instanceof Error ? err.message : 'Could not start Paynow.') + netHint };
  }
}
