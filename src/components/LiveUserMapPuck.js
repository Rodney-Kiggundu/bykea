import './LiveUserMapPuck.css';

/**
 * “My location” marker — pulsing dot (like common map apps), no direction arrow.
 * `accurate={false}` — grey dot until GPS locks.
 */
export default function LiveUserMapPuck({
  headingDeg: _headingDeg = null,
  visible = true,
  accurate = true,
  className = '',
}) {
  if (!visible) return null;
  const rootClass = ['live-puck', !accurate ? 'live-puck--approx' : '', className].filter(Boolean).join(' ');
  return (
    <div className={rootClass} aria-hidden>
      <span className="live-puck__pulse" />
      <span className="live-puck__halo" />
      <span className="live-puck__dot" />
    </div>
  );
}
