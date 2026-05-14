import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatGBP } from '../lib/currency';
import {
  buildCustomerDeliveryOrderRow,
  deliveryOrderDisplayRef,
} from '../lib/customerDeliveryOrderPayload';
import { getCustomerSession } from '../lib/customerSession';
import { deliveryPricingServiceTypeFromPackage } from '../lib/deliveryPricingServiceType';
import { estimateRoadKm, haversineKm } from '../lib/routeEstimate';
import { forwardGeocodeAddress } from '../lib/reverseGeocode';
import { postLocalPaynowInitiate, resolveShopPaynowLocalInitiateUrl } from '../lib/shopPaynowLocal';
import { writeShopOrderConfirmationState } from '../lib/shopOrderConfirmationSession';
import {
  isStripePaymentsConfigured,
  setStripeHostedReturnContext,
  stripeHostedCheckoutRedirect,
} from '../lib/stripeEdge';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './requestFlow.css';
import './pePayment.css';

const FALLBACK_PRICE_PER_KM = 0.5;
const FALLBACK_BASE_FARE = 1.5;
const FALLBACK_SERVICE_FEE = 0.2;

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

function IconCard() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="#333" strokeWidth="1.3" aria-hidden>
      <rect x="3" y="7" width="26" height="18" rx="2" fill="#fff" />
      <path d="M3 12h26" stroke="#F18631" strokeWidth="2" />
      <rect x="5" y="18" width="7" height="2" rx="0.5" fill="#ccc" />
    </svg>
  );
}
function IconStripeCard() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <rect x="3" y="7" width="26" height="18" rx="2" fill="#635bff" />
      <path d="M3 12h26" fill="#0a2540" opacity="0.25" />
      <rect x="6" y="17" width="10" height="3" rx="0.5" fill="#c4f4ff" opacity="0.9" />
    </svg>
  );
}
function IconCash() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <rect x="3" y="5" width="20" height="12" rx="1" fill="#F18631" transform="rotate(-8 16 12)" />
      <rect
        x="5"
        y="10"
        width="20"
        height="12"
        rx="1"
        fill="#1fa23e"
        transform="rotate(4 16 16)"
        opacity="0.95"
      />
      <rect
        x="6"
        y="14"
        width="20"
        height="12"
        rx="1"
        fill="white"
        transform="rotate(-2 16 20)"
        stroke="#e0e0e0"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function IconBike() {
  return (
    <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden>
      <circle cx="8" cy="22" r="3.2" fill="none" />
      <circle cx="22" cy="22" r="3.2" fill="none" />
      <path
        d="M8 9h3l2.2 4.3L20.5 7H14M9.2 10.5L8 22M19.5 12.3L22 22M12.2 13.3L16.3 19H10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function formatPe(n) {
  return formatGBP(n);
}

function parseDistanceKm(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string' && raw.trim()) {
    const m = raw.match(/([\d.]+)/);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  }
  return null;
}

function resolveAddresses(state, fallbackKm) {
  const from = (state && state.pickup) || 'Stratford, London E15';
  const stops = state?.stops;
  const last = Array.isArray(stops) && stops.length ? stops[stops.length - 1] : null;
  const to =
    (last && (last.value || last.address)) || (state && state.to) || 'Oxford Street, London W1';
  const dRaw = state?.distanceKm;
  const parsed = parseDistanceKm(dRaw);
  const km = parsed != null ? parsed : fallbackKm != null && fallbackKm > 0 ? fallbackKm : 4.2;
  let distance;
  if (typeof dRaw === 'number' && Number.isFinite(dRaw)) {
    distance = `${(Math.round(dRaw * 10) / 10).toFixed(1)} km`;
  } else if (typeof dRaw === 'string' && dRaw.trim()) {
    distance = dRaw.trim();
  } else if (fallbackKm != null && fallbackKm > 0) {
    distance = `${(Math.round(fallbackKm * 10) / 10).toFixed(1)} km`;
  } else {
    distance = '4.2 km';
  }
  return { from, to, distance, km };
}

