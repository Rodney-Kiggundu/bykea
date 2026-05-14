/**
 * Shop customer order `status` field (shop_customer_orders) — shared labels for
 * customer app, admin, and shop owner portal.
 */

export function normalizeShopOrderStatus(raw) {
  return String(raw || 'placed')
    .toLowerCase()
    .trim();
}

/** Label shown to customers and admins. */
export function shopOrderStatusLabel(raw) {
  const s = normalizeShopOrderStatus(raw);
  if (s === 'placed') return 'Order placed';
  if (s === 'processing') return 'Processing';
  if (s === 'ready for delivery') return 'Ready for delivery';
  if (s === 'picked up') return 'Picked up';
  if (s === 'in transit') return 'In transit';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  if (!s) return 'Order placed';
  return String(raw).replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Key for customer list/badge + filter (matches mockOrders / OrderHistoryPage).
 * - active: order placed, processing, or picked up
 * - transit: in transit
 * - delivered, cancelled: as named
 */
export function shopOrderCustomerBadgeKey(raw) {
  const s = normalizeShopOrderStatus(raw);
  if (s === 'cancelled') return 'cancelled';
  if (s === 'delivered') return 'delivered';
  if (s === 'in transit') return 'transit';
  return 'active';
}
