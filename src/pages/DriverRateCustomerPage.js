import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDriverSession } from '../lib/driverSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './chatNotifyRating.css';

function Star({ on, onClick }) {
  return (
    <button type="button" className="ingRate__starB" onClick={onClick} aria-label="Rate star">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.2l1.5 4.2h4.2l-3.4 2.6L15.8 14L12 11.5L8.2 14l1.2-3.7L5.3 7.3h4.2L10.8 3.1z"
          stroke="#F18631"
          strokeWidth="1.1"
          strokeLinejoin="round"
          fill={on ? '#F18631' : 'none'}
        />
      </svg>
    </button>
  );
}

export default function DriverRateCustomerPage() {
  const navigate = useNavigate();
  const { state = {} } = useLocation();
  const order = useMemo(() => state?.order || {}, [state]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [customerId, setCustomerId] = useState(order?.app_user_id || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const customerName = String(order?.customerName || '').trim() || 'Customer';
  const orderRef = String(order?.id || '').trim();

  useEffect(() => {
    let cancelled = false;
    const table = order?.bookingTable;
    const id = order?.supabaseOrderId;
    if (table === 'shop_customer_orders') return undefined;
    if (!isSupabaseConfigured || !supabase || !table || !id || customerId) return undefined;
    (async () => {
      const { data } = await supabase.from(table).select('app_user_id').eq('id', id).maybeSingle();
      if (!cancelled && data?.app_user_id) setCustomerId(data.app_user_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.bookingTable, order?.supabaseOrderId, customerId]);

  const submit = async () => {
    setErr('');
    if (rating < 1 || rating > 5) {
      setErr('Please select a rating.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErr('Supabase is not configured.');
      return;
    }
    const driver = getDriverSession();
    if (!driver?.id) {
      setErr('Driver session missing.');
      return;
    }
    const isShop = String(order?.bookingTable || '') === 'shop_customer_orders';
    if (!customerId && !isShop) {
      setErr('Customer info is not available yet.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('trip_reviews').insert({
      booking_table: order?.bookingTable || null,
      booking_id: order?.supabaseOrderId || null,
      reviewer_role: 'driver',
      reviewer_driver_id: driver.id,
      reviewee_role: 'customer',
      reviewee_app_user_id: customerId || null,
      rating,
      review_text: text.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message || 'Could not submit review.');
      return;
    }
    navigate('/driver/home', { replace: true });
  };

  return (
    <div className="ingRate drvRate" role="main" aria-label="Rate customer">
      <div className="drvRate__wrap">
        <div className="drvRate__card">
          <h1 className="drvRate__title">Rate Customer</h1>
          <p className="drvRate__sub">Share your trip experience</p>
          <div className="drvRate__meta">
            <p className="drvRate__name">{customerName}</p>
            {orderRef ? <p className="drvRate__order">{orderRef}</p> : null}
          </div>

          <h2 className="ingRate__secT">How was the customer?</h2>
          <div className="ingRate__stars" role="group" aria-label="Customer rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} on={i <= rating} onClick={() => setRating(i)} />
            ))}
          </div>
          <p className="ingRate__sub" style={{ minHeight: '1rem' }}>
            {rating > 0 ? `${rating} / 5` : 'Tap stars to rate'}
          </p>

          <h2 className="ingRate__secT">Description</h2>
          <textarea
            className="ingRate__ta"
            rows={4}
            maxLength={250}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 250))}
            placeholder="Write your feedback..."
          />
          <div className="ingRate__taC">{text.length}/250</div>
          {err ? <p className="auth-message auth-message--error">{err}</p> : null}
          <button type="button" className="ingRate__submit" disabled={busy} onClick={submit}>
            {busy ? 'Submitting...' : 'Submit Review'}
          </button>
          <button type="button" className="ingRate__skip" onClick={() => navigate('/driver/home', { replace: true })}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
