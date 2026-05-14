import { useCallback, useMemo, useState } from 'react';
import './chatNotifyRating.css';

const MOCK = [
  {
    id: '1',
    group: 'today',
    time: '9:41 AM',
    title: 'Your order has been picked up',
    sub: 'En route to your drop-off address',
    type: 'delivery',
    read: false,
  },
  {
    id: '2',
    group: 'today',
    time: '8:15 AM',
    title: 'Driver is 2 mins away',
    sub: 'Please be ready at the pickup point',
    type: 'delivery',
    read: false,
  },
  {
    id: '3',
    group: 'today',
    time: '7:50 AM',
    title: 'Payment of £2.50 confirmed',
    sub: 'Thank you for your payment',
    type: 'payment',
    read: true,
  },
  {
    id: '4',
    group: 'yesterday',
    time: '4:20 PM',
    title: 'Get 20% off your next delivery!',
    sub: 'Use code INGO20 at checkout',
    type: 'promo',
    read: true,
  },
  {
    id: '5',
    group: 'yesterday',
    time: '2:10 PM',
    title: 'Order #ING-00234 delivered',
    sub: 'How was your experience? Tap to rate',
    type: 'delivery',
    read: true,
  },
  {
    id: '6',
    group: 'yesterday',
    time: '10:00 AM',
    title: 'Order #ING-00099 cancelled',
    sub: 'Your payment was refunded to your wallet',
    type: 'cancel',
    read: true,
  },
];

const TYPE = {
  delivery: { bg: '#F18631', abbr: '●' },
  promo: { bg: '#1976d2', abbr: '★' },
  payment: { bg: '#e67e22', abbr: '£' },
  cancel: { bg: '#c62828', abbr: '×' },
};

function BellEmpty() {
  return (
    <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path
        d="M12 3a4.5 4.5 0 0 0-4.5 4.5V10l-1.2 2.4A1 1 0 0 0 7.2 14h9.6a1 1 0 0 0 .9-1.6L17 10V7.5A4.5 4.5 0 0 0 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M10.5 18a1.5 1.5 0 0 0 3 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

const GROUP_LABEL = { today: 'Today', yesterday: 'Yesterday' };

export default function NotificationsPage() {
  const [items, setItems] = useState(MOCK);

  const markAllRead = useCallback(() => {
    setItems((list) => list.map((i) => ({ ...i, read: true })));
  }, []);

  const grouped = useMemo(() => {
    const o = { today: [], yesterday: [] };
    for (const n of items) {
      if (n.group === 'today') o.today.push(n);
      if (n.group === 'yesterday') o.yesterday.push(n);
    }
    return o;
  }, [items]);

  return (
    <div className="ingNtf" role="main" aria-label="Notifications">
      <header className="ingNtf__head">
        <h1 className="ingNtf__h1">Notifications</h1>
        {items.length > 0 && (
          <button type="button" className="ingNtf__mark" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </header>
      <div className="ingNtf__sc">
        {items.length === 0 ? (
          <div className="ingNtf__empty">
            <div className="ingNtf__eIco" aria-hidden>
              <BellEmpty />
            </div>
            <p className="ingNtf__eT">No notifications yet</p>
            <p className="ingNtf__eS">We will notify you about your orders and offers</p>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <>
                <h2 className="ingNtf__g">{GROUP_LABEL.today}</h2>
                {grouped.today.map((n) => (
                  <NotifRow key={n.id} n={n} />
                ))}
              </>
            )}
            {grouped.yesterday.length > 0 && (
              <>
                <h2 className="ingNtf__g">{GROUP_LABEL.yesterday}</h2>
                {grouped.yesterday.map((n) => (
                  <NotifRow key={n.id} n={n} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotifRow({ n }) {
  const st = TYPE[n.type] || TYPE.delivery;
  return (
    <div
      className={!n.read ? 'ingNtf__row ingNtf__row--u' : 'ingNtf__row'}
      role="article"
    >
      <div
        className="ingNtf__ico"
        style={{ background: st.bg }}
        aria-hidden
      >
        {st.abbr}
      </div>
      <div className="ingNtf__m">
        <h3 className="ingNtf__t">{n.title}</h3>
        <p className="ingNtf__s">{n.sub}</p>
      </div>
      <time className="ingNtf__time" dateTime={n.time}>
        {n.time}
      </time>
      {!n.read && <span className="ingNtf__uDot" aria-label="Unread" />}
    </div>
  );
}
