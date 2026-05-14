/** Singleton row PK for `shop_delivery_settings`. */
export const SHOP_DELIVERY_SETTINGS_ID = 1;

/**
 * @param {import('./supabaseClient').SupabaseClient | null} supabase
 * @returns {Promise<{ data: { delivery_fee: number, currency: string, updated_at?: string } | null, error: Error | null }>}
 */
export async function fetchShopDeliverySettings(supabase) {
  if (!supabase) return { data: null, error: new Error('Supabase client missing') };
  const { data, error } = await supabase
    .from('shop_delivery_settings')
    .select('delivery_fee, currency, updated_at')
    .eq('id', SHOP_DELIVERY_SETTINGS_ID)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data, error: null };
}

/** Current delivery fee number for checkout (falls back to 0 if missing). */
export function deliveryFeeFromSettings(data) {
  const n = Number(data?.delivery_fee);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Grand total for a shop_customer_orders row (subtotal + recorded delivery). */
export function shopOrderGrandTotal(row) {
  return (Number(row?.subtotal) || 0) + (Number(row?.delivery_fee) || 0);
}
