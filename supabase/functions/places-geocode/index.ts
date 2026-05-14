/**
 * Supabase Edge: **`places-geocode`** — proxies Google Geocoding JSON (no browser CORS).
 * Same secret as `places-autocomplete`. Deploy: `supabase functions deploy places-geocode`
 * Secret: `supabase secrets set GOOGLE_MAPS_API_KEY=...`
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** `places-geocode` — wraps a body into a JSON `Response` with shared CORS headers. */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * `places-geocode` — HTTP handler (Edge entrypoint).
 * Called from the React app: `src/lib/reverseGeocode.js` → `forwardGeocodeAddress` (address → coords)
 * and `reverseGeocodeLatLng` (lat,lng → formatted address) via `supabase.functions.invoke('places-geocode', { body })`.
 * Body: `{ address?, latlng?, language?, country? }` — either `address` or `latlng` ("lat,lng") required.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim();
  if (!key) {
    return json(
      {
        error: 'Missing GOOGLE_MAPS_API_KEY',
        hint: 'Set with: supabase secrets set GOOGLE_MAPS_API_KEY=your_key',
      },
      500,
    );
  }

  let body: {
    address?: string;
    latlng?: string;
    language?: string;
    country?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const address = String(body.address || '').trim();
  const latlng = String(body.latlng || '').trim();

  const params = new URLSearchParams({ key });
  if (address) {
    params.set('address', address);
  } else if (latlng) {
    params.set('latlng', latlng);
  } else {
    return json({ error: 'Provide address or latlng' }, 400);
  }

  const lang = String(body.language || 'en').trim();
  if (lang) params.set('language', lang);

  const cc = String(body.country || '')
    .trim()
    .toLowerCase();
  if (cc.length === 2 && /^[a-z]{2}$/.test(cc)) {
    params.set('components', `country:${cc}`);
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  try {
    const res = await fetch(url);
    const raw = await res.json();
    return json(raw, res.ok ? 200 : 502);
  } catch (e) {
    return json(
      {
        error: 'Upstream fetch failed',
        message: e instanceof Error ? e.message : String(e),
      },
      502,
    );
  }
});