export default function PriceEstimatePage() {
  const navigate = useNavigate();
  const { state: navState = {} } = useLocation();
  const [fallbackRouteKm, setFallbackRouteKm] = useState(null);

  useEffect(() => {
    const dRaw = navState?.distanceKm;
    const hasExplicit =
      (typeof dRaw === 'number' && Number.isFinite(dRaw) && dRaw > 0) ||
      (typeof dRaw === 'string' && String(dRaw).trim() !== '');
    if (hasExplicit) {
      setFallbackRouteKm(null);
      return undefined;
    }

    let cancelled = false;
    const pickup = String(navState?.pickup || '').trim();
    const stops = navState?.stops;
    const stopTexts = Array.isArray(stops)
      ? stops.map((s) => String(s?.value ?? '').trim()).filter(Boolean)
      : [];
    const drop = stopTexts[stopTexts.length - 1] || '';
    if (!pickup || !drop) {
      setFallbackRouteKm(null);
      return undefined;
    }

    (async () => {
      try {
        const a = await forwardGeocodeAddress(pickup);
        const b = await forwardGeocodeAddress(drop);
        if (cancelled || !a || !b) return;
        const middle = stopTexts.length > 1 ? stopTexts.slice(0, -1) : [];
        let straight = 0;
        let prev = { lat: a.lat, lng: a.lng };
        for (const t of middle) {
          const wp = await forwardGeocodeAddress(t);
          if (!wp) return;
          const h = haversineKm(prev.lat, prev.lng, wp.lat, wp.lng);
          if (h == null) return;
          straight += h;
          prev = { lat: wp.lat, lng: wp.lng };
        }
        const hLast = haversineKm(prev.lat, prev.lng, b.lat, b.lng);
        if (hLast == null) return;
        straight += hLast;
        const road = estimateRoadKm(straight);
        if (!cancelled && road != null && road > 0) setFallbackRouteKm(road);
      } catch {
        if (!cancelled) setFallbackRouteKm(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navState]);

  const { from, to, distance, km } = useMemo(
    () => resolveAddresses(navState, fallbackRouteKm),
    [navState, fallbackRouteKm],
  );
  const deliverySvc = useMemo(() => deliveryPricingServiceTypeFromPackage(navState), [navState]);

  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [pricePerKm, setPricePerKm] = useState(FALLBACK_PRICE_PER_KM);
  const [baseFare, setBaseFare] = useState(FALLBACK_BASE_FARE);
  const [serviceFee, setServiceFee] = useState(FALLBACK_SERVICE_FEE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured || !supabase) return;
        const pick = async (serviceType) => {
          const { data } = await supabase
            .from('service_pricing')
            .select('price_per_km, base_fare, service_fee')
            .eq('service_type', serviceType)
            .maybeSingle();
          return data;
        };
        let data = await pick(deliverySvc);
        if (!data && deliverySvc !== 'delivery') data = await pick('delivery');
        if (cancelled) return;
        const pk = data?.price_per_km != null ? Number(data.price_per_km) : NaN;
        const bf = data?.base_fare != null ? Number(data.base_fare) : NaN;
        const sf = data?.service_fee != null ? Number(data.service_fee) : NaN;
        if (Number.isFinite(pk) && pk >= 0) setPricePerKm(pk);
        if (Number.isFinite(bf) && bf >= 0) setBaseFare(bf);
        if (Number.isFinite(sf) && sf >= 0) setServiceFee(sf);
      } finally {
        if (!cancelled) setRatesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deliverySvc]);

  const distanceFee = useMemo(() => km * pricePerKm, [km, pricePerKm]);
  const total = baseFare + distanceFee + serviceFee;
  const totalLabel = ratesLoaded ? formatPe(total) : '…';

  const paynowConfigured = Boolean(resolveShopPaynowLocalInitiateUrl());
  const stripeConfigured = isStripePaymentsConfigured();
  const [payChoice, setPayChoice] = useState('cod');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (!paynowConfigured && payChoice === 'card') setPayChoice(stripeConfigured ? 'stripe' : 'cod');
    if (!stripeConfigured && payChoice === 'stripe') setPayChoice(paynowConfigured ? 'card' : 'cod');
  }, [paynowConfigured, stripeConfigured, payChoice]);

  const mergedOrderState = useMemo(
    () => ({
      ...navState,
      deliveryOption: 'delivery',
      deliveryTitle: 'Delivery',
      priceLabel: formatPe(total),
      priceNum: total,
      priceBreakdownBase: baseFare,
      priceBreakdownDistance: distanceFee,
      priceBreakdownService: serviceFee,
      eta: 'Varies by route',
      scheduledFor: null,
      from,
      to,
      distance,
      distanceKm: km,
    }),
    [navState, baseFare, distanceFee, serviceFee, from, to, distance, km, total],
  );

  const confirm = async (e) => {
    e.preventDefault();
    setCheckoutError('');

    if (payChoice === 'cod') {
      navigate('/select-payment', {
        state: { ...mergedOrderState, preferredPayment: 'cod' },
      });
      return;
    }

    if (payChoice === 'stripe') {
      if (!isSupabaseConfigured || !supabase) {
        setCheckoutError('Connect Supabase to pay by card.');
        return;
      }
      if (!stripeConfigured) {
        setCheckoutError('Card payment is not configured for this app yet.');
        return;
      }
      setCheckoutBusy(true);
      try {
        const row = buildCustomerDeliveryOrderRow(mergedOrderState, 'stripe');
        row.payment_gateway = 'stripe';
        row.payment_status = 'pending';
        const { data, error: insErr } = await supabase
          .from('customer_delivery_orders')
          .insert(row)
          .select('id')
          .single();
        if (insErr || !data?.id) {
          setCheckoutError(insErr?.message || 'Could not save your order.');
          return;
        }
        const orderUuid = data.id;
        const displayOrderId = deliveryOrderDisplayRef(orderUuid);
        const session = getCustomerSession();
        const confirmState = {
          ...mergedOrderState,
          orderId: displayOrderId,
          supabaseOrderId: orderUuid,
          placedAt: new Date().toISOString(),
          priceLabel: formatPe(total),
          priceNum: total,
          from,
          to,
          deliveryTitle: 'Delivery',
          eta: 'Varies by route',
          package: navState.package,
          customer: session
            ? {
                fullName: session.full_name || session.name || '',
                phone: session.phone || '',
                email: session.email || '',
                address: to,
              }
            : undefined,
        };
        setStripeHostedReturnContext({ flow: 'order_confirmation', state: confirmState });
        const go = await stripeHostedCheckoutRedirect({
          orderKind: 'delivery',
          orderId: orderUuid,
          cancelPath: '/stripe-cancel',
        });
        if (!go.ok) {
          await supabase.from('customer_delivery_orders').delete().eq('id', orderUuid);
          setCheckoutError(go.error || 'Could not start card checkout.');
        }
      } finally {
        setCheckoutBusy(false);
      }
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setCheckoutError('Connect Supabase to pay with Paynow.');
      return;
    }
    if (!paynowConfigured) {
      setCheckoutError('Paynow needs REACT_APP_SHOP_PAYNOW_LOCAL_URL and the local server, or choose card.');
      return;
    }

    setCheckoutBusy(true);
    try {
      const row = buildCustomerDeliveryOrderRow(mergedOrderState, 'card');
      const { data, error: insErr } = await supabase
        .from('customer_delivery_orders')
        .insert(row)
        .select('id')
        .single();
      if (insErr || !data?.id) {
        setCheckoutError(insErr?.message || 'Could not save your order.');
        return;
      }
      const orderUuid = data.id;
      const displayOrderId = deliveryOrderDisplayRef(orderUuid);
      const session = getCustomerSession();
      const payRes = await postLocalPaynowInitiate({
        orderKind: 'delivery',
        orderNumber: displayOrderId,
        orderId: orderUuid,
        amount: Number(total.toFixed(2)),
        customerEmail: session?.email != null ? String(session.email) : '',
        customerPhone: session?.phone != null ? String(session.phone) : '',
        customerName:
          String(session?.full_name || session?.name || '')
            .trim()
            .slice(0, 120) || 'Customer',
      });
      if (!payRes.ok || !payRes.redirectUrl) {
        setCheckoutError(payRes.error || 'Could not start Paynow.');
        return;
      }
      writeShopOrderConfirmationState({
        source: 'delivery',
        orderId: displayOrderId,
        supabaseOrderId: orderUuid,
        placedAt: new Date().toISOString(),
        priceLabel: formatPe(total),
        priceNum: total,
        from,
        to,
        deliveryTitle: 'Delivery',
        eta: 'Varies by route',
        package: navState.package,
        customer: session
          ? {
              fullName: session.full_name || session.name || '',
              phone: session.phone || '',
              email: session.email || '',
              address: to,
            }
          : undefined,
      });
      window.location.href = payRes.redirectUrl;
    } finally {
      setCheckoutBusy(false);
    }
  };

  return (
    <>
      <form className="pe-page" onSubmit={confirm}>
        <div className="pe-header">
          <div className="pe-header__row">
            <Link to="/package-details" className="flow-back" state={navState} replace={false} aria-label="Back">
              <BackArrow />
            </Link>
            <h1>Price Estimate</h1>
          </div>
          <p>Step 3 of 3</p>
        </div>
        <div className="pe-scroll">
          <div className="pe-card" aria-label="Route summary">
            <div className="pe-card__head">
              <div className="pe-route" role="list">
                <div className="pe-route__line" aria-hidden />
                <div className="pe-route__row" role="listitem">
                  <span className="pe-dot pe-dot--g" aria-hidden />
                  <div className="pe-route__from">From: {from}</div>
                </div>
                <div className="pe-route__row" role="listitem">
                  <span className="pe-dot pe-dot--r" aria-hidden />
                  <div className="pe-route__to">To: {to}</div>
                </div>
              </div>
              <div className="pe-km">Distance: {distance}</div>
            </div>
          </div>

          <div className="pe-sec">Delivery</div>
          <div className="pe-opts pe-opts--single" aria-label="Delivery estimate">
            <div className="pe-opt pe-opt--on pe-opt--single" role="group">
              <span className="pe-opt__icon" aria-hidden>
                <IconBike />
              </span>
              <div className="pe-opt__body">
                <p className="pe-opt__title">Delivery</p>
              </div>
              <span className="pe-opt__price" aria-label={`Total ${totalLabel}`}>
                {totalLabel}
              </span>
            </div>
          </div>

          <div className="pe-sec">Payment</div>
          <div className="pay-list" role="radiogroup" aria-label="Payment method">
            <label className={`pay-row${payChoice === 'cod' ? ' pay-row--on' : ''}`} htmlFor="pe-pay-cod">
              <span className="pay-row__icon" aria-hidden>
                <IconCash />
              </span>
              <span className="pay-row__body">
                <span className="pay-row__label">Cash on delivery</span>
                <span className="pay-row__sub">Pay the rider when your parcel arrives</span>
              </span>
              <input
                type="radio"
                id="pe-pay-cod"
                name="pe-payment"
                className="pay-row__radio"
                checked={payChoice === 'cod'}
                onChange={() => setPayChoice('cod')}
                disabled={checkoutBusy}
              />
            </label>
            {paynowConfigured ? (
              <label className={`pay-row${payChoice === 'card' ? ' pay-row--on' : ''}`} htmlFor="pe-pay-card">
                <span className="pay-row__icon" aria-hidden>
                  <IconCard />
                </span>
                <span className="pay-row__body">
                  <span className="pay-row__label">Paynow</span>
                  <span className="pay-row__sub">Redirect to Paynow checkout</span>
                </span>
                <input
                  type="radio"
                  id="pe-pay-card"
                  name="pe-payment"
                  className="pay-row__radio"
                  checked={payChoice === 'card'}
                  onChange={() => setPayChoice('card')}
                  disabled={checkoutBusy}
                />
              </label>
            ) : null}
            {stripeConfigured ? (
              <label className={`pay-row${payChoice === 'stripe' ? ' pay-row--on' : ''}`} htmlFor="pe-pay-stripe">
                <span className="pay-row__icon" aria-hidden>
                  <IconStripeCard />
                </span>
                <span className="pay-row__body">
                  <span className="pay-row__label">Card</span>
                  <span className="pay-row__sub">Pay by card (secure checkout)</span>
                </span>
                <input
                  type="radio"
                  id="pe-pay-stripe"
                  name="pe-payment"
                  className="pay-row__radio"
                  checked={payChoice === 'stripe'}
                  onChange={() => setPayChoice('stripe')}
                  disabled={checkoutBusy}
                />
              </label>
            ) : null}
          </div>

          {checkoutError ? (
            <div
              role="alert"
              style={{
                border: '1px solid #f0c7c7',
                marginBottom: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 10,
                background: '#fff',
              }}
            >
              <p style={{ margin: 0, color: '#b42318', fontSize: '0.9rem' }}>{checkoutError}</p>
            </div>
          ) : null}

          <div className="pe-break" aria-label="Price breakdown">
            <h3>Price Breakdown</h3>
            <div className="pe-break__row">
              <span>Base fare</span>
              <span>{ratesLoaded ? formatPe(baseFare) : '…'}</span>
            </div>
            <div className="pe-break__row">
              <span>Distance fee</span>
              <span>{ratesLoaded ? formatPe(distanceFee) : '…'}</span>
            </div>
            <div className="pe-break__row">
              <span>Service fee</span>
              <span>{ratesLoaded ? formatPe(serviceFee) : '…'}</span>
            </div>
            <hr className="pe-break__hr" />
            <div className="pe-break__row pe-break__row--total">
              <span>Total</span>
              <span>{totalLabel}</span>
            </div>
          </div>
          <button type="submit" className="pe-btn" disabled={!ratesLoaded || checkoutBusy}>
            {checkoutBusy
              ? 'Starting…'
              : payChoice === 'card'
                ? 'Continue to Paynow'
                : payChoice === 'stripe'
                  ? 'Continue with card'
                  : 'Confirm & continue'}
          </button>
        </div>
      </form>
    </>
  );
}
