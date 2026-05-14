import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatGBP } from '../lib/currency';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const STEPS = ['Order placed', 'Processing', 'Ready for delivery', 'Picked up', 'In transit', 'Delivered'];

const TABS = ['All', 'Pending', 'Processing', 'Ready for delivery', 'Picked up', 'In transit', 'Delivered', 'Cancelled'];

/** DB values for fulfillment (shop owner–controlled). */
const FULFILLMENT_STATUS_OPTIONS = [
  { db: 'processing', label: 'Processing' },
  { db: 'ready for delivery', label: 'Ready for delivery' },
  { db: 'picked up', label: 'Picked up' },
  { db: 'in transit', label: 'In transit' },
  { db: 'delivered', label: 'Delivered' },
];

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

/** Map DB status to shop-owner UI tab labels */
function displayStatus(raw) {
  const s = String(raw || 'placed').toLowerCase().replace(/_/g, ' ');
  if (s === 'placed') return 'Pending';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'delivered') return 'Delivered';
  if (s === 'processing') return 'Processing';
  if (s === 'ready for delivery') return 'Ready for delivery';
  if (s === 'in transit') return 'In transit';
  if (s === 'picked up') return 'Picked up';
  return raw ? String(raw).replace(/^\w/, (c) => c.toUpperCase()) : 'Pending';
}

function bdg(s) {
  const x = String(s || '').toLowerCase();
  if (x === 'delivered') return 'sopBdg sopBdg--d';
  if (x === 'in transit') return 'sopBdg sopBdg--t';
  if (x === 'picked up') return 'sopBdg sopBdg--u';
  if (x === 'ready for delivery') return 'sopBdg sopBdg--r';
  if (x === 'processing' || x === 'pending') return 'sopBdg sopBdg--p';
  if (x === 'cancelled') return 'sopBdg sopBdg--x';
  return 'sopBdg sopBdg--p';
}

function stepIndex(status) {
  const x = String(status || '').toLowerCase();
  if (x === 'pending' || x === 'placed') return 0;
  if (x === 'cancelled') return 0;
  if (x === 'processing') return 1;
  if (x === 'ready for delivery') return 2;
  if (x === 'picked up') return 3;
  if (x === 'in transit') return 4;
  if (x === 'delivered') return 5;
  return 0;
}

function mapGroupedToRow({ order, lines }, session) {
  const amt = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const itemsStr = lines.map((l) => `${l.product_name} ×${l.quantity}`).join(', ');
  const st = displayStatus(order.status);
  return {
    orderDbId: order.id,
    id: order.order_number,
    customer: order.customer_full_name,
    items: itemsStr,
    pickup: session?.business_name ? `${session.business_name} (your shop)` : 'Your shop',
    drop: order.customer_address,
    amount: formatGBP(amt),
    amountNum: amt,
    date: formatDt(order.placed_at),
    status: st,
    statusRaw: String(order.status || 'placed')
      .toLowerCase()
      .trim(),
    phone: order.customer_phone,
    email: order.customer_email || '',
    notes: order.customer_notes || '',
    myLines: lines,
  };
}

