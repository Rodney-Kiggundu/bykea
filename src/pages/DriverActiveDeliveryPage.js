import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GoogleMapEmbed from '../components/GoogleMapEmbed';
import { DEFAULT_DRIVER_ORDER } from '../data/driverOrderDefaults';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { formatGBP } from '../lib/currency';
import { fetchBookingCustomerContact } from '../lib/driverIncomingBookings';
import {
  publicDirectionsCoordsMapUrl,
  publicDirectionsMapUrl,
  publicPlaceMapUrl,
} from '../lib/googleMapsConfig';
import { forwardGeocodeAddress } from '../lib/reverseGeocode';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './driverDelivery.css';

function isDriverPackagePhotoSrc(v) {
  return typeof v === 'string' && v.trim().startsWith('data:image/');
}

function Back() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M15.5 19.5L8 12l7.5-7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
/** Filled handset — standard orientation (no extra rotate; reads clearly in a circle). */
function IcCall() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden className="da-cIco">
      <path
        fill="currentColor"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.21z"
      />
    </svg>
  );
}
/** Solid message bubble — flat body + tail bottom-left; inset so it does not clip the circle. */
function IcChat() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden className="da-cIco">
      <path
        fill="currentColor"
        d="M5.5 4.5h13V10.5H9.6L6.4 14.2V12H5.5V4.5z"
      />
    </svg>
  );
}

const fmt$ = (n) => formatGBP(n);

