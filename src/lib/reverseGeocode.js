import { getGoogleMapsApiKey } from './googleMapsConfig';
import { isSupabaseConfigured, supabase } from './supabaseClient';

/** Logs once per function name per tab when Edge returns OK (verify wiring without spamming autocomplete). */
const mapsEdgeVerifiedLogged = new Set();

/**
 * Internal — calls Supabase Edge map functions by name.
 * Used by: `fetchAddressAutocompleteSuggestions` → Edge **`places-autocomplete`**;
 * `forwardGeocodeAddress` / `reverseGeocodeLatLng` → Edge **`places-geocode`**.
 *
 * @param {string} functionName
 * @param {Record<string, unknown>} body
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function invokeMapsEdge(functionName, body) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      console.warn(`[Bykea maps Edge] ${functionName} failed`, error.message || String(error));
      return null;
    }
    if (data && typeof data === 'object') {
      if (!mapsEdgeVerifiedLogged.has(functionName)) {
        mapsEdgeVerifiedLogged.add(functionName);
        // eslint-disable-next-line no-console
        console.info(
          `[Bykea maps Edge] ${functionName} — response from Supabase Edge (first OK in this tab; further calls are silent)`,
        );
      }
      return /** @type {Record<string, unknown>} */ (data);
    }
    return null;
  } catch (e) {
    console.warn(`[Bykea maps Edge] ${functionName} invoke threw`, e);
    return null;
  }
}

/**
 * Internal — parses first `geometry.location` from a Google Geocode JSON payload (from Edge **`places-geocode`** or browser fallback).
 * Used by: **`forwardGeocodeAddress`** only.
 *
 * @param {Record<string, unknown> | null} data
 */
