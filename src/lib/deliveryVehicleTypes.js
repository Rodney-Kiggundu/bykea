/**
 * Parcel delivery: driver signup values and customer “minimum vehicle” choice.
 * Keep in sync with `supabase/driver_vehicle_types_motorbike_tuktuk_car.sql` (CHECK + columns).
 */

/** @type {readonly string[]} DB / UI values for driver registration and customer dropdown */
export const PARCEL_DRIVER_VEHICLE_TYPES = ['Motorbike', 'Tuk-Tuk', 'Car'];

/** Customer Step 2: minimum vehicle (always one of these; matches driver signup list). */
export const CUSTOMER_PARCEL_VEHICLE_OPTIONS = [
  { value: 'Motorbike', label: 'Motorbike' },
  { value: 'Tuk-Tuk', label: 'Tuk-Tuk' },
  { value: 'Car', label: 'Car' },
];

/**
 * @param {string | null | undefined} v
 * @returns {'bicycle' | 'motorbike' | 'tuktuk' | 'car' | 'van' | 'minibus' | ''}
 */
export function normalizeParcelVehicleKey(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === 'bike' || s === 'bicycle') return 'bicycle';
  if (s === 'motorbike' || s === 'motorcycle') return 'motorbike';
  if (s === 'tuk-tuk' || s === 'tuktuk' || s === 'tuk') return 'tuktuk';
  if (s === 'car') return 'car';
  if (s === 'van') return 'van';
  if (s === 'mini bus' || s === 'minibus') return 'minibus';
  return '';
}

/** Smallest = 1. Driver may take job if rank(driver) >= rank(customer minimum). */
export const PARCEL_VEHICLE_TIER_RANK = {
  bicycle: 1,
  motorbike: 2,
  tuktuk: 3,
  car: 4,
  van: 5,
  minibus: 5,
};