export default function DriverActiveDeliveryPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const live = useLiveLocation({ mapThrottleMs: 8000 });
  const o = useMemo(
    () => (state && state.order ? { ...DEFAULT_DRIVER_ORDER, ...state.order } : { ...DEFAULT_DRIVER_ORDER }),
    [state],
  );
  const [customerName, setCustomerName] = useState(o.customerName);
  const [customerPhone, setCustomerPhone] = useState(o.customerPhone);
  const [pickupGeo, setPickupGeo] = useState(null);
  const [dropoffGeo, setDropoffGeo] = useState(null);
  const [packagePhotoSrc, setPackagePhotoSrc] = useState(() =>
    isDriverPackagePhotoSrc(o?.packagePhotoDataUrl) ? o.packagePhotoDataUrl : null,
  );

  const pickup = String(o.from || '').trim() || 'Stratford, London E15';
  const dropoff = String(o.to || '').trim() || pickup;

  useEffect(() => {
    setCustomerName(o.customerName);
    setCustomerPhone(o.customerPhone);
  }, [o.customerName, o.customerPhone]);

  useEffect(() => {
    let cancelled = false;
    const fromNav = isDriverPackagePhotoSrc(o.packagePhotoDataUrl) ? o.packagePhotoDataUrl : null;
    if (fromNav) {
      setPackagePhotoSrc(fromNav);
      return () => {
        cancelled = true;
      };
    }
    setPackagePhotoSrc(null);
    const table = o.bookingTable;
    const id = o.supabaseOrderId;
    if (!isSupabaseConfigured || !supabase || table !== 'customer_delivery_orders' || !id) {
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const { data, error } = await supabase
        .from('customer_delivery_orders')
        .select('package_photo_data_url')
        .eq('id', id)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const u = data.package_photo_data_url;
      if (isDriverPackagePhotoSrc(u)) setPackagePhotoSrc(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [o.packagePhotoDataUrl, o.bookingTable, o.supabaseOrderId]);

  useEffect(() => {
    let cancelled = false;
    const table = o.bookingTable;
    const id = o.supabaseOrderId;
    if (!isSupabaseConfigured || !supabase || !table || !id) return undefined;
    (async () => {
      const { full_name, phone } = await fetchBookingCustomerContact(supabase, table, id);
      if (cancelled) return;
      if (full_name) setCustomerName(full_name);
      if (phone) setCustomerPhone(phone);
    })();
    return () => {
      cancelled = true;
    };
  }, [o.bookingTable, o.supabaseOrderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pu, dr] = await Promise.all([forwardGeocodeAddress(pickup), forwardGeocodeAddress(dropoff)]);
        if (cancelled) return;
        setPickupGeo(pu && Number.isFinite(pu.lat) && Number.isFinite(pu.lng) ? pu : null);
        setDropoffGeo(dr && Number.isFinite(dr.lat) && Number.isFinite(dr.lng) ? dr : null);
      } catch {
        if (!cancelled) {
          setPickupGeo(null);
          setDropoffGeo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff]);

  const startDeliveryRouteNav = () => {
    const table = o.bookingTable;
    const id = o.supabaseOrderId;
    if (isSupabaseConfigured && supabase && table === 'customer_delivery_orders' && id && Number.isFinite(live.lat) && Number.isFinite(live.lng)) {
      const payload = {
        driver_live_lat: Number(live.lat),
        driver_live_lng: Number(live.lng),
        driver_live_updated_at: new Date().toISOString(),
        driver_nav_leg: 'to_pickup',
      };
      // Fire-and-forget: this helps customer /live-tracking show driver journey immediately.
      supabase.from(table).update(payload).eq('id', id).then(() => {}).catch(() => {});
    }
    navigate('/driver/navigation', {
      state: {
        order: {
          ...o,
          customerName: customerName || o.customerName,
          customerPhone: customerPhone || o.customerPhone,
        },
        pickup,
        dropoff,
        dest: pickup,
        navLeg: 'toPickup',
      },
    });
  };

  /** Show full journey reliably: current GPS -> pickup -> drop-off (coords), then fallbacks. */
  const journeyMapSrc = useMemo(() => {
    if (pickupGeo && dropoffGeo && Number.isFinite(live.lat) && Number.isFinite(live.lng)) {
      const withWaypoint = publicDirectionsCoordsMapUrl(
        live.lat,
        live.lng,
        dropoffGeo.lat,
        dropoffGeo.lng,
        [[pickupGeo.lat, pickupGeo.lng]],
      );
      if (withWaypoint) return withWaypoint;
    }
    if (pickupGeo && dropoffGeo) {
      const coords = publicDirectionsCoordsMapUrl(pickupGeo.lat, pickupGeo.lng, dropoffGeo.lat, dropoffGeo.lng);
      if (coords) return coords;
    }
    return publicDirectionsMapUrl(pickup, dropoff) || publicPlaceMapUrl(pickup);
  }, [pickup, dropoff, pickupGeo, dropoffGeo, live.lat, live.lng]);

  return (
    <div className="da-page dd" role="main" aria-label="Active delivery">
      <header className="da-h">
        <button type="button" className="da-back" onClick={() => navigate('/driver/home')} aria-label="Back">
          <Back />
        </button>
        <div className="da-ht">
          <h1>Active Delivery</h1>
          <p className="da-oid">{o.id}</p>
        </div>
      </header>

      <div className={`da-map${journeyMapSrc ? ' da-map--gmap' : ''}`} aria-hidden>
        <GoogleMapEmbed src={journeyMapSrc} title="Pickup to drop-off route" />
        <div className="da-pulse" />
        <svg viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="img">
          <path
            d="M 85 150 Q 150 100 200 80 T 255 60"
            fill="none"
            stroke="#F18631"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform="translate(250, 58)">
            <path
              d="M12 2.2a3.4 3.4 0 0 0-3.2 2.1L3.2 18.2a.4.4 0 0 0 .3.5h15a.4.4 0 0 0 .3-.5L15.1 4.2A3.3 3.3 0 0 0 12 2.2Z"
              fill="#1976d2"
            />
            <circle cx="12" cy="7" r="1" fill="#fff" />
          </g>
          <g transform="translate(170, 100)">
            <path
              d="M12 2.2a3.4 3.4 0 0 0-3.2 2.1L3.2 18.2a.4.4 0 0 0 .3.5h15a.4.4 0 0 0 .3-.5L15.1 4.2A3.3 3.3 0 0 0 12 2.2Z"
              fill="#c62828"
            />
            <circle cx="12" cy="7" r="1" fill="#fff" />
          </g>
          <g transform="translate(80, 148)">
            <path
              d="M12 2.2a3.4 3.4 0 0 0-3.2 2.1L3.2 18.2a.4.4 0 0 0 .3.5h15a.4.4 0 0 0 .3-.5L15.1 4.2A3.3 3.3 0 0 0 12 2.2Z"
              fill="#F18631"
            />
            <circle cx="12" cy="7" r="1" fill="#fff" />
          </g>
        </svg>
      </div>

      <div className="da-sheet">
        <div className="da-sc">
          <div className="da-card">
            <p className="da-ps">Head to Pickup</p>
            <div className="da-journey" aria-label="Journey route">
              <div className="da-jrow">
                <span className="da-jdot da-jdot--pickup" aria-hidden />
                <div>
                  <p className="da-jlab">Pickup</p>
                  <p className="da-jaddr">{pickup}</p>
                </div>
              </div>
              <div className="da-jsep" aria-hidden />
              <div className="da-jrow">
                <span className="da-jdot da-jdot--dropoff" aria-hidden />
                <div>
                  <p className="da-jlab">Drop-off</p>
                  <p className="da-jaddr">{dropoff}</p>
                </div>
              </div>
            </div>
            <p className="da-eta">
              {o.dist}
              {' '}
              ·
              {o.eta}
              {' '}
              away
            </p>
            <button type="button" className="da-navB" onClick={startDeliveryRouteNav}>
              Start delivery route
            </button>
          </div>

          <div className="da-cu">
            <div className="da-av" aria-hidden />
            <div className="da-cB">
              <p className="da-cn">{customerName || 'Customer'}</p>
              <p className="da-sen">
                {o.bookingKind === 'shop' || o.bookingTable === 'shop_customer_orders'
                  ? 'Customer'
                  : !o.bookingKind || o.bookingKind === 'parcel'
                    ? 'Sender'
                    : 'Rider'}
              </p>
              {customerPhone ? (
                <p className="da-cphone" style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 600 }}>
                  {customerPhone}
                </p>
              ) : null}
            </div>
            <div className="da-cAc">
              <a
                className="da-cB2"
                href={customerPhone ? `tel:${String(customerPhone).replace(/\s/g, '')}` : '#'}
                onClick={(e) => {
                  if (!customerPhone) e.preventDefault();
                }}
                aria-label="Call customer"
                title="Call"
                style={!customerPhone ? { pointerEvents: 'none', opacity: 0.45 } : undefined}
              >
                <IcCall />
              </a>
              <Link
                to="/chat"
                state={{ name: customerName, role: 'driver' }}
                className="da-cB2"
                aria-label="Message customer"
              >
                <IcChat />
              </Link>
            </div>
          </div>

          <div className="da-badR" aria-label="Package">
            <span className="da-bdg">
              {o.size || o.pkg}
            </span>
            <span className="da-bdg">
              {o.type || o.pkg}
            </span>
            {o.packageWeight ? (
              <span className="da-bdg" title="Package weight">
                {o.packageWeight}
              </span>
            ) : null}
          </div>
          {packagePhotoSrc ? (
            <figure className="da-packagePhotoWrap">
              <figcaption className="da-packagePhotoCap">Package photo</figcaption>
              <img className="da-packagePhotoImg" src={packagePhotoSrc} alt="Customer package" loading="lazy" />
            </figure>
          ) : null}
          {o.customerPayment && o.customerPayment !== '—' ? (
            <p className="da-customerPay" role="status">
              Customer payment: <strong>{o.customerPayment}</strong>
            </p>
          ) : null}
          {o.specialInstructions ? <p className="da-misc">{o.specialInstructions}</p> : null}

          <div className="da-rowE">
            <span className="da-eL">You will earn</span>
            <span className="da-eR">{fmt$(o.amount)}</span>
          </div>

          <div className="da-acts" role="group" aria-label="Next actions">
            <button
              type="button"
              className="da-ia"
              onClick={() => navigate('/driver/confirm-pickup', { state: { order: o } })}
            >
              I Have Arrived
            </button>
            <button
              type="button"
              className="da-rp"
              onClick={() => {
                window.alert('Report your issue. Support will be notified. (Demo)');
              }}
            >
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
