import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatGBP } from '../lib/currency';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './adminPortal.css';

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function timeAgo(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function shortOrderRef(prefix, id) {
  if (!id) return '—';
  const short = String(id).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${prefix}-${short}`;
}

function orderStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered' || s === 'completed' || s === 'paid') return 'admBadgeStatus admGreen';
  if (s === 'cancelled') return 'admBadgeStatus admRed';
  if (s === 'assigned' || s === 'confirmed') return 'admBadgeStatus admBlue';
  return 'admBadgeStatus admOrange';
}

function BarChart({ ordersByDay }) {
  const max = Math.max(1, ...ordersByDay.map((item) => item.value));
  const width = 420;
  const height = 230;
  const barWidth = 34;
  return (
    <svg className="admChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Orders last 7 days">
      <text x="8" y="20" fill="#8a8a8a" fontSize="10">
        Orders
      </text>
      {ordersByDay.map((item, index) => {
        const barHeight = (item.value / max) * 145;
        const x = 36 + index * 52;
        const y = 175 - barHeight;
        return (
          <g key={`${item.day}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="7" fill="#2DB84B" />
            <text x={x + barWidth / 2} y="198" textAnchor="middle" fill="#777" fontSize="11">
              {item.day}
            </text>
          </g>
        );
      })}
      <line x1="30" y1="177" x2="396" y2="177" stroke="#ebefec" />
    </svg>
  );
}

function LineChart({ revenueByDay }) {
  const vals = revenueByDay.map((item) => item.value);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const width = 420;
  const height = 230;
  const span = max - min || 1;
  const points = revenueByDay.map((item, index) => {
    const x = 34 + index * 53;
    const y = 35 + ((max - item.value) / span) * 130;
    return `${x},${y}`;
  });
  return (
    <svg className="admChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue last 7 days">
      <polyline fill="none" stroke="#2DB84B" strokeWidth="3" points={points.join(' ')} />
      {revenueByDay.map((item, index) => {
        const x = 34 + index * 53;
        const y = 35 + ((max - item.value) / span) * 130;
        return (
          <g key={`${item.day}-${index}`}>
            <circle cx={x} cy={y} r="4" fill="#2DB84B" />
            <text x={x} y="198" textAnchor="middle" fill="#777" fontSize="11">
              {item.day}
            </text>
          </g>
        );
      })}
      <line x1="28" y1="177" x2="396" y2="177" stroke="#ebefec" />
      <text x="8" y="20" fill="#8a8a8a" fontSize="10">
        Amount
      </text>
    </svg>
  );
}

function buildLast7DayBuckets() {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d),
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      orders: 0,
      revenue: 0,
    });
  }
  return out;
}

