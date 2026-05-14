import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatGBP } from '../lib/currency';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

function displayStatus(raw) {
  const s = String(raw || 'placed').toLowerCase().replace(/_/g, ' ');
  if (s === 'placed') return 'Pending';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'delivered') return 'Delivered';
  if (s === 'processing') return 'Processing';
  if (s === 'ready for delivery') return 'Ready for delivery';
  if (s === 'in transit') return 'In transit';
  if (s === 'picked up') return 'Picked up';
  return String(raw || 'Pending').replace(/^\w/, (c) => c.toUpperCase());
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function badgeClass(s) {
  if (s === 'Delivered') return 'sopBdg sopBdg--d';
  if (s === 'In transit') return 'sopBdg sopBdg--t';
  if (s === 'Picked up') return 'sopBdg sopBdg--u';
  if (s === 'Ready for delivery') return 'sopBdg sopBdg--r';
  if (s === 'Processing') return 'sopBdg sopBdg--p';
  return 'sopBdg sopBdg--x';
}

function IcBox() {
  return (
    <span className="sopCico sopCico--g" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path d="M4 9.5h16" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}
function IcDollar() {
  return (
    <span className="sopCico sopCico--g" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <path
          d="M12 3v18M15.5 6.5a3.5 3.5 0 0 0-7 0c0 2 2 2.5 3.5 3.2s3.5 1.2 3.5 3.3a3.5 3.5 0 0 1-7 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
function IcClock() {
  return (
    <span className="sopCico sopCico--o" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M12 8.5V12l2.2 1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </span>
  );
}
function IcTruck() {
  return (
    <span className="sopCico sopCico--g" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <path
          d="M2 10h9v5H2V10Z M12 12h2.2l1.5 1.2 2.1.1H20v-2.5M6 16.2a1.1 1.1 0 0 0 0 .1M15 16.2a1.1 1.1 0 0 0 0 .1"
          stroke="currentColor"
          strokeWidth="1.1"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function WeekChart({ week }) {
  const w = 280;
  const h = 120;
  const pad = 24;
  const max = Math.max(...week.map((x) => x.v), 1);
  const min = 0;
  const coords = week.map((d, i) => {
    const x = pad + (i * (w - 2 * pad)) / (week.length - 1);
    const y = pad + (1 - (d.v - min) / (max - min)) * (h - 2 * pad);
    return { x, y, d: d.d };
  });
  const dPath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block' }} role="img" aria-label="Revenue this week">
      {[0, 1, 2, 3].map((g) => {
        const y = pad + (g * (h - 2 * pad)) / 3;
        return (
          <line key={g} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#eee" strokeWidth="1" />
        );
      })}
      <path d={dPath} fill="none" stroke="#F18631" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((p) => (
        <circle key={p.d} cx={p.x} cy={p.y} r="2.5" fill="#F18631" />
      ))}
      {coords.map((p) => (
        <text key={p.d} x={p.x} y={h - 6} textAnchor="middle" fontSize="6" fill="#6b6b6b" fontWeight="600">
          {p.d}
        </text>
      ))}
      <text x="4" y="14" fontSize="5.5" fill="#888" fontWeight="600">
        £
      </text>
    </svg>
  );
}

export default function ShopOwnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recent, setRecent] = useState([]);
  const [products, setProducts] = useState([]);
  const [todayOrders, setTodayOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [activeDeliveries, setActiveDeliveries] = useState(0);
  const [week, setWeek] = useState([
    { d: 'Mon', v: 0 },
    { d: 'Tue', v: 0 },
    { d: 'Wed', v: 0 },
    { d: 'Thu', v: 0 },
    { d: 'Fri', v: 0 },
    { d: 'Sat', v: 0 },
    { d: 'Sun', v: 0 },
  ]);

  const loadDashboard = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    const session = getShopOwnerSession();
    if (!session?.id) {
      setLoadError('Sign in as a shop owner to view dashboard data.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const { data: lineRows, error: lineErr } = await supabase
      .from('shop_customer_order_lines')
      .select('*')
      .eq('shop_owner_id', session.id);

    if (lineErr) {
      setLoadError(lineErr.message);
      setLoading(false);
      return;
    }

    const lines = Array.isArray(lineRows) ? lineRows : [];
    const orderIds = [...new Set(lines.map((l) => l.order_id).filter(Boolean))];

    if (!orderIds.length) {
      setRecent([]);
      setProducts([]);
      setTodayOrders(0);
      setTodayRevenue(0);
      setPendingOrders(0);
      setActiveDeliveries(0);
      setWeek((prev) => prev.map((x) => ({ ...x, v: 0 })));
      setLoading(false);
      return;
    }

    const { data: orderRows, error: orderErr } = await supabase
      .from('shop_customer_orders')
      .select('*')
      .in('id', orderIds);

    if (orderErr) {
      setLoadError(orderErr.message);
      setLoading(false);
      return;
    }

    const orderById = Object.fromEntries((orderRows || []).map((o) => [o.id, o]));
    const grouped = {};
    lines.forEach((line) => {
      const ord = orderById[line.order_id];
      if (!ord) return;
      if (!grouped[line.order_id]) grouped[line.order_id] = { order: ord, lines: [] };
      grouped[line.order_id].lines.push(line);
    });

    const entries = Object.values(grouped).sort(
      (a, b) => new Date(b.order.placed_at).getTime() - new Date(a.order.placed_at).getTime(),
    );

    const now = new Date();
    const recentRows = entries.slice(0, 8).map((x) => {
      const amountNum = x.lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
      const itemCount = x.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
      return {
        id: x.order.order_number || x.order.id,
        customer: x.order.customer_full_name || 'Customer',
        items: String(itemCount),
        amount: formatGBP(amountNum),
        status: displayStatus(x.order.status),
      };
    });
    setRecent(recentRows);

    let todayOrderCount = 0;
    let todayRev = 0;
    let pendingCount = 0;
    let activeCount = 0;
    entries.forEach((x) => {
      const placed = new Date(x.order.placed_at);
      const status = displayStatus(x.order.status);
      const orderTotal = x.lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
      if (isSameDay(placed, now)) {
        todayOrderCount += 1;
        todayRev += orderTotal;
      }
      if (status === 'Pending' || status === 'Processing') pendingCount += 1;
      if (status === 'In transit') activeCount += 1;
    });
    setTodayOrders(todayOrderCount);
    setTodayRevenue(todayRev);
    setPendingOrders(pendingCount);
    setActiveDeliveries(activeCount);

    const productAgg = {};
    lines.forEach((line) => {
      const name = line.product_name || 'Product';
      if (!productAgg[name]) productAgg[name] = { name, units: 0, revNum: 0 };
      productAgg[name].units += Number(line.quantity) || 0;
      productAgg[name].revNum += Number(line.line_total) || 0;
    });
    setProducts(
      Object.values(productAgg)
        .sort((a, b) => b.units - a.units)
        .slice(0, 5)
        .map((p) => ({ ...p, rev: formatGBP(p.revNum), units: String(p.units) })),
    );

    const dayKeys = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() - i);
      dayKeys.push({ key: d.toDateString(), d: d.toLocaleDateString([], { weekday: 'short' }), v: 0 });
    }
    lines.forEach((line) => {
      const ord = orderById[line.order_id];
      if (!ord?.placed_at) return;
      const key = new Date(ord.placed_at).toDateString();
      const day = dayKeys.find((x) => x.key === key);
      if (day) day.v += Number(line.line_total) || 0;
    });
    setWeek(dayKeys.map((x) => ({ d: x.d, v: Number(x.v.toFixed(2)) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const weekGrowthText = useMemo(() => {
    if (week.length < 2) return 'No trend data yet';
    const prev = week.slice(0, -1).reduce((s, x) => s + x.v, 0);
    const last = week[week.length - 1].v;
    if (prev <= 0) return 'No trend data yet';
    const pct = ((last - prev / (week.length - 1)) / (prev / (week.length - 1))) * 100;
    const dir = pct >= 0 ? '+' : '';
    return `${dir}${pct.toFixed(0)}% vs avg day`;
  }, [week]);

  return (
    <div>
      {loadError ? (
        <div className="sopCard" style={{ borderColor: '#f0c7c7', marginBottom: '0.65rem', padding: '0.65rem 0.85rem' }}>
          <p style={{ margin: 0, color: '#b42318', fontSize: '0.88rem' }}>{loadError}</p>
        </div>
      ) : null}
      <div className="sopGrid4" aria-label="Key metrics">
        <div className="sopCard">
          <IcBox />
          <p className="sopClab">Total orders today</p>
          <p className="sopCval">{todayOrders}</p>
          <p className="sopCsub sopCsub--g">{loading ? 'Loading…' : 'From today only'}</p>
        </div>
        <div className="sopCard">
          <IcDollar />
          <p className="sopClab">Today&apos;s revenue</p>
          <p className="sopCval sopCval--g">{formatGBP(todayRevenue)}</p>
          <p className="sopCsub sopCsub--g">{loading ? 'Loading…' : weekGrowthText}</p>
        </div>
        <div className="sopCard">
          <IcClock />
          <p className="sopClab">Pending orders</p>
          <p className="sopCval sopCval--o">{pendingOrders}</p>
          <p className="sopCsub sopCsub--o">Needs attention</p>
        </div>
        <div className="sopCard">
          <IcTruck />
          <p className="sopClab">Active deliveries</p>
          <p className="sopCval">{activeDeliveries}</p>
          <p className="sopCsub sopCsub--l">In transit now</p>
        </div>
      </div>
      <div className="sopSecH">
        <h2>Recent orders</h2>
        <Link to="/shop-owner/orders" className="sopLink2" style={{ fontSize: '0.82rem' }}>
          View all
        </Link>
      </div>
      <div className="sopTwrap">
        <table className="sopTable" aria-label="Recent orders">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="admDim" style={{ padding: '1rem' }}>
                  Loading recent orders…
                </td>
              </tr>
            ) : recent.length === 0 ? (
              <tr>
                <td colSpan={6} className="admDim" style={{ padding: '1rem' }}>
                  No orders yet. Orders appear here when customers buy your products.
                </td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.customer}</td>
                  <td>{r.items}</td>
                  <td>{r.amount}</td>
                  <td>
                    <span className={badgeClass(r.status)}>{r.status}</span>
                  </td>
                  <td>
                    <Link to="/shop-owner/orders" className="sopBsm">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="sopRow2" style={{ alignItems: 'stretch' }}>
        <div className="sopChartC">
          <h3>Revenue this week</h3>
          <WeekChart week={week} />
        </div>
        <div className="sopCard" style={{ margin: 0 }}>
          <h2 className="sopSecH" style={{ margin: 0, marginBottom: 8 }}>
            Best selling today
          </h2>
          <ul className="sopListP">
            {loading ? (
              <li className="admDim">Loading products…</li>
            ) : products.length === 0 ? (
              <li className="admDim">No product sales data yet.</li>
            ) : (
              products.map((p) => (
                <li key={p.name}>
                  <span>
                    <div className="sopPnm">{p.name}</div>
                    <div className="sopPun">{p.units} units</div>
                  </span>
                  <span className="sopP$">{p.rev}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
