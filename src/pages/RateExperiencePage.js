import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById } from '../data/mockOrders';
import { getCustomerSession } from '../lib/customerSession';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './chatNotifyRating.css';

const DRIVER_LABELS = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
const TAGS = [
  'On Time',
  'Friendly Driver',
  'Handled with Care',
  'Fast Delivery',
  'Professional',
  'Poor Handling',
  'Late Arrival',
];
const MAX_CH = 200;

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M15.5 19.5L8 12l7.5-7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Star({ on, onClick, label }) {
  return (
    <button
      type="button"
      className="ingRate__starB"
      onClick={onClick}
      aria-label={label}
    >
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

function StarRow({ value, onChange, name }) {
  return (
    <div className="ingRate__stars" role="group" aria-label={name}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          on={i <= value}
          onClick={() => onChange(i)}
          label={`${i} ${i === 1 ? 'star' : 'stars'}`}
        />
      ))}
    </div>
  );
}

export default function RateExperiencePage() {
  const navigate = useNavigate();
  const { orderId: paramId } = useParams();
  const { state = {} } = useLocation();
  const order = useMemo(() => {
    if (state?.order) return state.order;
    if (paramId) return getOrderById(decodeURIComponent(paramId));
    return getOrderById('ING-00234');
  }, [state, paramId]);

  const [driverR, setDriverR] = useState(0);
  const [tags, setTags] = useState(() => new Set());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const reviewContext = state?.reviewContext || null;

  const toggleTag = (t) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const onSubmit = useCallback(async () => {
    setSubmitErr('');
    if (!isSupabaseConfigured || !supabase || !reviewContext?.bookingId || !reviewContext?.revieweeDriverId) {
      navigate('/orders', { replace: true });
      return;
    }
    if (driverR < 1 || driverR > 5) {
      setSubmitErr('Please add a star rating.');
      return;
    }
    const me = getCustomerSession();
    if (!me?.id) {
      setSubmitErr('Please login again to submit a review.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('trip_reviews').insert({
      booking_table: reviewContext.bookingTable || null,
      booking_id: reviewContext.bookingId,
      reviewer_role: 'customer',
      reviewer_app_user_id: me.id,
      reviewee_role: 'driver',
      reviewee_driver_id: reviewContext.revieweeDriverId,
      rating: driverR,
      review_text: text.trim() || null,
    });
    setBusy(false);
    if (error) {
      setSubmitErr(error.message || 'Could not submit review.');
      return;
    }
    navigate('/orders', { replace: true });
  }, [navigate, reviewContext, driverR, text]);

  const onSkip = useCallback(() => navigate(-1), [navigate]);

  if (!order) {
    return (
      <div className="ingRate" role="main">
        <header className="ingRate__h">
          <button type="button" className="ingRate__back" onClick={() => navigate(-1)} aria-label="Back">
            <BackIcon />
          </button>
          <h1 className="ingRate__title">Rate Your Experience</h1>
        </header>
        <p style={{ padding: '1rem' }}>Order not found.</p>
      </div>
    );
  }

  return (
    <div className="ingRate ingRate--centered" role="main" aria-label="Rate your experience">
      <div className="ingRate__centerWrap">
        <div className="ingRate__centerCard">
          <header className="ingRate__h ingRate__h--card">
            <button type="button" className="ingRate__back" onClick={() => navigate(-1)} aria-label="Back">
              <BackIcon />
            </button>
            <h1 className="ingRate__title">Rate Your Experience</h1>
          </header>

          <div className="ingRate__sc ingRate__sc--card">
            <div className="ingRate__card">
          <p className="ingRate__oid">{order.id}</p>
          <p className="ingRate__addr">
            From: {order.from}
            <br />
            To: {order.to}
          </p>
          {order.driver && (
            <div className="ingRate__drow">
              <div className="ingRate__dAv" aria-hidden />
              <p className="ingRate__dN">{order.driver.name}</p>
            </div>
          )}
        </div>

        <h2 className="ingRate__secT">How was your driver?</h2>
        <StarRow value={driverR} onChange={setDriverR} name="Driver rating" />
        {driverR > 0 && (
          <p className="ingRate__sub" aria-live="polite">
            {DRIVER_LABELS[driverR]}
          </p>
        )}
        <h2 className="ingRate__secT" style={{ marginTop: 12 }}>
          Quick feedback
        </h2>
        <div className="ingRate__tags">
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={tags.has(t) ? 'ingRate__tag ingRate__tag--on' : 'ingRate__tag'}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <h2 className="ingRate__secT">Written feedback</h2>
        <textarea
          className="ingRate__ta"
          rows={3}
          maxLength={MAX_CH}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CH))}
          placeholder="Tell us more about your experience…"
        />
        <div className="ingRate__taC">
          {text.length}/{MAX_CH}
        </div>

        {submitErr ? <p className="auth-message auth-message--error">{submitErr}</p> : null}
        <button type="button" className="ingRate__submit" onClick={onSubmit} disabled={busy}>
          {busy ? 'Submitting...' : 'Submit Review'}
        </button>
            <button type="button" className="ingRate__skip" onClick={onSkip}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
