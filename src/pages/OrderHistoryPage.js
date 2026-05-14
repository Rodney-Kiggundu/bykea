import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomerUnifiedOrders } from '../lib/customerOrderFeed';
import { getCustomerSession } from '../lib/customerSession';
import { filterOrders, statusLabel } from '../data/mockOrders';
import './customerAccount.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

function badgeClass(status) {
  if (status === 'delivered') return 'oh-badg oh-badg--d';
  if (status === 'transit') return 'oh-badg oh-badg--t';
  if (status === 'cancelled') return 'oh-badg oh-badg--c';
  if (status === 'active') return 'oh-badg oh-badg--a';
  return 'oh-badg oh-badg--a';
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M21 21v-5h-5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [liveOrders, setLiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const session = getCustomerSession();
    const { orders, error } = await fetchCustomerUnifiedOrders(session);
    setLiveOrders(orders);
    if (error) setLoadError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load();
    }, 40000);
    return () => window.clearInterval(id);
  }, [load]);

  const list = useMemo(() => filterOrders(liveOrders, filter), [liveOrders, filter]);

  const onReorder = useCallback(
    (e, kind) => {
      e.stopPropagation();
      e.preventDefault();
      if (kind === 'shop') navigate('/shops');
      else if (kind === 'taxi' || kind === 'tuk') navigate('/home');
      else navigate('/request-delivery');
    },
    [navigate],
  );

  return (
    <div className="cust cust--scroll">
      <div className="cust__scroll">
        <header className="oh-top">
          <h1>My Orders</h1>
          <button type="button" className="oh-filter-btn" aria-label="Refresh orders" title="Refresh" onClick={() => load()} disabled={loading}>
            <RefreshIcon />
          </button>
        </header>

        {loadError ? (
          <p className="oh-empty" role="alert" style={{ color: '#b42318', fontWeight: 600 }}>
            {loadError}
          </p>
        ) : null}

        <div className="oh-tabs" role="tablist" aria-label="Order status">
          {FILTERS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              className={filter === t.id ? 'oh-pill oh-pill--on' : 'oh-pill'}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="oh-list">
          {loading ? (
            <p className="oh-empty">Loading your orders…</p>
          ) : list.length === 0 ? (
            <p className="oh-empty">
              {liveOrders.length === 0
                ? 'No orders yet. Book delivery, taxi, tuk-tuk, or shop — they will show here when linked to your account.'
                : 'No orders in this list.'}
            </p>
          ) : (
            list.map((o) => (
              <div
                key={o.navKey}
                className="oh-card"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/order/${encodeURIComponent(o.navKey)}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/order/${encodeURIComponent(o.navKey)}`);
                  }
                }}
              >
                <div className="oh-card__top">
                  <h2 className="oh-card__id">{o.id}</h2>
                  <span className={badgeClass(o.status)}>{o.statusText ?? statusLabel(o.status)}</span>
                </div>
                {o.subtitle ? (
                  <p style={{ margin: '0.15rem 0 0.25rem', fontSize: '0.72rem', color: '#888', fontWeight: 600 }}>{o.subtitle}</p>
                ) : null}
                <div className="oh-addr">
                  <span className="oh-addr--line" aria-hidden />
                  <span className="oh-dot oh-dot--g" aria-hidden />
                  {o.from}
                </div>
                <div className="oh-addr" style={{ marginTop: 2 }}>
                  <span className="oh-dot oh-dot--r" aria-hidden />
                  {o.to}
                </div>
                {o.driver ? (
                  <div
                    className="oh-driver"
                    style={{
                      marginTop: '0.45rem',
                      padding: '0.5rem 0.55rem',
                      background: 'linear-gradient(135deg, #f0fdf4, #fff8f0)',
                      borderRadius: 10,
                      border: '1px solid #e8efe9',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 800, color: '#166534', letterSpacing: '0.04em' }}>
                      YOUR DRIVER
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', fontWeight: 800 }}>{o.driver.name}</p>
                    <p style={{ margin: '0.08rem 0 0', fontSize: '0.78rem', color: '#444' }}>{o.driver.phone}</p>
                    <p style={{ margin: '0.12rem 0 0', fontSize: '0.72rem', color: '#555' }}>
                      {o.driver.vehicle} · {o.driver.plate}
                    </p>
                  </div>
                ) : null}
                <div className="oh-btm">
                  <span className="oh-date">{o.date}</span>
                  <div className="oh-btmR">
                    <span className="oh-pr">{o.price}</span>
                    <button type="button" className="oh-reorder" onClick={(e) => onReorder(e, o.kind)}>
                      Book again
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
