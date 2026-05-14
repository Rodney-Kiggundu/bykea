/**
 * User-facing vehicle category (taxi uses lowercase; driver rows use title case).
 * @param {string|null|undefined} raw
 * @returns {string} Empty string if raw is empty.
 */
export function formatVehicleTypeForDisplay(raw) {
  if (raw == null || raw === '') return '';
  const t = String(raw).trim();
  if (t.toLowerCase() === 'bicycle') return 'Bike';
  return t;
}