function IcView() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M2 12s4-5.2 10-5.2S22 12 22 12s-4 5.2-10 5.2S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}
function IcTr() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path d="M3 7h18M5 3l-2 4M19 3l2 4M3 7v12h18V7" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </svg>
  );
}
function IcX() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M5 5.5L18.2 19M5 18.5L18.2 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ShopOwnerOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    const s = getShopOwnerSession();
    if (!s?.id) {
      setRows([]);
      setLoadError('Sign in as a shop owner to see orders for your products.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setRows([]);
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const { data: lineRows, error: lErr } = await supabase
      .from('shop_customer_order_lines')
      .select('*')
      .eq('shop_owner_id', s.id);

    if (lErr) {
      setRows([]);
      setLoadError(
        lErr.message?.includes('shop_customer_order_lines')
          ? `${lErr.message} — Run supabase/shop_customer_orders.sql.`
          : lErr.message,
      );
      setLoading(false);
      return;
    }

    const lines = Array.isArray(lineRows) ? lineRows : [];
    const orderIds = [...new Set(lines.map((l) => l.order_id).filter(Boolean))];
    let orderMap = {};
    if (orderIds.length) {
      const { data: ordRows, error: oErr } = await supabase.from('shop_customer_orders').select('*').in('id', orderIds);
      if (oErr) {
        setRows([]);
        setLoadError(oErr.message);
        setLoading(false);
        return;
      }
      for (const o of ordRows || []) orderMap[o.id] = o;
    }

    const grouped = {};
    for (const l of lines) {
      const ord = orderMap[l.order_id];
      if (!ord) continue;
      if (!grouped[l.order_id]) grouped[l.order_id] = { order: ord, lines: [] };
      grouped[l.order_id].lines.push(l);
    }

    const list = Object.values(grouped).sort((a, b) => new Date(b.order.placed_at) - new Date(a.order.placed_at));
    setRows(list.map((g) => mapGroupedToRow(g, s)));
    setLoadError('');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCancelErr('');
    setStatusErr('');
  }, [sel]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== 'All') {
      list = list.filter((o) => o.status === tab);
    }
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id).toLowerCase().includes(t) ||
          o.customer.toLowerCase().includes(t) ||
          o.items.toLowerCase().includes(t) ||
          (o.email && o.email.toLowerCase().includes(t)) ||
          o.drop.toLowerCase().includes(t),
      );
    }
    return list;
  }, [tab, q, rows]);

  const o = useMemo(() => rows.find((x) => x.orderDbId === sel) || null, [rows, sel]);
  const si = o ? stepIndex(o.status) : 0;

  const soleSellerForOrder = async (orderId) => {
    if (!supabase) return false;
    const sid = getShopOwnerSession()?.id;
    if (!sid) return false;
    const { data: all } = await supabase.from('shop_customer_order_lines').select('shop_owner_id').eq('order_id', orderId);
    if (!all?.length) return false;
    return all.every((l) => l.shop_owner_id === sid);
  };

  const updateFulfillmentStatus = async (nextDb) => {
    const sid = getShopOwnerSession()?.id;
    if (!o || !sid || !supabase || !nextDb) return;
    const cur = o.statusRaw;
    if (cur === nextDb) return;
    setStatusErr('');
    setStatusBusy(true);
    try {
      const ok = await soleSellerForOrder(o.orderDbId);
      if (!ok) {
        setStatusErr('This order includes other shops. Only an admin can change status for the whole order.');
        setStatusBusy(false);
        return;
      }
      const { error } = await supabase.from('shop_customer_orders').update({ status: nextDb }).eq('id', o.orderDbId);
      if (error) {
        setStatusErr(error.message);
        setStatusBusy(false);
        return;
      }
      await load();
    } catch {
      setStatusErr('Could not update status. Try again.');
    } finally {
      setStatusBusy(false);
    }
  };

  const cancelOrder = async () => {
    const sid = getShopOwnerSession()?.id;
    if (!o || !sid || !supabase) return;
    setCancelErr('');
    setCancelBusy(true);
    try {
      const ok = await soleSellerForOrder(o.orderDbId);
      if (!ok) {
        setCancelErr('This order includes other shops. Only an admin can cancel the whole order.');
        setCancelBusy(false);
        return;
      }
      const { error } = await supabase.from('shop_customer_orders').update({ status: 'cancelled' }).eq('id', o.orderDbId);
      if (error) {
        setCancelErr(error.message);
        setCancelBusy(false);
        return;
      }
      await load();
      setSel(null);
    } catch {
      setCancelErr('Could not cancel. Try again.');
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div>
      <div className="sopH2O">
        <h1>My orders</h1>
        <div className="sopFilR">
          <button type="button" className="sopEx" aria-label="Refresh" onClick={() => load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="sopCard" style={{ borderColor: '#f0c7c7', marginBottom: '0.65rem', padding: '0.65rem 0.85rem' }}>
          <p style={{ margin: 0, color: '#b42318', fontSize: '0.88rem' }}>{loadError}</p>
        </div>
      ) : null}

      <div className="sopTabs" role="tablist" aria-label="Filter orders">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={tab === t ? 'sopTab sopTab--on' : 'sopTab'}
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        className="sopSrch"
        placeholder="Search by order ID, customer, items…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search orders"
      />
      <div className="sopTwrap">
        <table className="sopTable" style={{ minWidth: 800 }} aria-label="All orders">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Pickup</th>
              <th>Delivery</th>
              <th>Your total</th>
              <th>Date &amp; time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="admDim" style={{ padding: '1rem' }}>
                  Loading orders…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="admDim" style={{ padding: '1rem' }}>
                  {rows.length === 0
                    ? 'No orders yet. When customers buy your products from /shops, those orders appear here.'
                    : 'No orders match this filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.orderDbId}>
                  <td>
                    <button
                      type="button"
                      className="sopLink2"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                      onClick={() => setSel(r.orderDbId)}
                    >
                      {r.id}
                    </button>
                  </td>
                  <td>{r.customer}</td>
                  <td style={{ maxWidth: 220, fontSize: '0.78rem' }}>{r.items}</td>
                  <td style={{ maxWidth: 120, fontSize: '0.75rem' }}>{r.pickup}</td>
                  <td style={{ maxWidth: 120, fontSize: '0.75rem' }}>{r.drop}</td>
                  <td>{r.amount}</td>
                  <td style={{ fontSize: '0.7rem' }}>{r.date}</td>
                  <td>
                    <span className={bdg(r.status)}>{r.status}</span>
                  </td>
                  <td>
                    <button type="button" className="sopIconB sopIconB--g" aria-label="View" onClick={() => setSel(r.orderDbId)}>
                      <IcView />
                    </button>
                    <button type="button" className="sopIconB" style={{ marginLeft: 2 }} aria-label="View details" onClick={() => setSel(r.orderDbId)}>
                      <IcTr />
                    </button>
                    {r.status !== 'Cancelled' && r.status !== 'Delivered' && (
                      <button type="button" className="sopIconB sopIconB--d" style={{ marginLeft: 2 }} aria-label="Cancel order" onClick={() => setSel(r.orderDbId)}>
                        <IcX />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="sopPag" aria-label="Pagination">
        <span className="admDim" style={{ fontSize: '0.78rem' }}>
          {filtered.length} order{filtered.length === 1 ? '' : 's'} shown
        </span>
      </div>

      <div className={o ? 'sopPan sopPan--on' : 'sopPan'} role="dialog" aria-modal="true" aria-label="Order details" style={{ zIndex: 300 }}>
        {o && (
          <>
            <div className="sopPanH" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '0.9rem' }}>{o.id}</h2>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b6b6b' }}>{o.date}</p>
              </div>
              <button type="button" className="sopI2" onClick={() => setSel(null)} style={{ lineHeight: 1 }} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="sopPanB">
              <div className="sopPanC">
                <h3>Customer</h3>
                <strong>{o.customer}</strong>
                <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 4 }}>{o.phone}</div>
                {o.email ? <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 2 }}>{o.email}</div> : null}
              </div>
              <div className="sopPanC">
                <h3>Items ordered (your shop)</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem' }}>
                  {o.myLines.map((l) => (
                    <li key={l.id}>
                      {l.product_name} ×{l.quantity} — {formatGBP(Number(l.line_total) || 0)}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#555' }}>Your portion of this checkout (other shops may appear on the same customer order).</div>
              </div>
              <div className="sopPanC">
                <h3>Delivery address</h3>
                {o.drop}
                {o.notes ? (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
                    <strong>Customer notes:</strong> {o.notes}
                  </p>
                ) : null}
              </div>
              <div>
                <h3 style={{ margin: '0.2rem 0' }}>Status</h3>
                <div className="sopStep">
                  {STEPS.map((s, i) => {
                    const st = o.status.toLowerCase();
                    if (st === 'cancelled') {
                      return (
                        <div key={s} className="sopStL">
                          <span className="sopStPend">○ {s}</span>
                        </div>
                      );
                    }
                    if (st === 'delivered') {
                      return (
                        <div key={s} className="sopStL" style={i > 0 ? { borderLeft: '2px solid #e0e0e0', paddingLeft: 8, marginLeft: 4 } : {}}>
                          <span className="sopStDone">✓ {s}</span>
                        </div>
                      );
                    }
                    const done = i < si;
                    return (
                      <div key={s} className="sopStL" style={i > 0 ? { borderLeft: '2px solid #e0e0e0', paddingLeft: 8, marginLeft: 4 } : {}}>
                        <span className={done || i === si ? 'sopStDone' : 'sopStPend'}>
                          {done ? '✓' : '○'} {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {o.status.toLowerCase() === 'cancelled' && <p style={{ color: '#c62828', fontSize: '0.78rem' }}>This order was cancelled.</p>}
              </div>

              {!['cancelled', 'delivered'].includes(o.statusRaw) ? (
                <div className="sopPanC sopPanC--statusPick">
                  <h3>Change status</h3>
                  <p style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', color: '#666', lineHeight: 1.35 }}>
                    Select the current stage for this order. Customers see updates on their order history.
                  </p>
                  <fieldset className="sopStatPick" disabled={statusBusy}>
                    <legend className="sopStatPick__leg">Fulfillment</legend>
                    {FULFILLMENT_STATUS_OPTIONS.map(({ db, label }) => (
                      <label key={db} className="sopStatPick__row">
                        <input
                          type="radio"
                          name={`fulfill-${o.orderDbId}`}
                          checked={o.statusRaw === db}
                          onChange={() => updateFulfillmentStatus(db)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                  {statusBusy ? <p className="sopStatPick__hint">Updating…</p> : null}
                  {statusErr ? (
                    <p role="alert" style={{ color: '#c62828', fontSize: '0.72rem', margin: '0.35rem 0 0' }}>
                      {statusErr}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="sopPanC">
                <h3>Payment</h3>
                <div>
                  Total for your items: <strong style={{ color: '#F18631' }}>{o.amount}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 4 }}>Demo: payment on delivery / as agreed with customer.</div>
              </div>
              {cancelErr ? (
                <p role="alert" style={{ color: '#c62828', fontSize: '0.78rem', margin: 0 }}>
                  {cancelErr}
                </p>
              ) : null}
              {o.status.toLowerCase() !== 'cancelled' && o.status.toLowerCase() !== 'delivered' && (
                <button type="button" className="sopBtn3" disabled={cancelBusy} onClick={cancelOrder}>
                  {cancelBusy ? 'Cancelling…' : 'Cancel order'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {o && (
        <div
          className="sopOvl sopOvl--on"
          onClick={() => {
            setSel(null);
            setCancelErr('');
          }}
          role="presentation"
          style={{ zIndex: 250 }}
        />
      )}
    </div>
  );
}
