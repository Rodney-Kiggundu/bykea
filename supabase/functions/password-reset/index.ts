/**
 * Supabase Edge: **password-reset** — send 6-digit OTP and set new password (Resend).
 * Realms: `customer` (app_users), `driver` (driver_registrations), `shop_owner` (shop_owners).
 *
 * Deploy: supabase functions deploy password-reset --no-verify-jwt
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *          EMAIL_VERIFY_HMAC_SECRET (or PASSWORD_RESET_HMAC_SECRET — see code)
 * Optional: RESEND_FROM_EMAIL
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Realm = 'customer' | 'driver' | 'shop_owner';

function parseRealm(raw: unknown): Realm {
  const r = String(raw ?? 'customer').trim().toLowerCase();
  if (r === 'driver' || r === 'shop_owner' || r === 'customer') return r as Realm;
  return 'customer';
}

function hmacPayload(realm: Realm, email: string, code: string): string {
  return `pwdreset:${realm}:${email}:${code}`;
}

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function random6Digit(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = 100000 + (Number(buf[0]) % 900000);
  return String(n).padStart(6, '0');
}

function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function normalizeCode(raw: unknown): string {
  return String(raw ?? '').replace(/\s/g, '').replace(/\D/g, '').slice(0, 6);
}

const RESEND_MIN_INTERVAL_MS = 55_000;
const CODE_TTL_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LEN = 6;

type SendRow = { id: string; password_reset_sent_at: string | null };

function tableForRealm(realm: Realm): 'app_users' | 'driver_registrations' | 'shop_owners' {
  if (realm === 'driver') return 'driver_registrations';
  if (realm === 'shop_owner') return 'shop_owners';
  return 'app_users';
}

async function findSendRow(
  supabase: ReturnType<typeof createClient>,
  realm: Realm,
  email: string,
): Promise<SendRow | null> {
  if (realm === 'customer') {
    const { data: row, error } = await supabase
      .from('app_users')
      .select('id, password_reset_sent_at')
      .eq('email', email)
      .maybeSingle();
    if (error || !row) return null;
    return row as SendRow;
  }
  if (realm === 'shop_owner') {
    const { data: row, error } = await supabase
      .from('shop_owners')
      .select('id, password_reset_sent_at')
      .eq('email', email)
      .maybeSingle();
    if (error || !row) return null;
    return row as SendRow;
  }
  const { data: rows, error } = await supabase
    .from('driver_registrations')
    .select('id, status, password_reset_sent_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error || !rows?.length) return null;
  const approved = rows.find((r: { status?: string }) => String(r.status || '').toLowerCase() === 'approved');
  const row = approved || rows[0];
  return { id: row.id as string, password_reset_sent_at: row.password_reset_sent_at as string | null };
}

async function sendResendEmail(
  resendKey: string,
  from: string,
  to: string,
  realm: Realm,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const label =
    realm === 'driver' ? 'driver account' : realm === 'shop_owner' ? 'shop owner account' : 'customer account';
  const html = `
<p>Hi,</p>
<p>Your InGo password reset code (${label}) is:</p>
<p style="font-size:1.5rem;font-weight:700;letter-spacing:0.2em">${code}</p>
<p>This code expires in 15 minutes. If you did not request a reset, you can ignore this email.</p>
<p>— InGo</p>
`.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your InGo password reset code',
      html,
    }),
  });

  const resBody = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
  if (!res.ok) {
    const msg = [resBody?.name, resBody?.message].filter(Boolean).join(': ') || `Resend HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const action = String(body.action ?? '').trim();
  const realm = parseRealm(body.realm);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Server is missing Supabase configuration.' }, 500);
  }

  const hmacSecret =
    Deno.env.get('PASSWORD_RESET_HMAC_SECRET')?.trim() || Deno.env.get('EMAIL_VERIFY_HMAC_SECRET')?.trim();
  if (!hmacSecret) {
    return json(
      { ok: false, error: 'PASSWORD_RESET_HMAC_SECRET or EMAIL_VERIFY_HMAC_SECRET must be set on the server.' },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'send') {
    const email = normalizeEmail(body.email);
    if (!email) {
      return json({ ok: false, error: 'Email is required.' }, 400);
    }

    const row = await findSendRow(supabase, realm, email);
    if (!row) {
      return json({ ok: true, sent: false });
    }

    const sentAt = row.password_reset_sent_at ? new Date(row.password_reset_sent_at).getTime() : 0;
    if (sentAt && Date.now() - sentAt < RESEND_MIN_INTERVAL_MS) {
      return json({
        ok: false,
        error: 'Please wait about a minute before requesting another code.',
        retryAfterSec: Math.ceil((RESEND_MIN_INTERVAL_MS - (Date.now() - sentAt)) / 1000),
      }, 429);
    }

    const code = random6Digit();
    const codeHash = await hmacSha256Hex(hmacSecret, hmacPayload(realm, email, code));
    const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
    const nowIso = new Date().toISOString();
    const tbl = tableForRealm(realm);

    const { error: uErr } = await supabase
      .from(tbl)
      .update({
        password_reset_code_hash: codeHash,
        password_reset_expires_at: expires,
        password_reset_sent_at: nowIso,
      })
      .eq('id', row.id);

    if (uErr) {
      return json({ ok: false, error: uErr.message || 'Could not save reset code.' }, 500);
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
    if (!resendKey) {
      return json({ ok: false, error: 'RESEND_API_KEY is not set on the server.' }, 500);
    }

    const fromRaw = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || 'admin@ingo.co.zw';
    const from = fromRaw.includes('<') ? fromRaw : `InGo <${fromRaw}>`;

    const mailed = await sendResendEmail(resendKey, from, email, realm, code);
    if (!mailed.ok) return json({ ok: false, error: mailed.error }, 502);

    return json({ ok: true, sent: true });
  }

  if (action === 'confirm') {
    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);
    const newPassword = String(body.newPassword ?? '');
    if (!email || code.length !== 6) {
      return json({ ok: false, error: 'Email and a 6-digit code are required.' }, 400);
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      return json({ ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` }, 400);
    }

    const tbl = tableForRealm(realm);

    let row: {
      id: string;
      password_reset_code_hash: string | null;
      password_reset_expires_at: string | null;
    } | null = null;

    if (realm === 'driver') {
      const { data: rows, error: qErr } = await supabase
        .from('driver_registrations')
        .select('id, password_reset_code_hash, password_reset_expires_at')
        .eq('email', email)
        .not('password_reset_code_hash', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (qErr) return json({ ok: false, error: qErr.message || 'Lookup failed.' }, 400);
      row = rows && rows[0] ? (rows[0] as typeof row) : null;
    } else {
      const { data: r, error: qErr } = await supabase
        .from(tbl)
        .select('id, password_reset_code_hash, password_reset_expires_at')
        .eq('email', email)
        .maybeSingle();
      if (qErr) return json({ ok: false, error: qErr.message || 'Lookup failed.' }, 400);
      row = r as typeof row | null;
    }

    if (!row?.password_reset_code_hash) {
      return json({ ok: false, error: 'Invalid or expired code. Request a new code from the forgot password page.' }, 400);
    }

    const exp = row.password_reset_expires_at ? new Date(row.password_reset_expires_at).getTime() : 0;
    if (!exp || Date.now() > exp) {
      return json({ ok: false, error: 'This code has expired. Request a new one.' }, 400);
    }

    const stored = String(row.password_reset_code_hash);
    const attemptHash = await hmacSha256Hex(hmacSecret, hmacPayload(realm, email, code));
    if (!timingSafeEqualHex(stored, attemptHash)) {
      return json({ ok: false, error: 'Invalid verification code.' }, 400);
    }

    const { error: finErr } = await supabase
      .from(tbl)
      .update({
        password: newPassword,
        password_reset_code_hash: null,
        password_reset_expires_at: null,
        password_reset_sent_at: null,
      })
      .eq('id', row.id);

    if (finErr) {
      return json({ ok: false, error: finErr.message || 'Could not update password.' }, 500);
    }

    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown action. Use send or confirm.' }, 400);
});
