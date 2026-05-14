import { supabase } from './supabaseClient';

/** @typedef {'customer' | 'driver' | 'shop_owner'} PasswordResetRealm */

/**
 * @param {{ email: string, realm?: PasswordResetRealm }} params
 * @returns {Promise<{ ok: boolean, error?: string, retryAfterSec?: number, sent?: boolean }>}
 */
export async function passwordResetSend({ email, realm = 'customer' }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('password-reset', {
    body: { action: 'send', realm, email: String(email).trim().toLowerCase() },
  });
  if (error) return { ok: false, error: error.message || 'Could not send reset email.' };
  if (data?.error) return { ok: false, error: String(data.error), retryAfterSec: data.retryAfterSec };
  if (!data?.ok) return { ok: false, error: 'Could not send reset email.' };
  return { ok: true, sent: data.sent !== false };
}

/**
 * @param {{ email: string, code: string, newPassword: string, realm?: PasswordResetRealm }} params
 */
export async function passwordResetConfirm({ email, code, newPassword, realm = 'customer' }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('password-reset', {
    body: {
      action: 'confirm',
      realm,
      email: String(email).trim().toLowerCase(),
      code: String(code).trim(),
      newPassword: String(newPassword),
    },
  });
  if (error) return { ok: false, error: error.message || 'Could not reset password.' };
  if (data?.error) return { ok: false, error: String(data.error) };
  if (!data?.ok) return { ok: false, error: 'Password reset failed.' };
  return { ok: true };
}