function addToBucket(buckets, isoDate, revenueAdd) {
  if (!isoDate) return;
  const k = dayKey(new Date(isoDate));
  const b = buckets.find((x) => x.key === k);
  if (!b) return;
  b.orders += 1;
  b.revenue += revenueAdd;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [customersThisWeek, setCustomersThisWeek] = useState(0);
  const [approvedDrivers, setApprovedDrivers] = useState(0);
  const [pendingDrivers, setPendingDrivers] = useState(0);
  const [liveDrivers, setLiveDrivers] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [ordersYesterday, setOrdersYesterday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYesterday, setRevenueYesterday] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  const [ordersByDay, setOrdersByDay] = useState(() =>
    buildLast7DayBuckets().map((b) => ({ day: b.day, value: 0 })),
  );
  const [revenueByDay, setRevenueByDay] = useState(() =>
    buildLast7DayBuckets().map((b) => ({ day: b.day, value: 0 })),
  );

  const [recentRows, setRecentRows] = useState([]);
  const [topDrivers, setTopDrivers] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);

  const pct = useCallback((today, yest) => {
    if (yest <= 0 && today > 0) return 'new vs yesterday';
    if (yest <= 0) return '—';
    const p = Math.round(((today - yest) / yest) * 100);
    if (p > 0) return `+${p}% vs yesterday`;
    if (p < 0) return `${p}% vs yesterday`;
    return 'same as yesterday';
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setLoadError('Database is not configured. Set your project URL and anon key in environment variables.');
      return;
    }

    setLoading(true);
    const errs = [];

    const now = new Date();
    const todayStart = startOfLocalDay(now).toISOString();
    const todayEnd = endOfLocalDay(now).toISOString();
    const yStart = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)).toISOString();
    const yEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)).toISOString();
    const weekAgo = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)).toISOString();
    const chartSince = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)).toISOString();
    const liveSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    try {
      const [
        custCount,
        custWeek,
        drvApproved,
        drvPending,
        wPending,
        taxiLive,
        tukLive,
        delLive,
      ] = await Promise.all([
        supabase.from('app_users').select('*', { count: 'exact', head: true }),
        supabase.from('app_users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('driver_registrations').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('driver_registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('driver_withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('taxi_bookings')
          .select('assigned_driver_id')
          .not('assigned_driver_id', 'is', null)
          .gte('driver_live_updated_at', liveSince),
        supabase
          .from('tuk_tuk_bookings')
          .select('assigned_driver_id')
          .not('assigned_driver_id', 'is', null)
          .gte('driver_live_updated_at', liveSince),
        supabase
          .from('customer_delivery_orders')
          .select('assigned_driver_id')
          .not('assigned_driver_id', 'is', null)
          .gte('driver_live_updated_at', liveSince),
      ]);

      [custCount, custWeek, drvApproved, drvPending, wPending, taxiLive, tukLive, delLive].forEach((r) => {
        if (r.error) errs.push(r.error.message);
      });

      setTotalCustomers(custCount.count ?? 0);
      setCustomersThisWeek(custWeek.count ?? 0);
      setApprovedDrivers(drvApproved.count ?? 0);
      setPendingDrivers(drvPending.count ?? 0);
      setPendingWithdrawals(wPending.count ?? 0);

      const liveIds = new Set();
      [taxiLive.data, tukLive.data, delLive.data].forEach((rows) => {
        (rows || []).forEach((row) => {
          if (row.assigned_driver_id) liveIds.add(row.assigned_driver_id);
        });
      });
      setLiveDrivers(liveIds.size);

      const countDayOrders = async (startIso, endIso) => {
        const [a, b, c, d] = await Promise.all([
          supabase
            .from('customer_delivery_orders')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          supabase.from('taxi_bookings').select('*', { count: 'exact', head: true }).gte('created_at', startIso).lte('created_at', endIso),
          supabase.from('tuk_tuk_bookings').select('*', { count: 'exact', head: true }).gte('created_at', startIso).lte('created_at', endIso),
          supabase.from('shop_customer_orders').select('*', { count: 'exact', head: true }).gte('placed_at', startIso).lte('placed_at', endIso),
        ]);
        [a, b, c, d].forEach((r) => {
          if (r.error) errs.push(r.error.message);
        });
        return (a.count || 0) + (b.count || 0) + (c.count || 0) + (d.count || 0);
      };

      const sumDayRevenue = async (startIso, endIso) => {
        const [del, tx, tk, shop] = await Promise.all([
          supabase
            .from('customer_delivery_orders')
            .select('total_amount, status')
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          supabase.from('taxi_bookings').select('quoted_price, status').gte('created_at', startIso).lte('created_at', endIso),
          supabase.from('tuk_tuk_bookings').select('quoted_price, status').gte('created_at', startIso).lte('created_at', endIso),
          supabase.from('shop_customer_orders').select('subtotal, status').gte('placed_at', startIso).lte('placed_at', endIso),
        ]);
        [del, tx, tk, shop].forEach((r) => {
          if (r.error) errs.push(r.error.message);
        });
        let sum = 0;
        (del.data || []).forEach((row) => {
          if (String(row.status || '').toLowerCase() !== 'cancelled') sum += Number(row.total_amount || 0);
        });
        (tx.data || []).forEach((row) => {
          if (String(row.status || '').toLowerCase() !== 'cancelled') sum += Number(row.quoted_price || 0);
        });
        (tk.data || []).forEach((row) => {
          if (String(row.status || '').toLowerCase() !== 'cancelled') sum += Number(row.quoted_price || 0);
        });
        (shop.data || []).forEach((row) => {
          if (String(row.status || '').toLowerCase() !== 'cancelled') sum += Number(row.subtotal || 0);
        });
        return sum;
      };

      const [ot, oy, rt, ry] = await Promise.all([
        countDayOrders(todayStart, todayEnd),
        countDayOrders(yStart, yEnd),
        sumDayRevenue(todayStart, todayEnd),
        sumDayRevenue(yStart, yEnd),
      ]);
      setOrdersToday(ot);
      setOrdersYesterday(oy);
      setRevenueToday(rt);
      setRevenueYesterday(ry);

      const buckets = buildLast7DayBuckets();
      const [chDel, chTx, chTk, chShop] = await Promise.all([
        supabase
          .from('customer_delivery_orders')
          .select('created_at, total_amount, status')
          .gte('created_at', chartSince),
        supabase.from('taxi_bookings').select('created_at, quoted_price, status').gte('created_at', chartSince),
        supabase.from('tuk_tuk_bookings').select('created_at, quoted_price, status').gte('created_at', chartSince),
        supabase.from('shop_customer_orders').select('placed_at, subtotal, status').gte('placed_at', chartSince),
      ]);
      [chDel, chTx, chTk, chShop].forEach((r) => {
        if (r.error) errs.push(r.error.message);
      });

      (chDel.data || []).forEach((row) => {
        const rev = String(row.status || '').toLowerCase() === 'cancelled' ? 0 : Number(row.total_amount || 0);
        addToBucket(buckets, row.created_at, rev);
      });
      (chTx.data || []).forEach((row) => {
        const rev = String(row.status || '').toLowerCase() === 'cancelled' ? 0 : Number(row.quoted_price || 0);
        addToBucket(buckets, row.created_at, rev);
      });
      (chTk.data || []).forEach((row) => {
        const rev = String(row.status || '').toLowerCase() === 'cancelled' ? 0 : Number(row.quoted_price || 0);
        addToBucket(buckets, row.created_at, rev);
      });
      (chShop.data || []).forEach((row) => {
        const rev = String(row.status || '').toLowerCase() === 'cancelled' ? 0 : Number(row.subtotal || 0);
        addToBucket(buckets, row.placed_at, rev);
      });

      setOrdersByDay(buckets.map((b) => ({ day: b.day, value: b.orders })));
      setRevenueByDay(buckets.map((b) => ({ day: b.day, value: Math.round(b.revenue * 100) / 100 })));

      const [rDel, rTx, rTk, rShop] = await Promise.all([
        supabase
          .from('customer_delivery_orders')
          .select('id, created_at, status, total_amount, pickup_location, dropoff_location, app_user_id, assigned_driver_id')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('taxi_bookings')
          .select('id, created_at, status, quoted_price, pickup_location, destination_location, app_user_id, assigned_driver_id')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('tuk_tuk_bookings')
          .select('id, created_at, status, quoted_price, pickup_location, destination_location, app_user_id, assigned_driver_id')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('shop_customer_orders')
          .select('id, order_number, placed_at, status, subtotal, customer_full_name')
          .order('placed_at', { ascending: false })
          .limit(12),
      ]);
      [rDel, rTx, rTk, rShop].forEach((r) => {
        if (r.error) errs.push(r.error.message);
      });

      const userIds = new Set();
      const driverIds = new Set();
      (rDel.data || []).forEach((row) => {
        if (row.app_user_id) userIds.add(row.app_user_id);
        if (row.assigned_driver_id) driverIds.add(row.assigned_driver_id);
      });
      (rTx.data || []).forEach((row) => {
        if (row.app_user_id) userIds.add(row.app_user_id);
        if (row.assigned_driver_id) driverIds.add(row.assigned_driver_id);
      });
      (rTk.data || []).forEach((row) => {
        if (row.app_user_id) userIds.add(row.app_user_id);
        if (row.assigned_driver_id) driverIds.add(row.assigned_driver_id);
      });

      const [usersRes, driversRes] = await Promise.all([
        userIds.size
          ? supabase.from('app_users').select('id, full_name').in('id', [...userIds])
          : Promise.resolve({ data: [], error: null }),
        driverIds.size
          ? supabase.from('driver_registrations').select('id, full_name').in('id', [...driverIds])
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (usersRes.error) errs.push(usersRes.error.message);
      if (driversRes.error) errs.push(driversRes.error.message);

      const userMap = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.full_name]));
      const driverMap = Object.fromEntries((driversRes.data || []).map((d) => [d.id, d.full_name]));

      const merged = [];
      (rDel.data || []).forEach((row) => {
        merged.push({
          kind: 'Delivery',
          id: shortOrderRef('DEL', row.id),
          rawId: row.id,
          when: row.created_at,
          customer: userMap[row.app_user_id] || 'Guest',
          driver: row.assigned_driver_id ? driverMap[row.assigned_driver_id] || '—' : '—',
          route: `${row.pickup_location || '—'} → ${row.dropoff_location || '—'}`,
          amount: formatGBP(row.total_amount),
          status: row.status || '—',
        });
      });
      (rTx.data || []).forEach((row) => {
        merged.push({
          kind: 'Taxi',
          id: shortOrderRef('TXI', row.id),
          rawId: row.id,
          when: row.created_at,
          customer: userMap[row.app_user_id] || 'Guest',
          driver: row.assigned_driver_id ? driverMap[row.assigned_driver_id] || '—' : '—',
          route: `${row.pickup_location || '—'} → ${row.destination_location || '—'}`,
          amount: formatGBP(row.quoted_price),
          status: row.status || '—',
        });
      });
      (rTk.data || []).forEach((row) => {
        merged.push({
          kind: 'Tuk-Tuk',
          id: shortOrderRef('TUK', row.id),
          rawId: row.id,
          when: row.created_at,
          customer: userMap[row.app_user_id] || 'Guest',
          driver: row.assigned_driver_id ? driverMap[row.assigned_driver_id] || '—' : '—',
          route: `${row.pickup_location || '—'} → ${row.destination_location || '—'}`,
          amount: formatGBP(row.quoted_price),
          status: row.status || '—',
        });
      });
      (rShop.data || []).forEach((row) => {
        merged.push({
          kind: 'Shop',
          id: row.order_number || shortOrderRef('SHP', row.id),
          rawId: row.id,
          when: row.placed_at,
          customer: row.customer_full_name || '—',
          driver: '—',
          route: 'Shop order',
          amount: formatGBP(row.subtotal),
          status: row.status || '—',
        });
      });

      merged.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setRecentRows(merged.slice(0, 10));

      const sinceTop = new Date();
      sinceTop.setDate(sinceTop.getDate() - 90);
      const sinceIso = sinceTop.toISOString();

      const [topDel, topTx, topTk] = await Promise.all([
        supabase
          .from('customer_delivery_orders')
          .select('assigned_driver_id, total_amount')
          .eq('status', 'delivered')
          .not('assigned_driver_id', 'is', null)
          .gte('created_at', sinceIso),
        supabase
          .from('taxi_bookings')
          .select('assigned_driver_id, quoted_price')
          .eq('status', 'completed')
          .not('assigned_driver_id', 'is', null)
          .gte('created_at', sinceIso),
        supabase
          .from('tuk_tuk_bookings')
          .select('assigned_driver_id, quoted_price')
          .eq('status', 'completed')
          .not('assigned_driver_id', 'is', null)
          .gte('created_at', sinceIso),
      ]);
      [topDel, topTx, topTk].forEach((r) => {
        if (r.error) errs.push(r.error.message);
      });

      const tripCount = {};
      const earnings = {};
      const add = (id, amt) => {
        if (!id) return;
        tripCount[id] = (tripCount[id] || 0) + 1;
        earnings[id] = (earnings[id] || 0) + Number(amt || 0);
      };
      (topDel.data || []).forEach((row) => add(row.assigned_driver_id, row.total_amount));
      (topTx.data || []).forEach((row) => add(row.assigned_driver_id, row.quoted_price));
      (topTk.data || []).forEach((row) => add(row.assigned_driver_id, row.quoted_price));

      const ranked = Object.entries(tripCount)
        .map(([id, n]) => ({ id, deliveries: n, earnings: earnings[id] || 0 }))
        .sort((a, b) => b.deliveries - a.deliveries)
        .slice(0, 5);

      const topIds = ranked.map((r) => r.id);
      let ratingByDriver = {};
      if (topIds.length) {
        const { data: revRows, error: revErr } = await supabase
          .from('trip_reviews')
          .select('reviewee_driver_id, rating')
          .in('reviewee_driver_id', topIds);
        if (revErr) errs.push(revErr.message);
        const sums = {};
        const counts = {};
        (revRows || []).forEach((r) => {
          const id = r.reviewee_driver_id;
          if (!id) return;
          sums[id] = (sums[id] || 0) + r.rating;
          counts[id] = (counts[id] || 0) + 1;
        });
        ratingByDriver = Object.fromEntries(Object.keys(sums).map((id) => [id, sums[id] / counts[id]]));
      }

      if (topIds.length) {
        const { data: names, error: ne } = await supabase.from('driver_registrations').select('id, full_name').in('id', topIds);
        if (ne) errs.push(ne.message);
        const nameMap = Object.fromEntries((names || []).map((n) => [n.id, n.full_name]));
        setTopDrivers(
          ranked.map((r, i) => ({
            rank: i + 1,
            name: nameMap[r.id] || 'Driver',
            deliveries: r.deliveries,
            rating: ratingByDriver[r.id] != null ? ratingByDriver[r.id].toFixed(1) : '—',
            earnings: formatGBP(r.earnings),
          })),
        );
      } else {
        setTopDrivers([]);
      }

      const { data: reviews, error: revW } = await supabase
        .from('trip_reviews')
        .select('id, rating, review_text, reviewer_role, created_at')
        .order('created_at', { ascending: false })
        .limit(6);
      if (revW) errs.push(revW.message);
      setRecentReviews(reviews || []);

      setLastLoadedAt(new Date());
      if (errs.length) setLoadError(errs.slice(0, 3).join(' · '));
    } catch (e) {
      setLoadError(e?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ordersSubtitle = useMemo(() => pct(ordersToday, ordersYesterday), [ordersToday, ordersYesterday, pct]);
  const revenueSubtitle = useMemo(() => pct(revenueToday, revenueYesterday), [revenueToday, revenueYesterday, pct]);

  return (
    <div className="adm">
      <div className="admToolbar" style={{ marginBottom: '0.75rem' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>Dashboard</p>
          <p className="admDim" style={{ margin: '0.15rem 0 0', fontSize: '0.82rem' }}>
            Live aggregates ·{' '}
            {lastLoadedAt ? `Updated ${lastLoadedAt.toLocaleTimeString()}` : loading ? 'Loading…' : '—'}
          </p>
        </div>
        <button className="admOutlineBtn" type="button" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loadError ? (
        <div className="admCard" style={{ borderColor: '#f0c7c7', marginBottom: '0.85rem' }}>
          <p style={{ margin: 0, color: '#b42318' }}>{loadError}</p>
        </div>
      ) : null}

      <section className="admGrid4" style={{ marginBottom: '0.8rem' }}>
        <article className="admCard admStat" style={{ borderLeftColor: '#2DB84B' }}>
          <span className="admIconChip admChipGreen">👤</span>
          <h4>Total customers</h4>
          <p className="v">{loading ? '…' : totalCustomers.toLocaleString()}</p>
          <p className="s" style={{ color: '#2DB84B' }}>
            {loading ? '…' : `+${customersThisWeek.toLocaleString()} in last 7 days`}
          </p>
        </article>
        <article className="admCard admStat" style={{ borderLeftColor: '#2e7bff' }}>
          <span className="admIconChip admChipBlue">🚚</span>
          <h4>Approved drivers</h4>
          <p className="v">{loading ? '…' : approvedDrivers.toLocaleString()}</p>
          <p className="s" style={{ color: '#2e7bff' }}>
            {loading ? '…' : `${liveDrivers.toLocaleString()} with live location (15m)`}
          </p>
        </article>
        <article className="admCard admStat" style={{ borderLeftColor: '#ec9120' }}>
          <span className="admIconChip admChipOrange">📦</span>
          <h4>Orders today</h4>
          <p className="v">{loading ? '…' : ordersToday.toLocaleString()}</p>
          <p className="s" style={{ color: '#ec9120' }}>
            {loading ? '…' : ordersSubtitle}
          </p>
        </article>
        <article className="admCard admStat" style={{ borderLeftColor: '#2DB84B' }}>
          <span className="admIconChip admChipGreen">💵</span>
          <h4>Revenue today</h4>
          <p className="v" style={{ color: '#2DB84B' }}>
            {loading ? '…' : formatGBP(revenueToday)}
          </p>
          <p className="s" style={{ color: '#2DB84B' }}>
            {loading ? '…' : revenueSubtitle}
          </p>
        </article>
      </section>

      <section className="admGrid3" style={{ marginBottom: '0.8rem' }}>
        <article className="admCard">
          <h4 style={{ color: '#ec9120', margin: 0 }}>Pending approvals</h4>
          <p style={{ margin: '0.36rem 0', fontWeight: 800, fontSize: '1.2rem' }}>
            {loading ? '…' : `${pendingDrivers.toLocaleString()} driver${pendingDrivers === 1 ? '' : 's'}`}
          </p>
          <Link className="admLink" to="/admin/driver-requests">
            View all
          </Link>
        </article>
        <article className="admCard">
          <h4 style={{ color: '#d34444', margin: 0 }}>Pending withdrawals</h4>
          <p style={{ margin: '0.36rem 0', fontWeight: 800, fontSize: '1.2rem' }}>
            {loading ? '…' : `${pendingWithdrawals.toLocaleString()} open`}
          </p>
          <Link className="admLink" to="/admin/driver-withdrawals">
            View all
          </Link>
        </article>
        <article className="admCard">
          <h4 style={{ color: '#2DB84B', margin: 0 }}>Data source</h4>
          <p style={{ margin: '0.36rem 0', fontWeight: 800, fontSize: '1.2rem', color: '#2DB84B' }}>Connected</p>
          <p style={{ margin: 0, color: '#777', fontSize: '0.85rem' }}>
            Delivery, taxi, tuk-tuk & shop activity from your database
          </p>
        </article>
      </section>

      <section className="admGrid2" style={{ marginBottom: '0.8rem' }}>
        <article className="admCard">
          <div className="admSectionHeader">
            <h3>Orders (last 7 days)</h3>
          </div>
          {loading ? <p className="admDim">Loading chart…</p> : <BarChart ordersByDay={ordersByDay} />}
        </article>
        <article className="admCard">
          <div className="admSectionHeader">
            <h3>Revenue (last 7 days)</h3>
          </div>
          {loading ? <p className="admDim">Loading chart…</p> : <LineChart revenueByDay={revenueByDay} />}
        </article>
      </section>

      <section className="admCard" style={{ marginBottom: '0.8rem' }}>
        <div className="admSectionHeader">
          <h3>Recent activity</h3>
          <Link className="admLink" to="/admin/delivery-orders">
            Delivery orders
          </Link>
        </div>
        <div className="admTableWrap">
          <table className="admTable">
            <thead>
              <tr>
                <th>Type</th>
                <th>Ref</th>
                <th>Customer</th>
                <th>Driver</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="admDim">
                    Loading…
                  </td>
                </tr>
              ) : recentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admDim">
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                recentRows.map((row) => (
                  <tr className="admClickableRow" key={`${row.kind}-${row.rawId}`}>
                    <td>
                      <span className="admBadgeStatus admBlue">{row.kind}</span>
                    </td>
                    <td>{row.id}</td>
                    <td>{row.customer}</td>
                    <td>{row.driver}</td>
                    <td className="admDim" style={{ maxWidth: 220 }}>
                      {row.route}
                    </td>
                    <td>{row.amount}</td>
                    <td>
                      <span className={orderStatusClass(row.status)}>{row.status}</span>
                    </td>
                    <td>{timeAgo(row.when)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admGrid2">
        <article className="admCard">
          <div className="admSectionHeader">
            <h3>Top drivers (90 days)</h3>
          </div>
          {loading ? (
            <p className="admDim">Loading…</p>
          ) : topDrivers.length === 0 ? (
            <p className="admDim">No completed trips with an assigned driver yet.</p>
          ) : (
            topDrivers.map((driver) => (
              <div
                key={driver.rank}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 34px 1fr auto',
                  gap: '0.55rem',
                  alignItems: 'center',
                  padding: '0.4rem 0',
                  borderBottom: '1px solid #f0f2f0',
                }}
              >
                <strong>{driver.rank}</strong>
                <span className="admAvatar" style={{ width: 34, height: 34, fontSize: '0.75rem' }}>
                  {driver.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <div>
                  <div style={{ fontWeight: 700 }}>{driver.name}</div>
                  <div style={{ color: '#777', fontSize: '0.78rem' }}>{driver.deliveries} completed trips</div>
                  <div style={{ color: '#2DB84B', fontSize: '0.8rem' }}>
                    {driver.rating !== '—' ? `★ ${driver.rating}` : 'No reviews'}
                  </div>
                </div>
                <strong style={{ color: '#2DB84B' }}>{driver.earnings}</strong>
              </div>
            ))
          )}
        </article>
        <article className="admCard">
          <div className="admSectionHeader">
            <h3>Recent trip reviews</h3>
            <Link className="admOutlineBtn" to="/admin/reviews" style={{ padding: '0.33rem 0.58rem', textDecoration: 'none' }}>
              Open reviews
            </Link>
          </div>
          {loading ? (
            <p className="admDim">Loading…</p>
          ) : recentReviews.length === 0 ? (
            <p className="admDim">No reviews submitted yet.</p>
          ) : (
            recentReviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'start',
                  gap: '0.55rem',
                  padding: '0.46rem 0',
                  borderBottom: '1px solid #f0f2f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>★ {rev.rating}</div>
                  <div style={{ fontSize: '0.78rem', color: '#555' }}>{rev.reviewer_role === 'driver' ? 'Driver review' : 'Customer review'}</div>
                  {rev.review_text ? (
                    <div style={{ fontSize: '0.82rem', marginTop: '0.2rem', color: '#444' }}>
                      {rev.review_text.length > 120 ? `${rev.review_text.slice(0, 120)}…` : rev.review_text}
                    </div>
                  ) : null}
                  <div className="admDim" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    {timeAgo(rev.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </article>
      </section>
    </div>
  );
}
