import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatGBP } from '../lib/currency';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const PERIODS = [
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
];
function statusLabel(raw) {
  const s = String(raw || 'placed').toLowerCase().replace(/_/g, ' ');
  if (s === 'placed') return 'pending';
  if (s === 'processing') return 'processing';
  if (s === 'ready for delivery') return 'processing';
  if (s === 'picked up') return 'processing';
  if (s === 'in transit') return 'in transit';
  if (s === 'delivered') return 'delivered';
  if (s === 'cancelled') return 'cancelled';
  return s;
}

function MiniLine({ d, w = 48, h = 20 }) {
  return (
    <svg className="sopSpkH" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} preserveAspectRatio="none" aria-hidden>
      <path d={`M${d}`} fill="none" stroke="#F18631" strokeWidth="1.2" />
    </svg>
  );
}
function MiniDonut({ pct }) {
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  const c = 2 * Math.PI * 10;
  const dash = (safe / 100) * c;
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#e8e8e8" strokeWidth="4" />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="#F18631"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}
function MiniBars({ bars }) {
  const h = Array.isArray(bars) && bars.length ? bars : [8, 8, 8, 8, 8, 8, 8];
  return (
    <svg viewBox="0 0 40 20" width="50" height="20" preserveAspectRatio="none" aria-hidden>
      {h.map((v, i) => (
        <rect key={i} x={i * 5.2 + 0.5} y={20 - v * 0.8} width="4" height={v * 0.8} fill="#F18631" rx="0.3" />
      ))}
    </svg>
  );
}

function RevLine({ data, w = 400, h = 120, setTip }) {
  const pad = 28;
  const maxR = Math.max(...data.map((d) => d.rev), 1);
  const coords = data.map((d, i) => {
    const x = pad + (i * (w - 2 * pad)) / (data.length - 1);
    const y = pad + (1 - d.rev / maxR) * (h - 2 * pad);
    return { x, y, d };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block' }}
      onMouseLeave={() => setTip(null)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const t = (e.clientX - r.left) / r.width;
        const i = Math.round(t * (data.length - 1));
        const idx = Math.max(0, Math.min(data.length - 1, i));
        const c = data[idx];
        setTip({ x: e.clientX, y: e.clientY, v: c.rev, l: c.d });
      }}
      role="img"
      aria-label="Revenue trend"
    >
      {[0, 1, 2, 3].map((g) => {
        const yy = pad + (g * (h - 2 * pad)) / 3;
        return <line key={g} x1={pad} y1={yy} x2={w - pad} y2={yy} stroke="#f0f0f0" strokeWidth="0.5" />;
      })}
      <path d={path} fill="none" stroke="#F18631" strokeWidth="1.5" />
      {coords.map((c) => (
        <circle key={c.d.d} cx={c.x} cy={c.y} r="2" fill="#F18631" />
      ))}
    </svg>
  );
}

function StackedBars({ data, w = 400, h = 120 }) {
  const pad = 24;
  const barW = (w - 2 * pad) / data.length - 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 520, display: 'block' }} role="img" aria-label="Orders by status">
      {data.map((d, i) => {
        const x = pad + (i * (w - 2 * pad)) / data.length + 2;
        const t = d.del + d.tr + d.can;
        const h1 = t ? (d.del / t) * (h - 2 * pad) : 0;
        const h2 = t ? (d.tr / t) * (h - 2 * pad) : 0;
        const h3 = t ? (d.can / t) * (h - 2 * pad) : 0;
        const y0 = h - pad;
        return (
          <g key={d.d}>
            <rect x={x} y={y0 - h1 - h2 - h3} width={barW} height={h3} fill="#c62828" rx="0.5" />
            <rect x={x} y={y0 - h1 - h2} width={barW} height={h2} fill="#1565c0" rx="0.5" />
            <rect x={x} y={y0 - h1} width={barW} height={h1} fill="#F18631" rx="0.5" />
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize="5" fill="#6b6b6b">
              {d.d.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ShopOwnerAnalyticsPage() {
  const [per, setPer] = useState('7');
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [allPoints, setAllPoints] = useState([]);
  const [allOrdersCount, setAllOrdersCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [aov, setAov] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [activeDay, setActiveDay] = useState('—');
  const [returnRate, setReturnRate] = useState(0);
  const [onTimePct, setOnTimePct] = useState(0);
  const [inTransitPct, setInTransitPct] = useState(0);
  const [cancelPct, setCancelPct] = useState(0);
  const [uniqueCustomers, setUniqueCustomers] = useState(0);
  const [returningCustomers, setReturningCustomers] = useState(0);
  const [topLocations, setTopLocations] = useState([]);

  const loadAnalytics = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    const session = getShopOwnerSession();
    if (!session?.id) {
      setLoadError('Sign in as a shop owner to view analytics.');
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
      setAllPoints([]);
      setTopProducts([]);
      setAllOrdersCount(0);
      setAov(0);
      setCompletionRate(0);
      setActiveDay('—');
      setReturnRate(0);
      setOnTimePct(0);
      setInTransitPct(0);
      setCancelPct(0);
      setUniqueCustomers(0);
      setReturningCustomers(0);
      setTopLocations([]);
      setLoading(false);
      return;
    }

    const { data: orders, error: orderErr } = await supabase
      .from('shop_customer_orders')
      .select('*')
      .in('id', orderIds);
    if (orderErr) {
      setLoadError(orderErr.message);
      setLoading(false);
      return;
    }

    const { data: products } = await supabase
      .from('shop_products')
      .select('id, name, stock')
      .eq('shop_owner_id', session.id);
    const stockByName = Object.fromEntries((products || []).map((p) => [String(p.name || '').trim(), Number(p.stock) || 0]));

    const orderMap = Object.fromEntries((orders || []).map((o) => [o.id, o]));
    const grouped = {};
    lines.forEach((line) => {
      const ord = orderMap[line.order_id];
      if (!ord) return;
      if (!grouped[line.order_id]) grouped[line.order_id] = { order: ord, lines: [] };
      grouped[line.order_id].lines.push(line);
    });
    const entries = Object.values(grouped).sort(
      (a, b) => new Date(a.order.placed_at).getTime() - new Date(b.order.placed_at).getTime(),
    );

    const now = new Date();
    const points = [];
    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      points.push({
        key: d.toDateString(),
        d: d.toLocaleDateString([], { weekday: 'short', day: '2-digit' }),
        rev: 0,
        del: 0,
        tr: 0,
        can: 0,
      });
    }
    const pointByKey = Object.fromEntries(points.map((p) => [p.key, p]));

    let totalRevenue = 0;
    let delivered = 0;
    let inTransit = 0;
    let cancelled = 0;
    const productAgg = {};
    const customerCount = {};
    const locationCount = {};

    entries.forEach((entry) => {
      const total = entry.lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
      totalRevenue += total;
      const s = statusLabel(entry.order.status);
      if (s === 'delivered') delivered += 1;
      if (s === 'in transit') inTransit += 1;
      if (s === 'cancelled') cancelled += 1;

      const key = new Date(entry.order.placed_at).toDateString();
      const p = pointByKey[key];
      if (p) {
        p.rev += total;
        if (s === 'delivered') p.del += 1;
        else if (s === 'in transit') p.tr += 1;
        else if (s === 'cancelled') p.can += 1;
      }

      const custKey = String(entry.order.customer_phone || entry.order.customer_email || entry.order.customer_full_name || '').trim();
      if (custKey) customerCount[custKey] = (customerCount[custKey] || 0) + 1;

      const rawAddr = String(entry.order.customer_address || '').trim();
      const area = rawAddr.split(',')[0]?.trim();
      if (area) locationCount[area] = (locationCount[area] || 0) + 1;

      entry.lines.forEach((l) => {
        const name = String(l.product_name || 'Product').trim();
        if (!productAgg[name]) productAgg[name] = { name, u: 0, r: 0 };
        productAgg[name].u += Number(l.quantity) || 0;
        productAgg[name].r += Number(l.line_total) || 0;
      });
    });

    const totalOrders = entries.length;
    const completed = delivered;
    const completion = totalOrders ? (completed / totalOrders) * 100 : 0;
    const aovNum = totalOrders ? totalRevenue / totalOrders : 0;
    const activePoint = [...points].sort((a, b) => (b.del + b.tr + b.can) - (a.del + a.tr + a.can))[0];
    const unique = Object.keys(customerCount).length;
    const returning = Object.values(customerCount).filter((n) => n > 1).length;
    const returnPct = unique ? (returning / unique) * 100 : 0;

    setAllPoints(points);
    setAllOrdersCount(totalOrders);
    setAov(aovNum);
    setCompletionRate(completion);
    setActiveDay(activePoint ? activePoint.d.split(' ')[0] : '—');
    setReturnRate(returnPct);
    setOnTimePct(completion);
    setInTransitPct(totalOrders ? (inTransit / totalOrders) * 100 : 0);
    setCancelPct(totalOrders ? (cancelled / totalOrders) * 100 : 0);
    setUniqueCustomers(unique);
    setReturningCustomers(returning);
    setTopLocations(
      Object.entries(locationCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name),
    );
    setTopProducts(
      Object.values(productAgg)
        .sort((a, b) => b.r - a.r)
        .slice(0, 8)
        .map((p) => ({ ...p, s: stockByName[p.name] ?? 0 })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const ddata = useMemo(() => {
    const days = Number(per) || 7;
    const sliced = allPoints.slice(-days);
    return sliced.length ? sliced : [];
  }, [allPoints, per]);
  const currentRev = useMemo(() => ddata.reduce((s, x) => s + x.rev, 0), [ddata]);
  const previousRev = useMemo(() => {
    const days = Number(per) || 7;
    if (allPoints.length < days * 2) return 0;
    return allPoints.slice(-(days * 2), -days).reduce((s, x) => s + x.rev, 0);
  }, [allPoints, per]);
  const chg = useMemo(() => {
    if (previousRev <= 0) return 0;
    return ((currentRev - previousRev) / previousRev) * 100;
  }, [currentRev, previousRev]);
  const miniBars = useMemo(() => ddata.slice(-7).map((x) => x.del + x.tr + x.can), [ddata]);

  return (
    <div className="sop" style={{ position: 'relative' }}>
      <div className="sopPageH">
        <h1>Analytics</h1>
        <div className="sopPerR" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className={per === p.id ? 'sopPill2 sopPill2--on' : 'sopPill2'} onClick={() => setPer(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {loadError ? (
        <div className="sopAnCard" style={{ borderColor: '#f0c7c7' }}>
          <p style={{ margin: 0, color: '#b42318', fontSize: '0.88rem' }}>{loadError}</p>
        </div>
      ) : null}
      <div className="sopAnCard" style={{ position: 'relative' }}>
        <div className="soAnH">
          <h2>Revenue overview</h2>
        </div>
        <p className="sopAnBigG" style={{ margin: '0.1rem 0' }}>{formatGBP(currentRev)}</p>
        <p className={`sopChgP ${chg >= 0 ? 'sopChgP--u' : 'sopChgP--d'}`}>
          {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}% vs previous period
        </p>
        <RevLine data={ddata.length ? ddata : [{ d: '—', rev: 0, del: 0, tr: 0, can: 0 }]} setTip={setTip} />
        {tip && (
          <div className="sopTtip" style={{ left: tip.x + 10, top: tip.y - 40 }}>
            {tip.l} · {formatGBP(tip.v)} revenue
          </div>
        )}
        <p style={{ fontSize: '0.65rem', color: '#888', margin: '0.2rem 0 0' }}>
          {loading ? 'Loading analytics…' : `Based on your last ${per} days.`}
        </p>
      </div>
      <div className="sopAnCard" style={{ marginTop: 8 }}>
        <div className="soAnH">
          <h2>Orders overview</h2>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#6b6b6b', margin: '0 0 0.3rem' }}>
          Stacked: delivered (green) · in transit (blue) · cancelled (red)
        </p>
        <StackedBars data={ddata.length ? ddata : [{ d: '—', rev: 0, del: 0, tr: 0, can: 0 }]} />
        <div style={{ display: 'flex', flexDirection: 'row', gap: 10, fontSize: '0.7rem', marginTop: 6, flexWrap: 'wrap' }}>
          <span><span style={{ color: '#F18631' }}>■</span> Delivered</span>
          <span><span style={{ color: '#1565c0' }}>■</span> In transit</span>
          <span><span style={{ color: '#c62828' }}>■</span> Cancelled</span>
        </div>
      </div>
      <div className="sopGrid2x2">
        <div className="sopAnCard" style={{ margin: 0 }}>
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Average order value</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.15rem 0' }}>{formatGBP(aov)}</p>
            <div className="sopSmini">
            <MiniLine d="0,14 10,6 20,8 30,2 40,0 48,4" />
          </div>
        </div>
        <div className="sopAnCard" style={{ margin: 0 }}>
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order completion rate</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F18631', margin: '0.15rem 0' }}>{completionRate.toFixed(0)}%</p>
          <MiniDonut pct={completionRate} />
        </div>
        <div className="sopAnCard" style={{ margin: 0 }}>
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Most active day</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0.15rem 0' }}>{activeDay}</p>
          <div className="sopSmini">
            <MiniBars bars={miniBars} />
          </div>
        </div>
        <div className="sopAnCard" style={{ margin: 0 }}>
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer return rate</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F18631', margin: '0.15rem 0' }}>{returnRate.toFixed(0)}%</p>
            <div className="sopSmini">
            <MiniLine d="0,16 12,0 24,4 40,0 48,3" w={48} h={20} />
          </div>
        </div>
      </div>
      <div className="sopSecH">
        <h2>Best performing products</h2>
      </div>
      <div className="sopTwrap">
        <table className="sopTable" style={{ minWidth: 500 }} aria-label="Top products">
          <thead>
            <tr>
              <th>Product</th>
              <th>Units sold</th>
              <th>Revenue</th>
              <th>Stock left</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admDim" style={{ padding: '1rem' }}>
                  Loading products…
                </td>
              </tr>
            ) : topProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="admDim" style={{ padding: '1rem' }}>
                  No product sales yet.
                </td>
              </tr>
            ) : (
              topProducts.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 800 }}>{p.name}</td>
                  <td>{p.u}</td>
                  <td style={{ color: '#F18631', fontWeight: 800 }}>{formatGBP(p.r)}</td>
                  <td>{p.s}</td>
                  <td>—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="sopAnCard" style={{ marginTop: 12 }}>
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 800 }}>Delivery stats</h2>
        <p style={{ margin: '0.15rem 0', fontSize: '0.82rem' }}>
          Total tracked orders: <strong>{allOrdersCount}</strong>
        </p>
        <div className="sopDbarC">
          <div className="sopDbarR">
            <span style={{ width: 6 }}> </span> On time
            <div className="sopDbarH" style={{ flex: 1 }}>
              <div className="sopDbarF sopDbarF--g" style={{ width: `${onTimePct.toFixed(1)}%` }} />
            </div>
            <span>{onTimePct.toFixed(0)}%</span>
          </div>
          <div className="sopDbarR">
            <span> </span> Late
            <div className="sopDbarH" style={{ flex: 1 }}>
              <div className="sopDbarF sopDbarF--r" style={{ width: `${inTransitPct.toFixed(1)}%` }} />
            </div>
            <span>{inTransitPct.toFixed(0)}%</span>
          </div>
          <div className="sopDbarR">
            <span> </span> Cancelled
            <div className="sopDbarH" style={{ flex: 1 }}>
              <div className="sopDbarF sopDbarF--gr" style={{ width: `${cancelPct.toFixed(1)}%` }} />
            </div>
            <span>{cancelPct.toFixed(0)}%</span>
          </div>
        </div>
        <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: '0.3rem 0 0' }}>Horizontal view of current order outcomes</p>
        <div className="sopHBar" style={{ marginTop: 8, height: 10 }}>
          <div className="sopHSeg" style={{ flex: Math.max(onTimePct, 0.1), background: '#F18631' }} title="On time" />
          <div className="sopHSeg" style={{ flex: Math.max(inTransitPct, 0.1), background: '#c62828' }} title="Late" />
          <div className="sopHSeg" style={{ flex: Math.max(cancelPct, 0.1), background: '#9e9e9e' }} title="Cancelled" />
        </div>
      </div>
      <div className="sopAnCard">
        <h2 style={{ margin: '0 0 0.3rem', fontSize: '0.95rem', fontWeight: 800 }}>Customer insights</h2>
        <p style={{ fontSize: '0.85rem', margin: '0.2rem 0' }}>
          New customers this period: <strong>{Math.max(uniqueCustomers - returningCustomers, 0)}</strong> · Returning: <strong>{returningCustomers}</strong>
        </p>
        <p style={{ fontSize: '0.72rem', color: '#6b6b6b', margin: '0.3rem 0 0.15rem' }}>Top delivery locations</p>
        <div>
          {(topLocations.length ? topLocations : ['No location data']).map((L) => (
            <span key={L} className="sopLocP">
              {L}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
