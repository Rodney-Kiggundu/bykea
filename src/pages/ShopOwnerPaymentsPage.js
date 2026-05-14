import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatGBP } from '../lib/currency';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const TX_FILT = ['All', 'Sales', 'Payouts', 'Refunds'];

function typeBdg(t) {
  if (t === 'Sale') return 'sopBdgT--sl';
  if (t === 'Payout') return 'sopBdgT--po';
  return 'sopBdgT--rf';
}
function stBdg(s) {
  if (s === 'Completed') return 'sopBdgS--ok';
  if (s === 'Pending') return 'sopBdgS--pd';
  return 'sopBdgS--fl';
}

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function txStatusFromOrder(status) {
  const s = String(status || '').toLowerCase().replace(/_/g, ' ');
  if (s === 'cancelled') return 'Pending';
  if (s === 'delivered') return 'Completed';
  if (s === 'processing' || s === 'in transit' || s === 'placed' || s === 'picked up' || s === 'ready for delivery') return 'Pending';
  return 'Pending';
}

function payoutStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'Completed';
  if (s === 'approved' || s === 'pending') return 'Pending';
  return 'Failed';
}

function IcPdf() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden>
      <path
        d="M6 2h8l4 4v16a.8.8 0 0 1-1.1.1H6.2A.8.8 0 0 1 5.5 21.5V2.1A.8.8 0 0 1 6.2 2Z"
        strokeLinejoin="round"
      />
      <path d="M14 2.2V6h2.1" />
    </svg>
  );
}

