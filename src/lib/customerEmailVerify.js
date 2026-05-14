import { supabase } from './supabaseClient';

/** @typedef {'customer' | 'driver' | 'shop_owner'} EmailVerifyRealm */

/**
 * Ask Edge to email a 6-digit code (matching password on the realm table; unverified only).
 * @param {{ email: string, password: string, realm?: EmailVerifyRealm }} params
 */
export async function customerEmailVerifySend({ email, password, realm = 'customer' }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('customer-email-verify', {
    body: { action: 'send', realm, email: String(email).trim().toLowerCase(), password },
  });
  if (error) return { ok: false, error: error.message || 'Could not send verification email.' };
  if (data?.error) return { ok: false, error: String(data.error), retryAfterSec: data.retryAfterSec };
  if (!data?.ok) return { ok: false, error: 'Could not send verification email.' };
  return { ok: true };
}

/**
 * @param {{ email: string, code: string, realm?: EmailVerifyRealm }} params
 */
export async function customerEmailVerifySubmit({ email, code, realm = 'customer' }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('customer-email-verify', {
    body: { action: 'verify', realm, email: String(email).trim().toLowerCase(), code: String(code).trim() },
  });
  if (error) return { ok: false, error: error.message || 'Could not verify email.' };
  if (data?.error) return { ok: false, error: String(data.error) };
  if (!data?.ok) return { ok: false, error: 'Verification failed.' };
  return { ok: true, alreadyVerified: Boolean(data.alreadyVerified) };
}
