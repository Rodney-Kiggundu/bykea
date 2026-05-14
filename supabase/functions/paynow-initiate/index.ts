/**
 * Supabase Edge: **paynow-initiate** — starts Paynow checkout, updates `shop_customer_orders`.
 *
 * Deploy:
 *   supabase functions deploy paynow-initiate --no-verify-jwt
 *
 * Secrets (production / live):
 *   supabase secrets set PAYNOW_INTEGRATION_ID=...
 *   supabase secrets set PAYNOW_INTEGRATION_KEY=...
 *   supabase secrets set PAYNOW_RETURN_URL=https://YOUR_DOMAIN/order-confirmation
 *   supabase secrets set PAYNOW_RESULT_URL=https://YOUR_PROJECT.supabase.co/functions/v1/paynow-result
 *   supabase secrets set PAYNOW_OMIT_AUTH_EMAIL=true
 *   # OR: supabase secrets set PAYNOW_MERCHANT_AUTH_EMAIL=you@merchant.com
 *
 * `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are provided automatically on hosted Supabase.
 *
 * Optional: `PAYNOW_INITIATE_URL` — full POST URL (e.g. your HTTPS relay) if outbound calls to Paynow reset from Edge.
 * Optional: `PAYNOW_RELAY_SECRET` — when set with `PAYNOW_INITIATE_URL`, sent as `X-Paynow-Relay-Secret` (relay must reject without it).
 *
 * (Hosted deploy bundles **only** `index.ts` — do not add sibling `.ts` imports.)
 *
 * @see https://developers.paynow.co.zw/docs/initiate_transaction.html
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

/** Paynow SHA-512 (upper hex) — inlined: hosted Supabase bundles only `index.ts`. */
async function sha512UpperHex(plain: string): Promise<string> {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest('SHA-512', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function urlEncode(v: string) {
  return encodeURI(v);
}

function parseQueryString(raw: string) {
  const query: Record<string, string> = {};
  const pairs = (raw[0] === '?' ? raw.substring(1) : raw).split('&');
  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (!k) continue;
    query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return query;
}

/** Paynow response keys vary in casing (`BrowserUrl` vs `browserurl`). */
function pickCi(query: Record<string, string>, key: string): string {
  const want = key.toLowerCase();
  for (const [k, v] of Object.entries(query)) {
    if (k.toLowerCase() === want) return String(v || '').trim();
  }
  return '';
}

async function postPaynowWithFallback(body: string) {
  const custom = Deno.env.get('PAYNOW_INITIATE_URL')?.trim();
  const relaySecret = Deno.env.get('PAYNOW_RELAY_SECRET')?.trim();
  const endpoints = custom
    ? [custom]
    : [
        'https://www.paynow.co.zw/interface/initiatetransaction',
        'https://paynow.co.zw/interface/initiatetransaction',
        'https://www.paynow.co.zw/interface/InitiateTransaction',
        'https://paynow.co.zw/interface/InitiateTransaction',
      ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/plain, */*',
    Connection: 'close',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  if (custom && relaySecret) {
    headers['X-Paynow-Relay-Secret'] = relaySecret;
  }

  let lastErr: unknown = null;
  const maxAttempts = 5;

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = 45_000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          });
          return { res, endpoint };
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        lastErr = e;
        const backoff = Math.min(5000, 350 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const hint =
    /reset|refused|ECONN|network|fetch/i.test(msg)
      ? ' Paynow closed the TLS connection from this region (common from some cloud hosts). Set secret PAYNOW_INITIATE_URL to an HTTPS relay that forwards POSTs to Paynow, or ask Paynow support about API access from your host.'
      : '';
  throw new Error(`${msg}${hint}`);
}

function loadPaynowConfig(): {
  PAYNOW_INTEGRATION_ID: string;
  PAYNOW_INTEGRATION_KEY: string;
  PAYNOW_RETURN_URL: string;
  PAYNOW_RESULT_URL: string;
  PAYNOW_MERCHANT_AUTH_EMAIL: string;
  PAYNOW_OMIT_AUTH_EMAIL: boolean;
} {
  return {
    PAYNOW_INTEGRATION_ID: Deno.env.get('PAYNOW_INTEGRATION_ID')?.trim() || '',
    PAYNOW_INTEGRATION_KEY: Deno.env.get('PAYNOW_INTEGRATION_KEY')?.trim() || '',
    PAYNOW_RETURN_URL: Deno.env.get('PAYNOW_RETURN_URL')?.trim() || '',
    PAYNOW_RESULT_URL: Deno.env.get('PAYNOW_RESULT_URL')?.trim() || '',
    PAYNOW_MERCHANT_AUTH_EMAIL: Deno.env.get('PAYNOW_MERCHANT_AUTH_EMAIL')?.trim() || '',
    PAYNOW_OMIT_AUTH_EMAIL: Deno.env.get('PAYNOW_OMIT_AUTH_EMAIL') === 'true',
  };
}

function resolvePaynowAuthEmail(
  cust: string,
  cfg: ReturnType<typeof loadPaynowConfig>,
): string {
  if (cfg.PAYNOW_MERCHANT_AUTH_EMAIL) return cfg.PAYNOW_MERCHANT_AUTH_EMAIL;
  if (cfg.PAYNOW_OMIT_AUTH_EMAIL) return '';
  return String(cust || '').trim();
}

async function buildPaynowPayload(params: {
  integrationId: string;
  integrationKey: string;
  resultUrl: string;
  returnUrl: string;
  reference: string;
  amount: number;
  info: string;
  authEmail: string;
}) {
  const data: Record<string, string> = {
    resulturl: params.resultUrl,
    returnurl: params.returnUrl,
    reference: params.reference,
    amount: String(params.amount),
    id: params.integrationId,
    additionalinfo: params.info,
    authemail: params.authEmail,
    status: 'Message',
  };
  for (const k of Object.keys(data)) data[k] = urlEncode(data[k]);
  let hashSeed = '';
  for (const k of Object.keys(data)) hashSeed += data[k];
  hashSeed += params.integrationKey.toLowerCase();
  data.hash = await sha512UpperHex(hashSeed);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cfg = loadPaynowConfig();

  const PAYNOW_INTEGRATION_ID = cfg.PAYNOW_INTEGRATION_ID;
  const PAYNOW_INTEGRATION_KEY = cfg.PAYNOW_INTEGRATION_KEY;
  const PAYNOW_RETURN_URL = cfg.PAYNOW_RETURN_URL;
  const PAYNOW_RESULT_URL = cfg.PAYNOW_RESULT_URL;

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !PAYNOW_INTEGRATION_ID ||
    !PAYNOW_INTEGRATION_KEY ||
    !PAYNOW_RETURN_URL ||
    !PAYNOW_RESULT_URL
  ) {
    return json(
      {
        error:
          'Missing configuration. Set Supabase secrets: PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, PAYNOW_RETURN_URL, PAYNOW_RESULT_URL (and PAYNOW_OMIT_AUTH_EMAIL or PAYNOW_MERCHANT_AUTH_EMAIL for test/live rules).',
      },
      500,
    );
  }

  let payload: {
    orderNumber?: string;
    orderId?: string;
    amount?: number;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const orderNumber = String(payload.orderNumber || '').trim();
  const orderId = String(payload.orderId || '').trim();
  const amount = Number(payload.amount || 0);
  const customerEmail = String(payload.customerEmail || '').trim();
  const customerName = String(payload.customerName || '').trim() || 'Customer';
  const roundedAmount = Number(amount.toFixed(2));

  const paynowAuthEmail = resolvePaynowAuthEmail(customerEmail, cfg);

  if (!orderNumber || !orderId || !Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return json({ error: 'orderNumber, orderId and amount are required.' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const requestData = await buildPaynowPayload({
      integrationId: PAYNOW_INTEGRATION_ID,
      integrationKey: PAYNOW_INTEGRATION_KEY,
      resultUrl: PAYNOW_RESULT_URL,
      returnUrl: PAYNOW_RETURN_URL,
      reference: orderNumber,
      amount: roundedAmount,
      info: `Shop order ${orderNumber} (${customerName})`,
      authEmail: paynowAuthEmail,
    });

    const body = new URLSearchParams(requestData).toString();
    const { res: initRes, endpoint } = await postPaynowWithFallback(body);
    const rawText = await initRes.text();
    const parsed = parseQueryString(rawText || '');
    const status = pickCi(parsed, 'status').toLowerCase();
    const redirectUrl = pickCi(parsed, 'browserurl');
    const pollUrl = pickCi(parsed, 'pollurl');

    if (!initRes.ok || status !== 'ok' || !redirectUrl) {
      return json({
        ok: false,
        error: 'Paynow initiation failed.',
        details: {
          endpoint,
          httpStatus: initRes.status,
          status: pickCi(parsed, 'status') || null,
          error: pickCi(parsed, 'error') || null,
          raw: rawText?.slice(0, 2000) || null,
        },
      });
    }

    const updatePayload = {
      payment_gateway: 'paynow',
      payment_status: 'pending',
      paynow_reference: orderNumber,
      paynow_poll_url: pollUrl || null,
      paynow_redirect_url: redirectUrl || null,
      payment_started_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from('shop_customer_orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updErr) {
      return json(
        {
          error: 'Paynow started but order update failed.',
          details: updErr.message,
          redirectUrl: redirectUrl,
          pollUrl: pollUrl || null,
        },
        500,
      );
    }

    return json({
      ok: true,
      redirectUrl: redirectUrl,
      pollUrl: pollUrl || null,
      reference: orderNumber,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
    return json(
      {
        ok: false,
        error: 'Paynow connection failed from Edge.',
        details: {
          message: msg,
          cause: cause || null,
          hint:
            'If you see "Connection reset", Paynow may block traffic from Supabase’s region. Set Supabase secret PAYNOW_INITIATE_URL to your own HTTPS URL that forwards POST body to https://www.paynow.co.zw/interface/initiatetransaction and returns Paynow’s response.',
        },
      },
      500,
    );
  }
});
