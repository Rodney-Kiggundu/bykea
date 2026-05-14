/**
 * Maps customer package vehicle choice → `service_pricing.service_type` for delivery estimates
 * (`delivery_motorbike` | `delivery_tuk_tuk` | `delivery_car`).
 * @param {Record<string, unknown>} [navState]
 * @returns {string}
 */
export function deliveryPricingServiceTypeFromPackage(navState) {
  const v = String(navState?.package?.requestedVehicleType ?? '').trim();
  if (v === 'Tuk-Tuk') return 'delivery_tuk_tuk';
  if (v === 'Car') return 'delivery_car';
  if (v === 'Motorbike') return 'delivery_motorbike';
  if (v === 'Bicycle' || v === 'Bike') return 'delivery_motorbike';
  if (v === 'Taxi') return 'delivery_car';
  return 'delivery_motorbike';
}
