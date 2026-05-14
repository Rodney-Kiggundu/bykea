import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { mapDriverRegistrationRow } from '../lib/customerOrderFeed';
import { formatGBP } from '../lib/currency';
import { readShopOrderConfirmationState } from '../lib/shopOrderConfirmationSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './orderTracking.css';

const DRIVER = {
  name: 'Zain Ahmed',
  vehicle: 'Honda 125',
  plate: 'AB19 CDE',
};

function formatPlacedAt(iso) {
  try {
    if (!iso) return new Date().toLocaleString();
    return new Date(iso).toLocaleString();
  } catch {
    return new Date().toLocaleString();
  }
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M6.5 1C5.1 1 4 2.1 4 3.5v17C4 21.9 5.1 23 6.5 23h11c1.4 0 2.5-1.1 2.5-2.5v-17C20 2.1 18.9 1 17.5 1h-11Z" fill="currentColor" opacity="0.2" />
      <path
        d="M12.5 18.3a.8.8 0 0 0-.1.2.8.8 0 0 0 1.3.3.8.8 0 0 0 0-1.1.8.8 0 0 0-1.2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7l-3 2.5V5a1 1 0 0 1 1-1Z"
        fill="currentColor"
        fillOpacity="0.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatOrderId(id) {
  if (!id) return '#ING-00234';
  const s = String(id).replace(/^#/, '');
  return s.startsWith('ING') ? `#${s}` : `#ING-${s}`;
}

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const order = useMemo(() => readShopOrderConfirmationState(location.state), [location.state]);

  useLayoutEffect(() => {
    if (order.source !== 'ride' || !order.taxiBookingId) return;
    navigate('/live-tracking', {
      replace: true,
      state: {
        mode: order.mode || 'taxi',
        pickup: order.pickup,
        stops: order.stops,
        rideType: order.rideType,
        distanceKm: order.distanceKm,
        quotedPrice: order.quotedPrice,
        taxiBookingId: order.taxiBookingId,
        bookingStorageTable: order.bookingStorageTable || 'taxi_bookings',
        payment_method: order.payment_method || 'card',
        eta: order.eta,
      },
    });
  }, [order, navigate]);

  const orderId = formatOrderId(order.orderId != null ? String(order.orderId) : '');
  const placedAt = useMemo(
    () => order.placedAt || new Date().toISOString(),
    [order.placedAt],
  );
  const from = order.from || 'Stratford, London E15';
  const to = order.to || 'Oxford Street, London W1';
  const deliveryType = order.deliveryTitle || 'Delivery';
  const eta = order.eta || '45 - 60 mins';
  const price =
    order.priceLabel ||
    (typeof order.priceNum === 'number' ? formatGBP(order.priceNum) : formatGBP(2.5));

  const customer = order.customer;
  const isShopOrder = order.source === 'shop';
  const isRidePaynowReturn =
    order.source === 'ride' && order.taxiBookingId != null && String(order.taxiBookingId).trim() !== '';

  const deliveryUuid = useMemo(() => {
    if (isShopOrder) return null;
    const id = order.supabaseOrderId;
    if (id == null || String(id).trim() === '') return null;
    return String(id).trim();
  }, [isShopOrder, order.supabaseOrderId]);

  const [liveDriverRow, setLiveDriverRow] = useState(null);

  useEffect(() => {
    if (!deliveryUuid || !isSupabaseConfigured || !supabase) {
      setLiveDriverRow(null);
      return undefined;
    }
    let cancelled = false;
    const fetchDriver = async () => {
      try {
        const { data: row, error } = await supabase
          .from('customer_delivery_orders')
          .select('assigned_driver_id')
          .eq('id', deliveryUuid)
          .maybeSingle();
        if (cancelled || error) return;
        const aid = row?.assigned_driver_id;
        if (!aid) {
          if (!cancelled) setLiveDriverRow(null);
          return;
        }
        const { data: d, error: de } = await supabase
          .from('driver_registrations')
          .select('id, full_name, phone, phone_country_code, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, vehicle_color')
          .eq('id', aid)
          .maybeSingle();
        if (cancelled) return;
        if (!de && d) setLiveDriverRow(d);
        else setLiveDriverRow(null);
      } catch {
        if (!cancelled) setLiveDriverRow(null);
      }
    };
    fetchDriver();
    const timer = window.setInterval(fetchDriver, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deliveryUuid]);

  const assignedDriverUi = useMemo(
    () => (liveDriverRow ? mapDriverRegistrationRow(liveDriverRow) : null),
    [liveDriverRow],
  );

  if (isRidePaynowReturn) {
    return (
      <div className="oc-page" role="status" aria-live="polite" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#333' }}>Opening live tracking…</p>
      </div>
    );
  }

  return (
    <div className="oc-page" role="main" aria-label="Order confirmation">
      <div className="oc-hero">
        <div className="oc-check" aria-hidden>
          <div className="oc-check__ring" />
          <div className="oc-check__svg" style={{ position: 'relative' }}>
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden>
              <path
                className="oc-check__path"
                d="M7 16l5 5 12-12"
                stroke="white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                strokeDasharray="28"
                strokeDashoffset="28"
              />
            </svg>
          </div>
        </div>
        <h1 className="oc-title">Order Placed!</h1>
        <p className="oc-sub">{isShopOrder ? 'Your shop order is confirmed' : 'Your delivery is confirmed'}</p>
      </div>

      <div className="oc-content">
        <section className="oc-card" aria-label="Order details">
          <div className="oc-card__id">
            <code>Order ID: {orderId}</code>
            <span className="oc-card__dt">{formatPlacedAt(placedAt)}</span>
          </div>
          <div className="oc-route">
            <div className="oc-route__line" />
            <div className="oc-route__row">
              <span className="oc-dot oc-dot--g" />
              From: {from}
            </div>
            <div className="oc-route__row">
              <span className="oc-dot oc-dot--r" />
              To: {to}
            </div>
          </div>
          <p style={{ margin: '0.35rem 0 0.2rem' }}>
            <span className="oc-badge">{deliveryType}</span>
          </p>
          <div className="oc-meta">
            <span>Estimated arrival</span>
            <span>{eta}</span>
          </div>
          <p className="oc-total">Total paid: {price}</p>
        </section>

        {customer && (
          <section className="oc-card oc-card--cust" aria-label={isShopOrder ? 'Your contact details' : 'Delivery contact'}>
            <h2 className="oc-custH">{isShopOrder ? 'Your details' : 'Delivering to'}</h2>
            <p className="oc-custN">{customer.fullName}</p>
            <p className="oc-custM">{customer.phone}</p>
            {customer.email ? <p className="oc-custM">{customer.email}</p> : null}
            <p className="oc-custAddr">{customer.address}</p>
            {customer.notes ? (
              <p className="oc-custNotes">
                <strong>Notes:</strong> {customer.notes}
              </p>
            ) : null}
          </section>
        )}

        {!isShopOrder ? (
          <section className="oc-dcard" aria-label="Driver assignment">
            <div className="oc-dhead" style={{ width: '100%' }}>
              <div className="oc-avatar" aria-hidden />
              <div className="oc-dtext">
                {assignedDriverUi ? (
                  <>
                    <p className="oc-dname">{assignedDriverUi.name}</p>
                    <div className="oc-stars" role="img" aria-label="Rated driver">
                      ★★★★★
                    </div>
                    <p className="oc-veh">
                      {assignedDriverUi.vehicle} · {assignedDriverUi.plate}
                    </p>
                  </>
                ) : deliveryUuid ? (
                  <>
                    <p className="oc-dname">Finding a driver…</p>
                    <p className="oc-veh" style={{ fontStyle: 'normal', color: '#666', fontSize: '0.78rem' }}>
                      Driver details appear here once a driver accepts your delivery.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="oc-dname">{DRIVER.name}</p>
                    <div className="oc-stars" role="img" aria-label="4.8 out of 5">
                      ★★★★★
                    </div>
                    <p className="oc-veh">
                      {DRIVER.vehicle} · {DRIVER.plate}
                    </p>
                  </>
                )}
              </div>
              {assignedDriverUi ? (
                <div className="oc-dactions">
                  <a
                    className="oc-icon-btn"
                    href={
                      assignedDriverUi.phone && assignedDriverUi.phone !== '—'
                        ? `tel:${String(assignedDriverUi.phone).replace(/[^\d+]/g, '')}`
                        : '#'
                    }
                    onClick={(e) => {
                      if (!assignedDriverUi.phone || assignedDriverUi.phone === '—') e.preventDefault();
                    }}
                    aria-label="Call driver"
                    style={
                      !assignedDriverUi.phone || assignedDriverUi.phone === '—'
                        ? { pointerEvents: 'none', opacity: 0.45 }
                        : undefined
                    }
                  >
                    <PhoneIcon />
                  </a>
                  <Link className="oc-icon-btn" to="/chat" state={{ name: assignedDriverUi.name, role: 'customer' }} aria-label="Message driver">
                    <ChatIcon />
                  </Link>
                </div>
              ) : !deliveryUuid ? (
                <div className="oc-dactions">
                  <button type="button" className="oc-icon-btn" aria-label="Call driver" onClick={() => {}}>
                    <PhoneIcon />
                  </button>
                  <button type="button" className="oc-icon-btn" aria-label="Message driver" onClick={() => {}}>
                    <ChatIcon />
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="oc-actions">
          {isShopOrder ? (
            <Link to="/shops" className="oc-btn--primary" replace>
              Continue shopping
            </Link>
          ) : null}
          <Link to="/home" className="oc-btn--outline" replace>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
