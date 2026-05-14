import { isSupabaseConfigured, supabase } from './supabaseClient';

const RETURN_CTX_KEY = 'bykea_stripe_hosted_return_v1';

/** Publishable key only (safe in browser). Secret key lives in Supabase Edge `stripe-payment`. */
export function getStripePublishableKey() {
  return String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '').trim();
}

export function isStripePaymentsConfigured() {
  return Boolean(isSupabaseConfigured && supabase && getStripePublishableKey());
}

/** Call immediately before redirecting to Stripe Checkout (hosted payment page). */
export function setStripeHostedReturnContext(payload) {
  try {
    sessionStorage.setItem(RETURN_CTX_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function takeStripeHostedReturnContext() {
  try {
    const raw = sessionStorage.getItem(RETURN_CTX_KEY);
    sessionStorage.removeItem(RETURN_CTX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Redirect browser to Stripe-hosted Checkout (user completes payment on stripe.com).
 * @param {{ orderKind: 'shop' | 'delivery' | 'taxi' | 'tuk' | 'driver_deposit', orderId: string, cancelPath?: string }} params
 */
export async function stripeHostedCheckoutRedirect({ orderKind, orderId, cancelPath = '/' }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const returnOrigin =
    typeof window !== 'undefined' && window.location?.origin ? String(window.location.origin).replace(/\/$/, '') : '';
  if (!returnOrigin) return { ok: false, error: 'Missing window origin for payment return URLs.' };

  const { data, error } = await supabase.functions.invoke('stripe-payment', {
    body: {
      action: 'create_checkout_session',
      orderKind,
      orderId,
      returnOrigin,
      cancelPath: cancelPath.startsWith('/') ? cancelPath : `/${cancelPath}`,
    },
  });
  if (error) {
    return { ok: false, error: error.message || 'Could not start card checkout.' };
  }
  if (data?.error) {
    return { ok: false, error: String(data.error), details: data.details || null };
  }
  if (!data?.ok || !data?.url) {
    return { ok: false, error: data?.error || 'Checkout did not return a payment link.' };
  }
  window.location.assign(String(data.url));
  return { ok: true };
}

/**
 * @param {{ sessionId: string }} params
 */
export async function stripeEdgeFinalizeCheckoutSession({ sessionId }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('stripe-payment', {
    body: { action: 'finalize_checkout_session', sessionId },
  });
  if (error) {
    return { ok: false, error: error.message || 'Could not verify payment.' };
  }
  if (data?.error) {
    return { ok: false, error: String(data.error) };
  }
  if (!data?.ok) {
    return { ok: false, error: 'Payment verification failed.' };
  }
  return {
    ok: true,
    alreadyPaid: Boolean(data.alreadyPaid),
    orderKind: data.orderKind,
    orderId: data.orderId,
  };
}

/**
 * @param {{ orderKind: 'shop' | 'delivery' | 'taxi' | 'tuk' | 'driver_deposit', orderId: string }} params
 */
export async function stripeEdgeCreateIntent({ orderKind, orderId }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('stripe-payment', {
    body: { action: 'create_payment_intent', orderKind, orderId },
  });
  if (error) {
    return { ok: false, error: error.message || 'Could not reach the payment service.' };
  }
  if (data?.error) {
    return { ok: false, error: String(data.error), details: data.details || null };
  }
  if (!data?.ok || !data?.clientSecret) {
    return { ok: false, error: data?.error || 'Could not create payment.' };
  }
  return {
    ok: true,
    clientSecret: data.clientSecret,
    paymentIntentId: data.paymentIntentId,
    amountGbp: data.amountGbp,
  };
}

/**
 * @param {{ orderKind: 'shop' | 'delivery' | 'taxi' | 'tuk' | 'driver_deposit', orderId: string, paymentIntentId: string }} params
 */
export async function stripeEdgeFinalizeIntent({ orderKind, orderId, paymentIntentId }) {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke('stripe-payment', {
    body: { action: 'finalize_payment_intent', orderKind, orderId, paymentIntentId },
  });
  if (error) {
    return { ok: false, error: error.message || 'Could not verify payment.' };
  }
  if (data?.error) {
    return { ok: false, error: String(data.error) };
  }
  if (!data?.ok) {
    return { ok: false, error: 'Payment verification failed.' };
  }
  return { ok: true, alreadyPaid: Boolean(data.alreadyPaid) };
}
