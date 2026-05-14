import { useMemo, useState } from 'react';
import './shopOwnerPortal.css';

const TABS = ['All', 'Needs rider', 'Assigned', 'Completed'];

const INITIAL = [
  {
    id: 'DR-2041',
    order: 'IG-90130',
    customer: 'Leo P.',
    drop: '10 Brick Lane, London E1',
    eta: '~25 min',
    status: 'Needs rider',
    driver: null,
  },
  {
    id: 'DR-2038',
    order: 'IG-90128',
    customer: 'Maya S.',
    drop: '88 Upper Street, London N1',
    eta: '~12 min',
    status: 'Assigned',
    driver: 'Bilal R.',
  },
  {
    id: 'DR-2035',
    order: 'IG-90124',
    customer: 'Sara Ali',
    drop: '22 Bloomsbury Way, London WC1A',
    eta: 'Delivered',
    status: 'Completed',
    driver: 'Ahmad Khan',
  },
  {
    id: 'DR-2029',
    order: 'IG-90088',
    customer: 'Omar K.',
    drop: '1 Pancras Square, London N1C',
    eta: '—',
    status: 'Needs rider',
    driver: null,
  },
];

function bdg(s) {
  const x = s.toLowerCase();
  if (x === 'completed') return 'sopBdg sopBdg--d';
  if (x === 'assigned') return 'sopBdg sopBdg--t';
  if (x === 'needs rider') return 'sopBdg sopBdg--p';
  return 'sopBdg sopBdg--p';
}

export default function ShopOwnerDeliveryRequestsPage() {
  const [tab, setTab] = useState('All');
  const [rows, setRows] = useState(INITIAL);

  const filtered = useMemo(() => {
    if (tab === 'All') return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const assignMock = (id) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id && r.status === 'Needs rider'
          ? { ...r, status: 'Assigned', driver: 'Next available rider', eta: '~18 min' }
          : r
      )
    );
  };

  return (
    <div className="sop">
      <div className="sopPageH">
        <h1>Delivery requests</h1>
        <span className="sopI2" style={{ fontSize: '0.75rem', color: '#555' }}>
          Rider matching is simulated in this demo.
        </span>
      </div>
      <div className="sopRow2" style={{ marginBottom: '0.65rem' }}>
        <div className="sopCard">
          <p className="sopClab">Awaiting rider</p>
          <p className="sopCval sopCval--o">{rows.filter((r) => r.status === 'Needs rider').length}</p>
        </div>
        <div className="sopCard">
          <p className="sopClab">Active deliveries</p>
          <p className="sopCval">{rows.filter((r) => r.status === 'Assigned').length}</p>
        </div>
      </div>
      <div className="sopTabs" role="tablist" aria-label="Filter requests">
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
      <div className="sopTwrap">
        <table className="sopTable">
          <thead>
            <tr>
              <th>Request</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Drop-off</th>
              <th>ETA</th>
              <th>Rider</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{r.id}</td>
                <td>{r.order}</td>
                <td>{r.customer}</td>
                <td>{r.drop}</td>
                <td>{r.eta}</td>
                <td>{r.driver || '—'}</td>
                <td>
                  <span className={bdg(r.status)}>{r.status}</span>
                </td>
                <td>
                  {r.status === 'Needs rider' ? (
                    <button type="button" className="sopBsm" onClick={() => assignMock(r.id)}>
                      Request rider
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: '#9e9e9e' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