function parseGeocodeFirstLatLng(data) {
  if (!data || typeof data !== 'object') return null;
  const st = String(data.status || '');
  if (st !== 'OK' || !Array.isArray(data.results) || !data.results.length) return null;
  const loc = data.results[0]?.geometry?.location;
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Internal — parses first `formatted_address` from a Google Geocode JSON payload (from Edge **`places-geocode`** or browser fallback).
 * Used by: **`reverseGeocodeLatLng`** only.
 *
 * @param {Record<string, unknown> | null} data
 */
function parseGeocodeFirstFormattedAddress(data) {
  if (!data || typeof data !== 'object') return '';
  const st = String(data.status || '');
  if (st !== 'OK' || !Array.isArray(data.results) || !data.results.length) return '';
  const first = data.results[0];
  const line = first?.formatted_address;
  return line ? String(line).trim() : '';
}

const NOMINATIM_DELAY_MS = 600;
let nominatimLastAt = 0;

/**
 * Internal — rate-limits OpenStreetMap Nominatim (public etiquette).
 * Used by: **`fetchAddressAutocompleteSuggestions`** only (before OSM search).
 */
async function nominatimThrottle() {
  const now = Date.now();
  const wait = nominatimLastAt + NOMINATIM_DELAY_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nominatimLastAt = Date.now();
}

/**
 * @typedef {{ id: string, label: string }} AddressSuggestion
 */

/**
 * Internal — one Nominatim search hit → single-line label for dropdowns.
 * Used by: **`fetchAddressAutocompleteSuggestions`** (OSM path only).
 */
function formatNominatimLabel(hit) {
  const a = hit.address || {};
  const numName = [a.house_number, a.house_name, a.building].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const road = a.road || a.pedestrian || a.path || a.residential || '';
  let line1 = [numName, road].filter(Boolean).join(' ').trim();
  if (!line1 && a.shop) {
    line1 = [a.shop, road].filter(Boolean).join(', ').trim();
  }
  if (!line1 && a.amenity && road) {
    line1 = `${a.amenity}, ${road}`;
  }
  const parts = [
    line1,
    a.suburb || a.neighbourhood || a.quarter || a.city_district,
    a.city || a.town || a.village || a.hamlet,
    a.postcode,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  const dn = String(hit.display_name || '').trim();
  if (!dn) return '';
  return dn.split(',').slice(0, 5).join(',').trim();
}

/**
 * Internal — sorts OSM hits when the user typed a house number.
 * Used by: **`fetchAddressAutocompleteSuggestions`** (OSM path only).
 */
function rankNominatimHits(hits, query) {
  const q = String(query || '').trim();
  const wantsNumber = /\d/.test(q);
  if (!wantsNumber || !Array.isArray(hits)) return hits;
  return [...hits].sort((a, b) => {
    const ah = a.address?.house_number ? 1 : 0;
    const bh = b.address?.house_number ? 1 : 0;
    if (bh !== ah) return bh - ah;
    const ab = a.address?.building ? 1 : 0;
    const bb = b.address?.building ? 1 : 0;
    return bb - ab;
  });
}

/**
 * Internal — display string for one Google Places Autocomplete prediction (from Edge **`places-autocomplete`**).
 * Used by: **`fetchAddressAutocompleteSuggestions`** only.
 */
function googleAutocompleteLabel(p) {
  const desc = String(p.description || '').trim();
  const sf = p.structured_formatting;
  const main = sf && typeof sf.main_text === 'string' ? sf.main_text.trim() : '';
  const sec = sf && typeof sf.secondary_text === 'string' ? sf.secondary_text.trim() : '';
  const composed = [main, sec].filter(Boolean).join(', ');
  if (desc && composed && desc.length > composed.length + 8) return desc;
  if (desc) return desc;
  return composed;
}

/**
 * Internal — sorts Google predictions when the user typed digits (prefer street_address / premise).
 * Used by: **`fetchAddressAutocompleteSuggestions`** only.
 */
function rankGooglePredictions(preds, query) {
  const q = String(query || '').trim();
  const wantsNumber = /\d/.test(q);
  if (!wantsNumber || !Array.isArray(preds)) return preds;
  const score = (p) => {
    const t = Array.isArray(p.types) ? p.types : [];
    if (t.includes('street_address') || t.includes('premise') || t.includes('subpremise')) return 3;
    if (t.includes('route')) return 0;
    if (t.includes('geocode')) return 1;
    return 2;
  };
  return [...preds].sort((a, b) => score(b) - score(a));
}

/**
 * **Address typeahead** — pickup / destination search boxes.
 * Edge: **`places-autocomplete`**. UI: **`AddressSuggestInput`** → used on **`/request-delivery`**, **`/book-ride`**, etc.
 * With no Edge + Maps key set: returns `[]`. With no key: falls back to Nominatim (dev only).
 *
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {Promise<AddressSuggestion[]>}
 */
export async function fetchAddressAutocompleteSuggestions(query, options = {}) {
  const limit = Math.min(8, Math.max(1, Number(options.limit) || 5));
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const lang = String(process.env.REACT_APP_GOOGLE_PLACES_LANGUAGE || 'en').trim() || 'en';
  const cc = String(process.env.REACT_APP_ADDRESS_AUTOCOMPLETE_COUNTRY || '').trim().toLowerCase();
  const country = cc.length === 2 && /^[a-z]{2}$/.test(cc) ? cc : undefined;

  const digitQuery = /\d/.test(q);
  const attempts = digitQuery ? [false, true] : [false];

  for (const typesAddress of attempts) {
    const payload = { input: q, language: lang, country, typesAddress };

    const data = await invokeMapsEdge('places-autocomplete', payload);

    if (data == null || typeof data !== 'object') continue;

    if (data.error && !Array.isArray(data.predictions)) {
      console.warn('[addressSuggest]', data.error, data.hint || '');
      continue;
    }

    const st = String(data.status || '');
    if (st !== 'OK' && st !== 'ZERO_RESULTS') {
      if (st && st !== 'INVALID_REQUEST') {
        console.warn('[addressSuggest] Places', st, data.error_message || '');
      }
      continue;
    }

    let preds = Array.isArray(data.predictions) ? data.predictions : [];
    preds = rankGooglePredictions(preds, q);
    const mapped = preds.slice(0, limit).map((p) => ({
      id: String(p.place_id || p.description),
      label: googleAutocompleteLabel(p),
    }));
    if (mapped.length) return mapped;
  }

  if (getGoogleMapsApiKey()) {
    return [];
  }

  try {
    await nominatimThrottle();
    const fetchLimit = /\d/.test(q) ? Math.min(12, limit + 5) : limit;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${fetchLimit}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const ranked = rankNominatimHits(data, q);
    return ranked
      .slice(0, limit)
      .map((hit, i) => {
        const label = formatNominatimLabel(hit);
        if (!label) return null;
        const id = hit.place_id != null ? `osm-${hit.place_id}` : `osm-${i}-${hit.lat}-${hit.lon}`;
        return { id: String(id), label };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * **GPS → readable address** (e.g. device location label).
 * Edge: **`places-geocode`** (`latlng`). Callers: **`devicePickupLocation.js`**, customer/driver flows that show “you are here” text.
 * Fallback: browser Geocoding if key set, else Nominatim.
 */
export async function reverseGeocodeLatLng(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '';
  }

  const lang = String(process.env.REACT_APP_GOOGLE_PLACES_LANGUAGE || 'en').trim() || 'en';
  const edgeLine = parseGeocodeFirstFormattedAddress(
    await invokeMapsEdge('places-geocode', { latlng: `${lat},${lng}`, language: lang }),
  );
  if (edgeLine) return edgeLine;

  const key = getGoogleMapsApiKey();
  if (key) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      if (!res.ok) return '';
      const data = await res.json();
      const first = data?.results?.[0];
      if (first?.formatted_address) return String(first.formatted_address).trim();
    } catch {
      // fall through to Nominatim
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const line = data?.display_name;
    if (line) return String(line).trim();
  } catch {
    // ignore
  }

  return '';
}

/**
 * **Typed address → map coordinates** (route pins, distance, navigation).
 * Edge: **`places-geocode`** (`address`). Callers: **`TaxiBookingPage`**, **`RequestDeliveryPage`**, **`LiveTrackingPage`**, **`DriverActiveDeliveryPage`**, **`DriverNavigationPage`**, etc.
 * Fallback: browser Geocoding if key set, else Nominatim.
 *
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function forwardGeocodeAddress(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  const cc = String(process.env.REACT_APP_ADDRESS_AUTOCOMPLETE_COUNTRY || '')
    .trim()
    .toLowerCase();
  const country = cc.length === 2 && /^[a-z]{2}$/.test(cc) ? cc : undefined;
  const lang = String(process.env.REACT_APP_GOOGLE_PLACES_LANGUAGE || 'en').trim() || 'en';

  const edgePt = parseGeocodeFirstLatLng(
    await invokeMapsEdge('places-geocode', {
      address: q,
      language: lang,
      country,
    }),
  );
  if (edgePt) return edgePt;

  const key = getGoogleMapsApiKey();
  if (key) {
    try {
      const params = new URLSearchParams({
        address: q,
        key,
      });
      if (country) {
        params.set('components', `country:${country}`);
      }
      if (lang) params.set('language', lang);

      const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const st = String(data.status || '');
      if (st !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
        if (st && st !== 'ZERO_RESULTS') {
          console.warn('[forwardGeocode] Geocoding API', st, data.error_message || '');
        }
        return null;
      }
      const loc = data.results[0]?.geometry?.location;
      const lat = Number(loc?.lat);
      const lng = Number(loc?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (e) {
      console.warn('[forwardGeocode] Google geocode failed', e);
      return null;
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
