/** Paynow uses a full `window.location` redirect, so React Router `location.state` is lost on return. */

export const SHOP_ORDER_CONFIRM_SESSION_KEY = 'bykea_shop_order_confirm_v1';

/**
 * @param {unknown} locationState — `useLocation().state`
 * @returns {Record<string, unknown>}
 */
export function readShopOrderConfirmationState(locationState) {
  if (locationState != null && typeof locationState === 'object' && !Array.isArray(locationState)) {
    return /** @type {Record<string, unknown>} */ (locationState);
  }
  try {
    const raw = sessionStorage.getItem(SHOP_ORDER_CONFIRM_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return /** @type {Record<string, unknown>} */ (parsed);
    }
  } catch {
    /* ignore */
  }
  return {};
}

/** Call immediately before `window.location.href = paynowRedirectUrl`. */
export function writeShopOrderConfirmationState(payload) {
  try {
    sessionStorage.setItem(SHOP_ORDER_CONFIRM_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
