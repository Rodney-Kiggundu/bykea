import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DRIVER_ORDER } from '../data/driverOrderDefaults';
import { formatGBP } from '../lib/currency';
import './driverPortal.css';

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'history', label: 'History' },
];

/** Shapes merged with DEFAULT_DRIVER_ORDER on the active-delivery screen */
const ACTIVE = [
  {
    id: 'ING-00915',
    from: 'Green Valley Mart, Stratford, London E15',
    to: '22 Bloomsbury Way, London WC1A',
    dist: '2.1 km',
    eta: '8 min',
    distDrop: '4.0 km',
    etaDrop: '14 min',
    pkg: 'Shop',
    type: 'Groceries',
    size: 'Medium',
    amount: 4.5,
    customerName: 'Sara Ali',
    customerPhone: '+44 7700 111223',
    specialInstructions: 'Leave at reception if no answer.',
    lineStatus: 'En route to dropoff',
    lineTime: 'Updated 4:12 PM',
  },
  {
    id: 'ING-00918',
    from: 'Royal London Hospital, Whitechapel E1',
    to: 'Kings Cross Station, London N1C',
    dist: '0.8 km',
    eta: '4 min',
    distDrop: '5.2 km',
    etaDrop: '18 min',
    pkg: 'Small',
    type: 'Pharma',
    size: 'Small',
    amount: 2.75,
    customerName: 'Dr. Khan Clinic',
    customerPhone: '+44 7700 998877',
    specialInstructions: '',
    lineStatus: 'Heading to pickup',
    lineTime: 'Assigned 3:55 PM',
  },
];

const HISTORY = [
  { id: 'ING-00790', to: 'Shoreditch', amt: 2.1, st: 'Delivered', t: 'Today · 2:10 PM' },
  { id: 'ING-00765', to: 'Camden', amt: 1.5, st: 'Delivered', t: 'Today · 11:20 AM' },
  { id: 'ING-00720', to: 'Islington', amt: 2.8, st: 'Cancelled', t: 'Yesterday' },
  { id: 'ING-00688', to: 'Hackney', amt: 3.4, st: 'Delivered', t: 'Apr 28' },
  { id: 'ING-00640', to: 'Greenwich', amt: 5.0, st: 'Delivered', t: 'Apr 27' },
];

function statusClass(st) {
  if (st === 'Delivered') return 'dplOrdSt dplOrdSt--dn';
  if (st === 'Cancelled') return 'dplOrdSt dplOrdSt--cx';
  return 'dplOrdSt dplOrdSt--pu';
}

function lineStatusClass(label) {
  if (label.includes('pickup')) return 'dplOrdSt dplOrdSt--pu';
  if (label.includes('drop')) return 'dplOrdSt dplOrdSt--go';
  return 'dplOrdSt dplOrdSt--pu';
}

export default function DriverOrdersPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');

  const openActive = (row) => {
    const { lineStatus, lineTime, ...order } = row;
    navigate('/driver/active-delivery', { state: { order: { ...DEFAULT_DRIVER_ORDER, ...order } } });
  };

  const showEmptyActive = tab === 'active' && ACTIVE.length === 0;

  return (
    <div className="dpl" role="main" aria-label="Orders">
      <h1 className="dplH">Orders</h1>
      <p className="dplIntro">Active jobs and your recent delivery history.</p>
      <div className="dplTabs" role="tablist" aria-label="Order lists">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'dplTab dplTab--on' : 'dplTab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="dplBody">
        {tab === 'active' && (
          <>
            {showEmptyActive ? (
              <p className="dh__pEm" style={{ marginTop: '0.5rem' }}>
                No active deliveries. Go online on Home to receive offers.
              </p>
            ) : (
              ACTIVE.map((row) => (
                <div key={row.id} className="dplOrdCard dplOrdCard--act">
                  <div className="dplOrdTop">
                    <p className="dplOrdId">{row.id}</p>
                    <span className={lineStatusClass(row.lineStatus)}>{row.lineStatus}</span>
                  </div>
                  <div className="dh-addrL dh-addrN">{row.from}</div>
                  <div className="dh-addrL dh-addrR2">{row.to}</div>
                  <p className="dplOrdMeta">
                    {row.pkg}
                    {' · '}
                    {row.lineTime}
                  </p>
                  <div className="dh__row2" style={{ padding: '0.1rem 0 0.15rem 0' }}>
                    <div className="bL">
                      <span className="a1" style={{ fontSize: '0.72rem' }}>
                        Payout
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="a3" style={{ margin: 0 }}>{formatGBP(row.amount)}</p>
                    </div>
                  </div>
                  <button type="button" className="dplOrdGo" onClick={() => openActive(row)}>
                    Continue delivery
                  </button>
                </div>
              ))
            )}
          </>
        )}
        {tab === 'history' && (
          <>
            <h2 className="dh__secH" style={{ marginTop: 0 }}>
              Recent
            </h2>
            {HISTORY.map((r) => (
              <div key={r.id} className="dplOrdCard">
                <div className="dh__row2">
                  <div className="bL">
                    <span className="a1">{r.id}</span>
                    <p className="a2">{r.to}</p>
                    <span className={statusClass(r.st)} style={{ marginTop: 6, display: 'inline-block' }}>
                      {r.st}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                    <p className="a3" style={{ margin: '0 0 0.1rem' }}>{formatGBP(r.amt)}</p>
                    <p className="rT" style={{ margin: 0 }}>
                      {r.t}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
