import { useCallback, useEffect, useState } from 'react';
import { formatGBP } from '../lib/currency';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const ACTIVE_STATUSES = ['ready for delivery', 'picked up', 'in transit'];

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

function phaseLabel(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'ready for delivery') return 'On the way to your shop';
  if (s === 'picked up') return 'Picked up';
  if (s === 'in transit') return 'Out for delivery';
  if (s === 'delivered') return 'Delivered';
  return String(status || '—');
}

function driverPhone(d) {
  if (!d?.phone) return '—';
  const cc = d.phone_country_code ? String(d.phone_country_code).trim() : '';
  return cc ? `${cc} ${d.phone}` : String(d.phone);
}

export default function ShopOwnerDeliveryDriverPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const session = getShopOwnerSession();
    if (!session?.id) {
      setRows([]);
      setErr('Sign in as a shop owner.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setRows([]);
      setErr('Supabase is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: lineRows, error: lErr } = await supabase
      .from('shop_customer_order_lines')
      .select('order_id, product_name, quantity, line_total')
      .eq('shop_owner_id', session.id);

    if (lErr) {
      setRows([]);
      setErr(lErr.message);
      setLoading(false);
      return;
    }

    const lines = Array.isArray(lineRows) ? lineRows : [];
    const orderIds = [...new Set(lines.map((l) => l.order_id).filter(Boolean))];
    if (!orderIds.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const linesByOrder = {};
    for (const l of lines) {
      if (!linesByOrder[l.order_id]) linesByOrder[l.order_id] = [];
      linesByOrder[l.order_id].push(l);
    }

    const { data: orders, error: oErr } = await supabase
      .from('shop_customer_orders')
      .select('*')
      .in('id', orderIds)
      .not('assigned_driver_id', 'is', null)
      .in('status', ACTIVE_STATUSES);

    if (oErr) {
      setRows([]);
      setErr(
        oErr.message?.includes('assigned_driver_id')
          ? `${oErr.message} — Run supabase/shop_customer_orders_driver_assignment.sql.`
          : oErr.message,
      );
      setLoading(false);
      return;
    }

    const list = (orders || []).filter((o) => ACTIVE_STATUSES.includes(String(o.status || '').toLowerCase().trim()));
    const driverIds = [...new Set(list.map((o) => o.assigned_driver_id).filter(Boolean))];
    let driverById = {};
    if (driverIds.length) {
      const { data: drs, error: dErr } = await supabase
        .from('driver_registrations')
        .select('id, full_name, phone, phone_country_code, vehicle_type, vehicle_plate, vehicle_make, vehicle_model')
        .in('id', driverIds);
      if (!dErr && Array.isArray(drs)) {
        driverById = Object.fromEntries(drs.map((d) => [d.id, d]));
      }
    }

    const merged = list.map((o) => {
      const ol = linesByOrder[o.id] || [];
      const sub = ol.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
      const items = ol.map((l) => `${l.product_name} ×${l.quantity}`).join(', ');
      const d = o.assigned_driver_id ? driverById[o.assigned_driver_id] : null;
      const veh = [d?.vehicle_type, d?.vehicle_make, d?.vehicle_model, d?.vehicle_plate].filter(Boolean).join(' · ');
      return {
        order: o,
        items,
        subtotal: sub,
        driver: d,
        vehicleLine: veh || '—',
        phase: phaseLabel(o.status),
      };
    });

    merged.sort((a, b) => new Date(b.order.assigned_at || b.order.placed_at || 0) - new Date(a.order.assigned_at || a.order.placed_at || 0));
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load();
    }, 12000);
    return () => window.clearInterval(id);
  }, [load]);

  const headingCount = rows.filter((r) => String(r.order.status || '').toLowerCase().trim() === 'ready for delivery').length;

  return (
    <div className="sop">
      <div className="sopPageH">
        <h1>Delivery driver</h1>
        <span className="sopI2" style={{ fontSize: '0.78rem', color: '#555' }}>
          Drivers who accepted your shop orders — live status (refreshes every ~12s).
        </span>
      </div>

      {err ? (
        <div className="sopCard" style={{ borderColor: '#f0c7c7', marginBottom: '0.75rem' }}>
          <p style={{ margin: 0, color: '#b42318', fontWeight: 600 }}>{err}</p>
        </div>
      ) : null}

      <div className="sopRow2" style={{ marginBottom: '0.75rem' }}>
        <div className="sopCard">
          <p className="sopClab">Heading to your shop</p>
          <p className="sopCval sopCval--o">{loading ? '…' : headingCount}</p>
        </div>
        <div className="sopCard">
          <p className="sopClab">Active with driver</p>
          <p className="sopCval">{loading ? '…' : rows.length}</p>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="sopI2" style={{ color: '#666' }}>
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <div className="sopCard">
          <p style={{ margin: 0, color: '#555', lineHeight: 1.45 }}>
            No driver is assigned to your shop orders yet. When you mark an order <strong>Ready for delivery</strong> and a
            driver accepts it, they appear here while they travel to your shop and complete the delivery.
          </p>
        </div>
      ) : (
        <div className="sopTwrap">
          <table className="sopTable">
            <thead>
              <tr>
                <th>Order</th>
                <th>Stage</th>
                <th>Driver</th>
                <th>Driver phone</th>
                <th>Vehicle</th>
                <th>Customer</th>
                <th>Drop-off</th>
                <th>Your lines</th>
                <th>Subtotal</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ order: o, items, subtotal, driver: d, vehicleLine, phase }) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.order_number}</strong>
                  </td>
                  <td>
                    <span className="sopBdg sopBdg--t">{phase}</span>
                  </td>
                  <td>{d?.full_name?.trim() || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{d ? driverPhone(d) : '—'}</td>
                  <td style={{ fontSize: '0.82rem', maxWidth: '12rem' }} title={vehicleLine}>
                    {vehicleLine}
                  </td>
                  <td>{o.customer_full_name}</td>
                  <td style={{ fontSize: '0.82rem', maxWidth: '14rem' }} title={o.customer_address}>
                    {o.customer_address}
                  </td>
                  <td style={{ fontSize: '0.8rem', maxWidth: '14rem' }} title={items}>
                    {items || '—'}
                  </td>
                  <td>{formatGBP(subtotal)}</td>
                  <td className="sopI2" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {formatDt(o.assigned_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
