/** Earth radius in km */
const R_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS84 points (km).
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const a1 = Number(lat1);
  const o1 = Number(lng1);
  const a2 = Number(lat2);
  const o2 = Number(lng2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;
  const dLat = toRad(a2 - a1);
  const dLng = toRad(o2 - o1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R_KM * c;
}

/**
 * Approximate road distance from straight-line (no Directions API).
 * @param {number} straightKm
 * @param {number} [factor] typical urban detour ~1.2–1.35
 */
export function estimateRoadKm(straightKm, factor = 1.28) {
  if (!Number.isFinite(straightKm) || straightKm < 0) return null;
  return straightKm * factor;
}

/**
 * Drive time from distance (no live traffic).
 * @param {number} roadKm
 * @param {number} [avgKmh] average speed in urban mix
 */
export function estimateDriveMinutes(roadKm, avgKmh = 28) {
  if (!Number.isFinite(roadKm) || roadKm <= 0 || !Number.isFinite(avgKmh) || avgKmh <= 0) return null;
  return (roadKm / avgKmh) * 60;
}

/** Minimum billable km so very short trips still get a sensible fare. */
export function effectiveBillableKm(roadKm, minKm = 0.5) {
  if (!Number.isFinite(roadKm) || roadKm <= 0) return minKm;
  return Math.max(roadKm, minKm);
}
