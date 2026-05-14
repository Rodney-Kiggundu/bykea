import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCompletedDeliveriesForDriver,
  isCodDriverCompletedJob,
} from '../lib/driverIncomingBookings';
import { formatGBP } from '../lib/currency';
import { DRIVER_SECURITY_DEPOSIT_MIN_GBP } from '../lib/driverDepositGate';
import { getDriverSession } from '../lib/driverSession';
import { fetchPlatformCommissionSettings } from '../lib/platformCommissionSettings';
import { postLocalPaynowInitiate, resolveShopPaynowLocalInitiateUrl } from '../lib/shopPaynowLocal';
import {
  isStripePaymentsConfigured,
  setStripeHostedReturnContext,
  stripeHostedCheckoutRedirect,
} from '../lib/stripeEdge';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './driverEarningsWalletProfile.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'earn', label: 'Earnings' },
  { id: 'w', label: 'Withdrawals' },
];

function IcInfo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.2" stroke="#F18631" strokeWidth="1.4" fill="none" />
      <path d="M12 10.2V16M12 7.2v.1" stroke="#F18631" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function ArEarning() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M12 19V6M8 9l4-3 4 3"
        fill="none"
        stroke="#A85612"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ArWithdraw() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M5 12h14M15 7l4 5-4 5" fill="none" stroke="#1565c0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArCashOut() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path
        d="M12 3v18M7.5 8.5 12 4l4.5 4.5"
        stroke="#b45309"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5" y="14" width="14" height="6" rx="1.2" stroke="#b45309" strokeWidth="1.4" />
    </svg>
  );
}

const DEPOSIT_TOPUP_GBP = DRIVER_SECURITY_DEPOSIT_MIN_GBP;

function driverDepositPaynowRef(topupId) {
  const s = String(topupId || '').replace(/-/g, '');
  return `ING-DEP-${s.slice(0, 10).toUpperCase()}`;
}

