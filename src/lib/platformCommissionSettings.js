/** Singleton PK for `platform_commission_settings`. */
export const PLATFORM_COMMISSION_ROW_ID = 1;

/**
 * @param {import('./supabaseClient').SupabaseClient | null} supabase
 * @returns {Promise<{ data: { driver_commission_percent: number, shop_commission_percent: number, currency: string, updated_at?: string } | null, error: Error | null }>}
 */
export async function fetchPlatformCommissionSettings(supabase) {
  if (!supabase) return { data: null, error: new Error('Supabase client missing') };
  const { data, error } = await supabase
    .from('platform_commission_settings')
    .select('driver_commission_percent, shop_commission_percent, currency, updated_at')
    .eq('id', PLATFORM_COMMISSION_ROW_ID)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data, error: null };
}
