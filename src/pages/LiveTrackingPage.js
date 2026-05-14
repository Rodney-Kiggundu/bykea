import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GoogleMapEmbed from '../components/GoogleMapEmbed';
import { mapDriverRegistrationRow } from '../lib/customerOrderFeed';
import { isReliableGpsLatLng, publicDirectionsCoordsMapUrl, publicDirectionsMapUrl, publicPlaceMapUrl } from '../lib/googleMapsConfig';
import { forwardGeocodeAddress } from '../lib/reverseGeocode';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './requestFlow.css';
import './orderTracking.css';

const STEPS = [
  { id: 'placed', label: 'Order Placed' },
  { id: 'assigned', label: 'Driver assigned' },
  { id: 'pickup', label: 'En route to pickup' },
  { id: 'transit', label: 'In transit' },
  { id: 'done', label: 'Delivered' },
];

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 18.5L8.5 12l7-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapPinA() {
  return (
    <svg viewBox="0 0 32 40" width="28" height="35" aria-hidden>
      <path
        d="M16 2.5C10.2 2.5 5.5 7.1 5.5 12.6c0 4.6 2.1 6.1 3.1 7.1l7.4 9.1 7.4-9.1c1-1.1 3-2.3 3-7.1C26.4 7.1 21.7 2.5 16 2.5Z"
        fill="#F18631"
      />
      <circle cx="16" cy="12" r="4" fill="white" />
    </svg>
  );
}
function MapPinB() {
  return (
    <svg viewBox="0 0 32 40" width="28" height="35" aria-hidden>
      <path
        d="M16 2.5C10.2 2.5 5.5 7.1 5.5 12.6c0 4.6 2.1 6.1 3.1 7.1l7.4 9.1 7.4-9.1c1-1.1 3-2.3 3-7.1C26.4 7.1 21.7 2.5 16 2.5Z"
        fill="#e53935"
      />
      <circle cx="16" cy="12" r="4" fill="white" />
    </svg>
  );
}

function getStepState(i, activeIndex) {
  if (i < activeIndex) return 'done';
  if (i === activeIndex) return 'active';
  return 'pending';
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path
        d="M6.5 2C5.1 2 4 3.1 4 4.5V19C4 20.4 5.1 21.4 6.5 21.4h11C18.9 21.4 20 20.3 20 19V4.4C20 3 19 2 17.5 2h-11Z"
        fill="currentColor"
        opacity="0.2"
      />
    </svg>
  );
}
function IconChat2() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path
        d="M4 4h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6L3 20V5a1 1 0 0 1 1-1Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
    </svg>
  );
}