export default function DriverWalletPage() {
  const [filter, setFilter] = useState('all');
  const [amount, setAmount] = useState('');
  const [jobs, setJobs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [commissionPct, setCommissionPct] = useState(0);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [depositRows, setDepositRows] = useState([]);
  const [depositLive, setDepositLive] = useState(0);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositErr, setDepositErr] = useState('');

  const paynowAvailable = useMemo(() => !!resolveShopPaynowLocalInitiateUrl(), []);
  const stripeAvailable = useMemo(() => isStripePaymentsConfigured(), []);
  /** @type {'paynow' | 'stripe'} */
  const [depositPayMethod, setDepositPayMethod] = useState('paynow');

  const driverId = getDriverSession()?.id || null;

  const refresh = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured || !supabase) {
      setJobs([]);
      setWithdrawals([]);
      setDepositRows([]);
      setDepositLive(0);
      return;
    }
    const doneRows = await fetchCompletedDeliveriesForDriver(supabase, driverId);
    setJobs(doneRows || []);
    const { data } = await supabase
      .from('driver_withdrawal_requests')
      .select('*')
      .eq('driver_id', driverId)
      .order('requested_at', { ascending: false });
    setWithdrawals(data || []);
    const { data: tops, error: topErr } = await supabase
      .from('driver_wallet_topups')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    if (!topErr && Array.isArray(tops)) setDepositRows(tops);
    else setDepositRows([]);

    const { data: drvBal, error: balErr } = await supabase
      .from('driver_registrations')
      .select('driver_deposit_balance_gbp')
      .eq('id', driverId)
      .maybeSingle();
    const paidFallback = (tops || [])
      .filter((r) => String(r.payment_status || '').toLowerCase() === 'paid')
      .reduce((s, r) => s + (Number(r.amount_gbp) || 0), 0);
    if (!balErr && drvBal && drvBal.driver_deposit_balance_gbp != null) {
      setDepositLive(Number(drvBal.driver_deposit_balance_gbp) || 0);
    } else {
      setDepositLive(paidFallback);
    }
  }, [driverId]);

  useEffect(() => {
    let cancelled = false;
    if (!driverId || !isSupabaseConfigured || !supabase) return undefined;
    (async () => {
      const { data } = await fetchPlatformCommissionSettings(supabase);
      if (cancelled) return;
      const p = Number(data?.driver_commission_percent);
      setCommissionPct(Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (paynowAvailable && stripeAvailable) {
      setDepositPayMethod((m) => (m === 'stripe' || m === 'paynow' ? m : 'paynow'));
    } else if (paynowAvailable) setDepositPayMethod('paynow');
    else if (stripeAvailable) setDepositPayMethod('stripe');
  }, [paynowAvailable, stripeAvailable]);

  const gross = useMemo(() => jobs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [jobs]);
  const codCollectedTotal = useMemo(
    () => jobs.filter(isCodDriverCompletedJob).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [jobs],
  );
  const commission = Math.round(gross * (commissionPct / 100) * 100) / 100;
  const net = Math.round((gross - commission) * 100) / 100;
  const locked = useMemo(
    () =>
      withdrawals
        .filter((w) => {
          const s = String(w.status || '').toLowerCase();
          return s === 'pending' || s === 'approved' || s === 'paid';
        })
        .reduce((s, w) => s + (Number(w.amount) || 0), 0),
    [withdrawals],
  );

  const walletBalance = Math.max(0, Math.round((net - locked - codCollectedTotal) * 100) / 100);
  const deposit = depositLive;
  const minDeposit = DRIVER_SECURITY_DEPOSIT_MIN_GBP;
  const low = deposit < minDeposit;
  const balStr = formatGBP(walletBalance);

  const txList = useMemo(() => {
    const out = [];
    for (const r of jobs) {
      const amt = Number(r.amount) || 0;
      const when = r.at;
      if (isCodDriverCompletedJob(r)) {
        out.push({
          id: `cod-${r.id}`,
          type: 'cod',
          title: `Cash on delivery · ${r.ref}`,
          date: when,
          amount: `-${formatGBP(amt)}`,
        });
      } else {
        out.push({
          id: `e-${r.id}`,
          type: 'earn',
          title: `Completed #${r.ref}`,
          date: when,
          amount: `+${formatGBP(amt)}`,
        });
      }
    }
    for (const w of withdrawals) {
      const st = String(w.status || '').toLowerCase();
      const suffix = st ? ` · ${st}` : '';
      out.push({
        id: `w-${w.id}`,
        type: 'w',
        title: `Withdrawal request${suffix}`,
        date: w.requested_at || w.approved_at || w.paid_at,
        amount: `-${formatGBP(Number(w.amount) || 0)}`,
      });
    }
    for (const d of depositRows) {
      const st = String(d.payment_status || '').toLowerCase();
      const amt = Number(d.amount_gbp) || 0;
      const ref = d.paynow_reference ? String(d.paynow_reference) : 'Deposit';
      out.push({
        id: `dep-${d.id}`,
        type: 'dep',
        title: st === 'paid' ? `Deposit paid · ${ref}` : `Deposit · ${st}`,
        date: d.payment_completed_at || d.payment_started_at || d.created_at,
        amount: st === 'paid' ? `+${formatGBP(amt)}` : `${formatGBP(amt)} · pending`,
      });
    }
    out.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return out;
  }, [jobs, withdrawals, depositRows]);

  const list = txList.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'earn') return t.type === 'earn' || t.type === 'dep';
    if (filter === 'w') return t.type === 'w' || t.type === 'cod';
    return true;
  });

  const submitWithdrawal = async () => {
    setErr('');
    setMsg('');
    if (!driverId || !isSupabaseConfigured || !supabase) {
      setErr('Supabase is not configured.');
      return;
    }
    const n = Number(String(amount).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter a valid amount.');
      return;
    }
    if (n > walletBalance) {
      setErr('Amount exceeds available wallet balance.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('driver_withdrawal_requests').insert({
      driver_id: driverId,
      amount: Math.round(n * 100) / 100,
      status: 'pending',
    });
    setBusy(false);
    if (error) {
      setErr(error.message || 'Could not send request.');
      return;
    }
    setAmount('');
    setMsg('Request sent to admin.');
    await refresh();
  };

  const runDepositTopup = async () => {
    setDepositErr('');
    const driver = getDriverSession();
    if (!driverId || !driver || !isSupabaseConfigured || !supabase) {
      setDepositErr('Sign in and connect Supabase to top up.');
      return;
    }
    const usePaynow = depositPayMethod === 'paynow';
    if (usePaynow && !paynowAvailable) {
      setDepositErr(
        'Paynow is not configured. Set REACT_APP_SHOP_PAYNOW_LOCAL_URL in .env.local, run `cd server && npm start` with Paynow env vars, then restart the app.',
      );
      return;
    }
    if (!usePaynow && !stripeAvailable) {
      setDepositErr(
        'Card top-up needs the app configured for card payments (Supabase and publishable card key).',
      );
      return;
    }

    setDepositBusy(true);
    const { data: row, error: insErr } = await supabase
      .from('driver_wallet_topups')
      .insert({
        driver_id: driverId,
        amount_gbp: DEPOSIT_TOPUP_GBP,
        currency: 'GBP',
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (insErr || !row?.id) {
      setDepositBusy(false);
      setDepositErr(
        insErr?.message?.includes('driver_wallet_topups')
          ? `${insErr.message} — Run supabase/driver_wallet_topups.sql in the SQL editor.`
          : insErr?.message || 'Could not start deposit.',
      );
      return;
    }

    const topupId = row.id;

    if (usePaynow) {
      const orderNumber = driverDepositPaynowRef(topupId);
      const payRes = await postLocalPaynowInitiate({
        orderKind: 'driver_deposit',
        orderNumber,
        orderId: topupId,
        amount: DEPOSIT_TOPUP_GBP,
        customerEmail: driver.email != null ? String(driver.email) : '',
        customerPhone: driver.phone != null ? String(driver.phone) : '',
        customerName: String(driver.full_name || '')
          .trim()
          .slice(0, 120) || 'Driver',
      });

      if (!payRes.ok || !payRes.redirectUrl) {
        await supabase.from('driver_wallet_topups').delete().eq('id', topupId);
        setDepositErr(payRes.error || 'Could not open Paynow.');
        setDepositBusy(false);
        return;
      }

      window.location.href = payRes.redirectUrl;
      return;
    }

    setStripeHostedReturnContext({ flow: 'driver_wallet' });
    const go = await stripeHostedCheckoutRedirect({
      orderKind: 'driver_deposit',
      orderId: topupId,
      cancelPath: '/stripe-cancel',
    });
    if (!go.ok) {
      await supabase.from('driver_wallet_topups').delete().eq('id', topupId);
      setDepositErr(go.error || 'Could not start card checkout.');
    }
    setDepositBusy(false);
  };

  return (
    <div className="dvRoot" role="main">
      <header className="dvH">
        <h1>My Wallet</h1>
        <span style={{ width: 36 }} />
      </header>
      <div className="dvSc">
        <section className="dwb" aria-label="Wallet balance">
          <p className="dwbL1">Wallet Balance</p>
          <p className="dwbMain">{balStr}</p>
          {codCollectedTotal > 0 ? (
            <p className="dwbCodNote" role="note">
              Cash deliveries: {formatGBP(codCollectedTotal)} taken in cash — deducted from wallet balance.
            </p>
          ) : null}
          <p className="dwbL2">Deposit balance</p>
          <p className="dwbSubAmt">{formatGBP(deposit)}</p>
          <p className="dwbL2" style={{ fontSize: '0.62rem', opacity: 0.88, marginBottom: '0.35rem' }}>
            (commission deducted from this)
          </p>
          {depositErr ? (
            <p style={{ margin: '0 0 0.4rem', color: '#fff', fontSize: '0.72rem', fontWeight: 700, opacity: 0.95 }} role="alert">
              {depositErr}
            </p>
          ) : null}
          <div className="dwb2Stack">
            {paynowAvailable || stripeAvailable ? (
              <>
                {paynowAvailable && stripeAvailable ? (
                  <fieldset className="dwbPayFs dwbPayFs--lightOnDark">
                    <legend className="dwbPayLeg">Payment method</legend>
                    <label className="dwbPayOpt">
                      <input
                        type="radio"
                        name="drvDepPay"
                        checked={depositPayMethod === 'paynow'}
                        onChange={() => setDepositPayMethod('paynow')}
                      />
                      <span>Pay now (Paynow — EcoCash, card, or other enabled methods)</span>
                    </label>
                    <label className="dwbPayOpt">
                      <input
                        type="radio"
                        name="drvDepPay"
                        checked={depositPayMethod === 'stripe'}
                        onChange={() => setDepositPayMethod('stripe')}
                      />
                      <span>Card</span>
                    </label>
                  </fieldset>
                ) : null}
                <button type="button" className="dwbO" disabled={depositBusy} onClick={runDepositTopup}>
                  {depositBusy ? 'Starting…' : `Top Up Deposit (${formatGBP(DEPOSIT_TOPUP_GBP)})`}
                </button>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, opacity: 0.95 }}>
                Configure Paynow (local server URL) or card payments to top up your deposit.
              </p>
            )}
          </div>
        </section>

        <div className="dwi" role="status">
          <span style={{ lineHeight: 0, flexShrink: 0 }} aria-hidden>
            <IcInfo />
          </span>
          <div>
            <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.35 }}>
              Your deposit balance is used to cover platform commissions.
            </p>
            <p className="dwiB">Minimum balance: {formatGBP(minDeposit)}</p>
          </div>
        </div>

        <p
          style={{
            margin: '0.55rem 0.55rem 0.35rem',
            fontSize: '0.72rem',
            lineHeight: 1.4,
            color: '#5c524c',
          }}
        >
          Wallet balance: card / online-paid jobs add here; cash-on-delivery amounts are deducted here. Each completed job
          charges the platform commission percentage against your <strong>security deposit</strong> below — when it falls
          below {formatGBP(minDeposit)} you must top up before accepting new work.
        </p>

        {low && (
          <div className="dwiLow" role="alert">
            <span className="dwiBdg">Low balance</span>
            <p>Your deposit is below the minimum. Top up to keep accepting orders.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', flex: '1 1 100%' }}>
              {paynowAvailable || stripeAvailable ? (
                <>
                  {paynowAvailable && stripeAvailable ? (
                    <fieldset className="dwbPayFs dwbPayFs--onLight">
                      <legend className="dwbPayLeg">Payment method</legend>
                      <label className="dwbPayOpt">
                        <input
                          type="radio"
                          name="drvDepPayLow"
                          checked={depositPayMethod === 'paynow'}
                          onChange={() => setDepositPayMethod('paynow')}
                        />
                        <span>Pay now (Paynow)</span>
                      </label>
                      <label className="dwbPayOpt">
                        <input
                          type="radio"
                          name="drvDepPayLow"
                          checked={depositPayMethod === 'stripe'}
                          onChange={() => setDepositPayMethod('stripe')}
                        />
                        <span>Card</span>
                      </label>
                    </fieldset>
                  ) : null}
                  <button type="button" disabled={depositBusy} onClick={runDepositTopup} style={{ width: '100%' }}>
                    {depositBusy ? 'Starting…' : `Top Up Now (${formatGBP(DEPOSIT_TOPUP_GBP)})`}
                  </button>
                </>
              ) : (
                <button type="button" disabled style={{ width: '100%', opacity: 0.65 }}>
                  Top-up unavailable (configure Paynow or card)
                </button>
              )}
            </div>
          </div>
        )}

        <section className="dww" aria-label="Withdraw funds">
          <label htmlFor="wd-amt" className="dwwT" style={{ marginTop: '0.25rem' }}>
            Amount
          </label>
          <input
            id="wd-amt"
            className="dv-inp2"
            inputMode="decimal"
            placeholder="£0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          <div className="dvRowL">
            <span />
            <button
              type="button"
              className="dwwC"
              style={{ fontSize: '0.78rem' }}
              onClick={() => setAmount(String(walletBalance.toFixed(2)))}
            >
              Withdraw All
            </button>
          </div>
          <button type="button" className="dvBtn1" disabled={busy} onClick={submitWithdrawal}>
            {busy ? 'Sending...' : 'Withdraw Funds'}
          </button>
          {msg ? <p style={{ margin: '0.4rem 0 0', color: '#0d5c2f', fontSize: '0.82rem', fontWeight: 700 }}>{msg}</p> : null}
          {err ? <p style={{ margin: '0.4rem 0 0', color: '#b42318', fontSize: '0.82rem', fontWeight: 700 }}>{err}</p> : null}
          <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#666' }}>
            Requested amount is excluded from available balance immediately.
          </div>
        </section>

        <h2 className="dvRsec" style={{ marginTop: '0.35rem' }}>
          Transactions
        </h2>
        <div className="dvPills" role="tablist" aria-label="Transaction type">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              className={filter === f.id ? 'dvPil dvPil--on' : 'dvPil'}
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {list.map((t) => (
          <div className="dvTxR" key={t.id}>
            <div className="dvAr" aria-hidden>
              {t.type === 'earn' && <ArEarning />}
              {t.type === 'dep' && <ArEarning />}
              {t.type === 'w' && <ArWithdraw />}
              {t.type === 'cod' && <ArCashOut />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dvTxx">{t.title}</div>
              <span className="dvTdt">{t.date ? new Date(t.date).toLocaleString() : '—'}</span>
            </div>
            <div
              className={
                t.type === 'earn' || t.type === 'dep'
                  ? 'dvTamt dvTamtE'
                  : t.type === 'cod'
                    ? 'dvTamt dvTamtC'
                    : 'dvTamt dvTamtW'
              }
            >
              {t.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