export default function ShopOwnerPaymentsPage() {
  const [f, setF] = useState('All');
  const [rows, setRows] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const session = getShopOwnerSession();
  const monthStart = startOfMonth();
  const monthStartIso = monthStart.toISOString();
  const monthLabel = useMemo(
    () => `${monthStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    [monthStart],
  );

  const load = useCallback(async () => {
    setLoadError('');
    if (!session?.id) {
      setRows([]);
      setWithdrawals([]);
      setLoadError('Sign in as shop owner to view payments.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setRows([]);
      setWithdrawals([]);
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);

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
    let orderMap = {};
    if (orderIds.length) {
      const { data: orders, error: orderErr } = await supabase
        .from('shop_customer_orders')
        .select('*')
        .in('id', orderIds);
      if (orderErr) {
        setLoadError(orderErr.message);
        setLoading(false);
        return;
      }
      orderMap = Object.fromEntries((orders || []).map((o) => [o.id, o]));
    }

    const grouped = {};
    lines.forEach((line) => {
      const ord = orderMap[line.order_id];
      if (!ord) return;
      if (!grouped[line.order_id]) grouped[line.order_id] = { order: ord, amount: 0 };
      grouped[line.order_id].amount += Number(line.line_total) || 0;
    });

    const salesRows = Object.values(grouped).map((g) => ({
      id: `TX-${String(g.order.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      date: g.order.placed_at,
      customer: g.order.customer_full_name || 'Customer',
      order: g.order.order_number || '—',
      amount: Math.round(g.amount * 100) / 100,
      type: g.order.status === 'cancelled' ? 'Refund' : 'Sale',
      st: txStatusFromOrder(g.order.status),
    }));

    const { data: wdRows, error: wdErr } = await supabase
      .from('shop_owner_withdrawal_requests')
      .select('*')
      .eq('shop_owner_id', session.id)
      .order('requested_at', { ascending: false });
    if (wdErr) {
      setLoadError(
        wdErr.message?.includes('shop_owner_withdrawal_requests')
          ? `${wdErr.message} — Run supabase/shop_owner_withdrawal_requests.sql.`
          : wdErr.message,
      );
      setLoading(false);
      return;
    }

    const payoutRows = (wdRows || []).map((w) => ({
      id: `TX-WDR-${String(w.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      date: w.paid_at || w.approved_at || w.requested_at,
      customer: 'InGo Payouts',
      order: '—',
      amount: Number(w.amount) || 0,
      type: 'Payout',
      st: payoutStatusLabel(w.status),
    }));

    const tx = [...salesRows, ...payoutRows].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );
    setRows(tx);
    setWithdrawals(wdRows || []);
    setLoading(false);
  }, [session?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const monthSales = rows.filter((r) => r.type === 'Sale' && new Date(r.date) >= monthStart);
    const monthRefunds = rows.filter((r) => r.type === 'Refund' && new Date(r.date) >= monthStart);
    const monthPayouts = withdrawals.filter((w) => new Date(w.requested_at || w.paid_at || 0) >= monthStart);
    const revenue = monthSales.reduce((s, r) => s + r.amount, 0);
    const refunds = monthRefunds.reduce((s, r) => s + r.amount, 0);
    const net = Math.max(0, revenue - refunds);
    const pendingPayout = monthPayouts
      .filter((w) => ['pending', 'approved'].includes(String(w.status || '').toLowerCase()))
      .reduce((s, w) => s + (Number(w.amount) || 0), 0);
    const completedPayout = monthPayouts
      .filter((w) => String(w.status || '').toLowerCase() === 'paid')
      .reduce((s, w) => s + (Number(w.amount) || 0), 0);
    return { revenue, pendingPayout, completedPayout, net };
  }, [monthStart, rows, withdrawals]);

  const availableToWithdraw = useMemo(() => Math.max(0, summary.net - summary.pendingPayout - summary.completedPayout), [summary]);

  const invoices = useMemo(() => {
    const paid = withdrawals.filter((w) => String(w.status || '').toLowerCase() === 'paid');
    return paid.map((w, idx) => ({
      num: `INV-SHOP-${String(idx + 1).padStart(4, '0')}`,
      date: formatDt(w.paid_at || w.requested_at),
      orders: '—',
      amount: Number(w.amount) || 0,
      st: 'Paid',
    }));
  }, [withdrawals]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (f === 'All') return true;
        if (f === 'Sales') return r.type === 'Sale';
        if (f === 'Payouts') return r.type === 'Payout';
        if (f === 'Refunds') return r.type === 'Refund';
        return true;
      }),
    [f, rows],
  );

  const submitWithdrawal = async () => {
    setErr('');
    setMsg('');
    if (!session?.id || !supabase) {
      setErr('Shop owner session is missing.');
      return;
    }
    const n = Number(String(amount).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter a valid amount.');
      return;
    }
    if (n > availableToWithdraw) {
      setErr('Amount exceeds available balance.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('shop_owner_withdrawal_requests').insert({
      shop_owner_id: session.id,
      amount: Math.round(n * 100) / 100,
      status: 'pending',
    });
    setBusy(false);
    if (error) {
      setErr(error.message || 'Could not send request.');
      return;
    }
    setAmount('');
    setMsg('Withdrawal request sent to admin.');
    await load();
  };

  return (
    <div className="sop">
      <div className="sopPageH">
        <h1>Payments</h1>
        <input
          type="text"
          className="sopI2"
          value={monthLabel}
          readOnly
          aria-label="Date range"
          style={{ minWidth: 14 }}
        />
      </div>
      {loadError ? (
        <div className="sopCard" style={{ borderColor: '#f0c7c7', marginBottom: '0.65rem', padding: '0.65rem 0.85rem' }}>
          <p style={{ margin: 0, color: '#b42318', fontSize: '0.88rem' }}>{loadError}</p>
        </div>
      ) : null}
      <div className="sopSum3" role="group" aria-label="Payment summary">
        <div className="sopPayG">
          <p className="n">Total revenue</p>
          <p className="v">{formatGBP(summary.revenue)}</p>
          <p className="s">This month</p>
        </div>
        <div className="sopPayW">
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending payout</p>
          <p style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.1rem 0' }}>{formatGBP(summary.pendingPayout)}</p>
          <span className="soPBdgP">Processing</span>
        </div>
        <div className="sopPayW">
          <p style={{ fontSize: '0.7rem', color: '#6b6b6b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed payouts</p>
          <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#F18631', margin: '0.1rem 0' }}>{formatGBP(summary.completedPayout)}</p>
          <p style={{ fontSize: '0.68rem', color: '#6b6b6b', margin: 0 }}>This month</p>
        </div>
      </div>
      <div className="sopPout">
        <h2>Payout account</h2>
        <div className="sopAccR">
          <span>
            <span style={{ fontWeight: 800 }}>{session?.business_name || 'Shop account'}</span> · {session?.email || 'No email on file'}
            <span className="soPBdgG">Primary</span>
          </span>
        </div>
        <div className="sopAccR" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>Available to withdraw: <strong>{formatGBP(availableToWithdraw)}</strong></span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="sopI2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            aria-label="Withdrawal amount"
            style={{ minWidth: 180 }}
          />
          <button type="button" className="sopEx" onClick={() => setAmount(String(availableToWithdraw.toFixed(2)))}>
            Withdraw all
          </button>
          <button type="button" className="sopBtn2" onClick={submitWithdrawal} disabled={busy} style={{ width: 'auto', margin: 0, padding: '0.42rem 0.7rem' }}>
            {busy ? 'Sending…' : 'Withdraw'}
          </button>
        </div>
        {msg ? <p style={{ margin: '0.45rem 0 0', color: '#0d5c2f', fontSize: '0.82rem', fontWeight: 700 }}>{msg}</p> : null}
        {err ? <p style={{ margin: '0.45rem 0 0', color: '#b42318', fontSize: '0.82rem', fontWeight: 700 }}>{err}</p> : null}
      </div>
      <div className="sopSecH" style={{ marginTop: '0.2rem' }}>
        <h2>Transaction history</h2>
        <button type="button" className="sopEx" aria-label="Refresh" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="sopPerR" style={{ margin: '0.1rem 0.05rem 0.4rem' }}>
        {TX_FILT.map((p) => (
          <button
            key={p}
            type="button"
            className={f === p ? 'sopPill2 sopPill2--on' : 'sopPill2'}
            onClick={() => setF(p)}
            aria-pressed={f === p}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="sopTwrap">
        <table className="sopTable" style={{ minWidth: 700 }} aria-label="Transactions">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Order ID</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="admDim" style={{ padding: '1rem' }}>
                  Loading transactions…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="admDim" style={{ padding: '1rem' }}>
                  No transactions in this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td style={{ fontSize: '0.7rem' }}>{formatDt(r.date)}</td>
                  <td>{r.customer}</td>
                  <td>{r.order !== '—' ? <span className="sopLink2">{r.order}</span> : r.order}</td>
                  <td>
                    {r.type === 'Refund' || r.type === 'Payout' ? <span style={{ color: '#c62828' }}>−</span> : '+'}
                    {formatGBP(r.amount)}
                  </td>
                  <td>
                    <span className={typeBdg(r.type)}>{r.type}</span>
                  </td>
                  <td>
                    <span className={stBdg(r.st)}>{r.st}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="sopInv" style={{ marginTop: 12 }}>
        <h2 className="sopSecH" style={{ border: 'none', marginBottom: 8, padding: 0 }}>
          Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="admDim" style={{ margin: 0, padding: '0.5rem 0.2rem' }}>
            No paid payout invoices yet.
          </p>
        ) : invoices.map((inv) => (
          <div key={inv.num} className="sopInvRow">
            <div>
              <a href="#inv" onClick={(e) => e.preventDefault()} className="sopLink2" style={{ display: 'block' }}>
                {inv.num}
              </a>
              <span style={{ color: '#888', fontSize: '0.72rem' }}>{inv.date} · {inv.orders} orders</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800 }}>{formatGBP(inv.amount)}</span>
              <span className="sopBdg sopBdg--d">Paid</span>
              <button type="button" className="sopPicon sopPicon--g" style={{ color: '#F18631' }} aria-label="Download PDF">
                <IcPdf />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