function formatOrderId(v) {
  if (!v) return '#ING-00234';
  const s = String(v).replace(/^#+/, '');
  return s.startsWith('ING') ? `#${s}` : `#ING-${s}`;
}

function rideDestinationFromState(order) {
  const stops = order.stops;
  if (Array.isArray(stops) && stops.length) {
    const texts = stops.map((x) => (x?.value ?? '').trim()).filter(Boolean);
    if (texts.length) return texts[texts.length - 1];
  }
  return String(order.to || order.dropoff || '').trim();
}

export default function LiveTrackingPage() {
  const navigate = useNavigate();
  const { state: order = {} } = useLocation();

  const deliveryId = order.supabaseOrderId || null;
  const rideId = order.taxiBookingId || null;
  const rideTable = order.bookingStorageTable || 'taxi_bookings';
  const isDelivery = Boolean(deliveryId);
  const pollTarget = deliveryId || rideId || null;

  const [liveRow, setLiveRow] = useState(null);
  const [liveDriverRow, setLiveDriverRow] = useState(null);
  const [pollTick, setPollTick] = useState(0);
  const [pollErr, setPollErr] = useState('');
  const [fromGeo, setFromGeo] = useState(null);
  const [toGeo, setToGeo] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelWorking, setCancelWorking] = useState(false);
  const [cancelErr, setCancelErr] = useState('');

  const fromAddr = useMemo(() => {
    if (liveRow?.pickup_location) return String(liveRow.pickup_location).trim();
    if (!isDelivery && order.pickup) return String(order.pickup).trim();
    return String(order.from || order.pickup || '').trim() || 'London, UK';
  }, [liveRow, isDelivery, order.from, order.pickup]);

  const toAddr = useMemo(() => {
    if (liveRow?.dropoff_location) return String(liveRow.dropoff_location).trim();
    if (liveRow?.destination_location) return String(liveRow.destination_location).trim();
    if (!isDelivery) return rideDestinationFromState(order) || 'London, UK';
    return String(order.to || order.dropoff || '').trim() || 'London, UK';
  }, [liveRow, isDelivery, order]);

  const fetchSnapshot = useCallback(async () => {
    if (!pollTarget || !isSupabaseConfigured || !supabase) return;
    setPollErr('');
    try {
      if (isDelivery) {
        const { data: row, error } = await supabase.from('customer_delivery_orders').select('*').eq('id', pollTarget).maybeSingle();
        if (error) throw new Error(error.message);
        setLiveRow(row || null);
        if (row?.assigned_driver_id) {
          const { data: d, error: de } = await supabase
            .from('driver_registrations')
            .select('id, full_name, phone, phone_country_code, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, vehicle_color')
            .eq('id', row.assigned_driver_id)
            .maybeSingle();
          if (!de && d) setLiveDriverRow(d);
          else setLiveDriverRow(null);
        } else {
          setLiveDriverRow(null);
        }
        return;
      }

      const { data: row, error } = await supabase.from(rideTable).select('*').eq('id', pollTarget).maybeSingle();
      if (error) throw new Error(error.message);
      setLiveRow(row || null);
      if (row?.assigned_driver_id) {
        const { data: d, error: de } = await supabase
          .from('driver_registrations')
          .select('id, full_name, phone, phone_country_code, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, vehicle_color')
          .eq('id', row.assigned_driver_id)
          .maybeSingle();
        if (!de && d) setLiveDriverRow(d);
        else setLiveDriverRow(null);
      } else {
        setLiveDriverRow(null);
      }
    } catch (e) {
      setPollErr(e?.message || String(e));
    }
  }, [isDelivery, pollTarget, rideTable]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!pollTarget || !isSupabaseConfigured || !supabase) return undefined;
    const id = window.setInterval(() => {
      setPollTick((n) => n + 1);
    }, 2000);
    return () => window.clearInterval(id);
  }, [pollTarget]);

  useEffect(() => {
    if (!pollTarget || pollTick === 0) return;
    fetchSnapshot();
  }, [pollTick, pollTarget, fetchSnapshot]);

  useEffect(() => {
    let cancelled = false;
    if (!fromAddr || !toAddr) {
      setFromGeo(null);
      setToGeo(null);
      return undefined;
    }
    (async () => {
      try {
        const [fg, tg] = await Promise.all([forwardGeocodeAddress(fromAddr), forwardGeocodeAddress(toAddr)]);
        if (cancelled) return;
        setFromGeo(fg && Number.isFinite(fg.lat) && Number.isFinite(fg.lng) ? fg : null);
        setToGeo(tg && Number.isFinite(tg.lat) && Number.isFinite(tg.lng) ? tg : null);
      } catch {
        if (!cancelled) {
          setFromGeo(null);
          setToGeo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromAddr, toAddr]);

  useEffect(() => {
    if (!cancelModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !cancelWorking) setCancelModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelModalOpen, cancelWorking]);

  const orderId = formatOrderId(order.orderId);
  const driverUi = liveDriverRow ? mapDriverRegistrationRow(liveDriverRow) : order.driver || null;

  const waitingForDriver = Boolean(pollTarget && !liveDriverRow && !pollErr);
  const hasDriver = Boolean(driverUi);

  const activeIndex = useMemo(() => {
    if (!pollTarget) return 2;
    if (!hasDriver) return 1;
    const st = String(liveRow?.status || '').toLowerCase();
    const navLeg = String(liveRow?.driver_nav_leg || '').toLowerCase();
    if (st === 'completed' || st === 'delivered') return 4;
    if (navLeg === 'to_dropoff') return 3;
    if (isDelivery && st === 'assigned') return 2;
    if (!isDelivery && st === 'confirmed') return 2;
    if (hasDriver) return 2;
    return 1;
  }, [pollTarget, hasDriver, liveRow, isDelivery]);

  const trackingMapSrc = useMemo(() => {
    if (!fromAddr || !toAddr) return '';
    const drvLat = Number(liveRow?.driver_live_lat);
    const drvLng = Number(liveRow?.driver_live_lng);
    const dbStatus = String(liveRow?.status || '').toLowerCase();
    const navLegRaw = String(liveRow?.driver_nav_leg || '').toLowerCase();
    const navLeg =
      navLegRaw === 'to_dropoff' || dbStatus === 'transit' || dbStatus === 'completed' ? 'to_dropoff' : 'to_pickup';
    const mapDest = navLeg === 'to_dropoff' ? toGeo : fromGeo;
    if (isReliableGpsLatLng(drvLat, drvLng) && mapDest?.lat != null && mapDest?.lng != null) {
      const liveDriverRoute = publicDirectionsCoordsMapUrl(drvLat, drvLng, mapDest.lat, mapDest.lng);
      if (liveDriverRoute) return liveDriverRoute;
    }
    // Driver assigned but live GPS not synced yet:
    // while going to pickup, keep map focused on pickup (do NOT show full pickup->dropoff route).
    if (hasDriver && navLeg === 'to_pickup') {
      return publicPlaceMapUrl(fromAddr) || publicDirectionsMapUrl(fromAddr, toAddr);
    }
    if (fromGeo && toGeo) {
      const c = publicDirectionsCoordsMapUrl(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng);
      if (c) return c;
    }
    return publicDirectionsMapUrl(fromAddr, toAddr);
  }, [
    fromAddr,
    toAddr,
    fromGeo,
    toGeo,
    hasDriver,
    liveRow?.driver_live_lat,
    liveRow?.driver_live_lng,
    liveRow?.driver_nav_leg,
    liveRow?.status,
  ]);

  const isCancelled = String(liveRow?.status || '').toLowerCase() === 'cancelled';
  const isDelivered = String(liveRow?.status || '').toLowerCase() === 'completed' || String(liveRow?.status || '').toLowerCase() === 'delivered';
  const showCancel = activeIndex < 4 && !isCancelled;

  useEffect(() => {
    if (!isDelivered || !hasDriver) return;
    navigate('/rate', {
      replace: true,
      state: {
        order: { id: orderId, from: fromAddr, to: toAddr, driver: driverUi },
        reviewContext: {
          bookingTable: isDelivery ? 'customer_delivery_orders' : rideTable,
          bookingId: pollTarget,
          revieweeDriverId: liveDriverRow?.id || null,
        },
      },
    });
  }, [isDelivered, hasDriver, navigate, orderId, fromAddr, toAddr, driverUi, isDelivery, rideTable, pollTarget, liveDriverRow?.id]);

  const confirmCancelOrder = async () => {
    setCancelErr('');
    if (!pollTarget || !isSupabaseConfigured || !supabase) {
      setCancelModalOpen(false);
      navigate('/home', { replace: true });
      return;
    }
    setCancelWorking(true);
    try {
      const clearAssign = { status: 'cancelled', assigned_driver_id: null };
      const statusOnly = { status: 'cancelled' };
      if (isDelivery) {
        let { error } = await supabase.from('customer_delivery_orders').update(clearAssign).eq('id', pollTarget);
        if (error && /assigned_driver_id|column/i.test(error.message)) {
          ({ error } = await supabase.from('customer_delivery_orders').update(statusOnly).eq('id', pollTarget));
        }
        if (error) throw new Error(error.message);
      } else {
        let { error } = await supabase.from(rideTable).update(clearAssign).eq('id', pollTarget);
        if (error && /assigned_driver_id|column/i.test(error.message)) {
          ({ error } = await supabase.from(rideTable).update(statusOnly).eq('id', pollTarget));
        }
        if (error) throw new Error(error.message);
      }
      setCancelModalOpen(false);
      navigate('/home', { replace: true });
    } catch (e) {
      setCancelErr(e?.message || 'Could not cancel this order.');
    } finally {
      setCancelWorking(false);
    }
  };

  return (
    <div className="lt-page" role="main" aria-label="Live tracking">
      <header className="lt-top">
        <div className="lt-top__row" style={{ position: 'relative', minHeight: '2.7rem' }}>
          <Link to="/home" className="flow-back" aria-label="Back to home" replace>
            <BackArrow />
          </Link>
          <h1>Live Tracking</h1>
        </div>
        <p className="lt-top__sub">{orderId}</p>
      </header>

      <div className={`lt-map${trackingMapSrc ? ' lt-map--gmap' : ''}`}>
        <GoogleMapEmbed src={trackingMapSrc} title="Route map" loading="eager" />
        <div className="lt-map__route" aria-hidden />
        <div className="lt-pin lt-pin--g">
          <MapPinA />
        </div>
        <div className="lt-rider" style={{ top: '44%' }} aria-hidden>
          <div className="lt-rider-dot" />
        </div>
        <div className="lt-pin lt-pin--r">
          <MapPinB />
        </div>
        {waitingForDriver ? (
          <div className="lt-map__loading" role="status" aria-live="polite">
            <div className="lt-map__spinner" aria-hidden />
            <p className="lt-map__loadingText">Finding a driver…</p>
            <p className="lt-map__loadingSub">We’ll notify you here when someone accepts your request.</p>
          </div>
        ) : null}
      </div>

      <div className="lt-sheet">
        <div className="lt-sheet__inner">
          {pollErr ? (
            <p className="lt-pollErr" role="alert">
              {pollErr}
            </p>
          ) : null}
          {isCancelled ? (
            <p className="lt-cancelledBanner" role="status">
              This order has been cancelled.
            </p>
          ) : null}

          <div className="lt-stepper" style={{ position: 'relative' }}>
            <hr className="lt-stepper__line" />
            {STEPS.map((s, i) => {
              const st = getStepState(i, activeIndex);
              return (
                <div
                  key={s.id}
                  className={`lt-st${st === 'done' ? ' lt-st--done' : st === 'active' ? ' lt-st--active' : ''}`}
                >
                  <div className="lt-st__icon" style={{ minHeight: 14, justifyContent: 'center' }} aria-hidden>
                    {st === 'done' && (
                      <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
                        <path d="M1.5 5.5l3 3.5L10 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                    {st === 'active' && (waitingForDriver && i === 1 ? <span className="lt-pulse lt-pulse--wait" /> : <span className="lt-pulse" />)}
                    {st === 'pending' && (
                      <span
                        style={{
                          display: 'block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#d8d8d8',
                        }}
                      />
                    )}
                  </div>
                  <p className="lt-st__text">{s.label}</p>
                </div>
              );
            })}
          </div>

          {hasDriver ? (
            <div className="lt-dcard">
              <div className="oc-avatar" style={{ width: 44, height: 44, flexShrink: 0 }} aria-hidden />
              <div className="oc-dtext" style={{ flex: 1, minWidth: 0 }}>
                <p className="oc-dname" style={{ margin: '0 0 0.1rem' }}>
                  {driverUi.name}
                </p>
                {String(liveRow?.driver_nav_leg || '').toLowerCase() === 'to_dropoff' ? (
                  <p className="lt-dstatus">On the way to drop-off</p>
                ) : (
                  <p className="lt-dstatus">On the way to pickup</p>
                )}
                <p className="lt-eta">{order.eta ? `Est. ${order.eta}` : 'Track on the map above'}</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#555' }}>
                  {driverUi.vehicle} · {driverUi.plate}
                </p>
              </div>
              <div className="oc-dactions" style={{ flexShrink: 0 }}>
                {/\d/.test(String(driverUi.phone || '')) ? (
                  <a
                    className="oc-icon-btn"
                    href={`tel:${String(driverUi.phone).replace(/[^\d+]/g, '')}`}
                    aria-label="Call driver"
                  >
                    <IconPhone />
                  </a>
                ) : (
                  <button type="button" className="oc-icon-btn" aria-label="Call driver" disabled>
                    <IconPhone />
                  </button>
                )}
                <button
                  type="button"
                  className="oc-icon-btn"
                  aria-label="Message driver"
                  onClick={() =>
                    navigate('/chat', {
                      state: { name: driverUi.name, role: 'driver' },
                    })
                  }
                >
                  <IconChat2 />
                </button>
              </div>
            </div>
          ) : (
            <div className="lt-dcard lt-dcard--wait">
              <div className="oc-avatar oc-avatar--ph" style={{ width: 44, height: 44, flexShrink: 0 }} aria-hidden />
              <div className="oc-dtext" style={{ flex: 1, minWidth: 0 }}>
                <p className="oc-dname" style={{ margin: '0 0 0.1rem' }}>
                  {pollTarget ? 'Matching a driver' : 'Driver updates'}
                </p>
                <p className="lt-dstatus">
                  {pollTarget
                    ? 'Hang tight — the map shows your route. A driver will appear here when they accept.'
                    : 'Book with an account linked to Supabase to see live driver assignment.'}
                </p>
              </div>
            </div>
          )}

          <div className="lt-pkg">
            <span>
              {(order.packageInfo || order.package || {}).type || 'Documents'} ·{' '}
              {(order.packageInfo || order.package || {}).size || 'Medium'}
            </span>
            <span className="lt-pkg__id">{orderId}</span>
          </div>

          {isDelivered && hasDriver ? (
            <button
              type="button"
              className="da-navB"
              style={{ margin: '0.25rem 0 0.5rem' }}
              onClick={() =>
                navigate('/rate', {
                  state: {
                    order: { id: orderId, from: fromAddr, to: toAddr, driver: driverUi },
                    reviewContext: {
                      bookingTable: isDelivery ? 'customer_delivery_orders' : rideTable,
                      bookingId: pollTarget,
                      revieweeDriverId: liveDriverRow?.id || null,
                    },
                  },
                })
              }
            >
              Rate Driver
            </button>
          ) : null}

          {showCancel && (
            <button type="button" className="lt-cancel" onClick={() => setCancelModalOpen(true)}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {cancelModalOpen ? (
        <div className="lt-modalRoot" role="dialog" aria-modal="true" aria-labelledby="lt-cancel-title">
          <button
            type="button"
            className="lt-modalBackdrop"
            aria-label="Close"
            disabled={cancelWorking}
            onClick={() => !cancelWorking && setCancelModalOpen(false)}
          />
          <div className="lt-modalCard">
            <div className="lt-modalIcon" aria-hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#F18631" strokeWidth="1.4" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="#c62828" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <h2 id="lt-cancel-title" className="lt-modalTitle">
              Cancel this order?
            </h2>
            <p className="lt-modalText">
              {pollTarget
                ? 'Your request will be marked as cancelled. If a driver was already assigned, they will be notified that the job is off.'
                : 'You’ll leave tracking and return home. This demo booking isn’t saved to the server.'}
            </p>
            <p className="lt-modalOrderRef">{orderId}</p>
            {cancelErr ? (
              <p className="lt-modalErr" role="alert">
                {cancelErr}
              </p>
            ) : null}
            <div className="lt-modalActions">
              <button type="button" className="lt-modalBtnGhost" disabled={cancelWorking} onClick={() => setCancelModalOpen(false)}>
                Keep order
              </button>
              <button type="button" className="lt-modalBtnDanger" disabled={cancelWorking} onClick={() => confirmCancelOrder()}>
                {cancelWorking ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
