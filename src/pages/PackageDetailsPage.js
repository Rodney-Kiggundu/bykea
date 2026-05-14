import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { compressImageToDataUrl } from '../lib/compressImageToDataUrl';
import { getCustomerSession } from '../lib/customerSession';
import { CUSTOMER_PARCEL_VEHICLE_OPTIONS } from '../lib/deliveryVehicleTypes';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './requestFlow.css';

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

const SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra Large' },
];

function IconEnvelope() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden>
      <rect x="3" y="6" width="26" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M3 8l13 8 13-8" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
function IconBoxSm() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden>
      <rect x="5" y="8" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}
function IconBoxLg() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden>
      <rect x="3" y="4" width="20" height="20" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M3 10h20" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}
function IconPallet() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden>
      <rect x="2" y="18" width="28" height="4" rx="0.5" fill="currentColor" />
      <rect x="4" y="6" width="8" height="10" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="20" y="6" width="8" height="10" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

const sizeIcon = {
  small: IconEnvelope,
  medium: IconBoxSm,
  large: IconBoxLg,
  xlarge: IconPallet,
};

const PACKAGE_TYPE_OPTIONS = [
  'Documents',
  'Electronics',
  'Clothing',
  'Food',
  'Fragile',
  'Other',
];

function CamIcon() {
  return (
    <svg
      className="pd-upload__icon"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="16" rx="1.2" fill="none" />
      <path d="M2 8h3l1.5-2H10l1.5 2H22" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="12" r="3" fill="none" />
    </svg>
  );
}

export default function PackageDetailsPage() {
  const navigate = useNavigate();
  const { state: routeState = {} } = useLocation();
  const [size, setSize] = useState('medium');
  const [weight, setWeight] = useState('');
  const [typeCategory, setTypeCategory] = useState('Documents');
  const [typeOther, setTypeOther] = useState('');
  const [fileName, setFileName] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [requestedVehicleType, setRequestedVehicleType] = useState('Motorbike');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const onContinue = async (e) => {
    e.preventDefault();
    setSaveError('');
    const pickup = String(routeState.pickup || '').trim();
    const stops = Array.isArray(routeState.stops) ? routeState.stops : [];
    const dropTexts = stops.map((s) => String(s?.value ?? '').trim()).filter(Boolean);
    const dropoff = dropTexts[0] || '';
    const extraStops = dropTexts.slice(1).map((address) => ({ address }));

    if (typeCategory === 'Other' && !typeOther.trim()) {
      setSaveError('Please describe your package type when you choose Other.');
      return;
    }

    const resolvedType = typeCategory === 'Other' ? typeOther.trim() : typeCategory;

    const pkg = { size, weight, type: resolvedType, notes, fileName, photoDataUrl, requestedVehicleType };
    let deliveryRequestId = routeState.deliveryRequestId;

    if (photoBusy) {
      setSaveError('Still processing your package photo — try again in a moment.');
      return;
    }

    if (pickup && dropoff && isSupabaseConfigured && supabase) {
      setIsSaving(true);
      try {
        const session = getCustomerSession();
        const { data: insertedReq, error } = await supabase
          .from('delivery_requests')
          .insert({
            app_user_id: session?.id ?? null,
            pickup_location: pickup,
            dropoff_location: dropoff,
            extra_stops: extraStops,
            delivery_type: String(routeState.deliveryType || 'standard'),
            distance_estimate: routeState.distanceKm != null ? String(routeState.distanceKm) : null,
            package_size: size,
            package_weight: weight.trim() || null,
            package_category: resolvedType || null,
            package_notes: notes.trim() || null,
            package_photo_filename: fileName.trim() || null,
            requested_vehicle_type: requestedVehicleType.trim(),
          })
          .select('id')
          .single();
        if (error) {
          setSaveError(error.message || 'Could not save your request.');
          setIsSaving(false);
          return;
        }
        if (insertedReq?.id) deliveryRequestId = insertedReq.id;
      } catch {
        setSaveError('Network error while saving.');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    navigate('/price-estimate', {
      state: {
        ...routeState,
        package: pkg,
        deliveryRequestId,
      },
    });
  };

  return (
    <form className="pd-page" onSubmit={onContinue}>
      <div className="pd-header-block">
        <div className="pd-topbar">
          <div className="pd-topbar__row">
            <Link
              to="/request-delivery"
              className="flow-back"
              aria-label="Back to request delivery"
            >
              <BackArrow />
            </Link>
            <h1>Package Details</h1>
          </div>
          <p>Step 2 of 3</p>
        </div>
      </div>
      <div className="pd-pad--safe">
        <div className="pd-content">
        <div className="pd-section" aria-label="Package size">
          <h2>Package Size (select one)</h2>
          <div className="pd-grid" role="radiogroup" aria-label="Package size">
            {SIZES.map((s) => {
              const IconC = sizeIcon[s.id] || IconBoxSm;
              const on = size === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`pd-size${on ? ' pd-size--on' : ''}`}
                  onClick={() => setSize(s.id)}
                  aria-pressed={on}
                >
                  <span className="pd-size__icon" aria-hidden>
                    <IconC />
                  </span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pd-section" aria-label="Vehicle size">
          <h2>Vehicle size needed</h2>
          <p className="pd-hint">
            Pick the smallest vehicle that fits. Drivers with that type or a larger one can accept your delivery
            (weight limits still apply).
          </p>
          <div className="pd-grid pd-grid--vehicle" role="radiogroup" aria-label="Minimum vehicle size for delivery">
            {CUSTOMER_PARCEL_VEHICLE_OPTIONS.map((o) => {
              const on = requestedVehicleType === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={`pd-size pd-size--textOnly${on ? ' pd-size--on' : ''}`}
                  onClick={() => setRequestedVehicleType(o.value)}
                  aria-pressed={on}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pd-section">
          <h2>Package Weight</h2>
          <div className="flow-input-wrap pd-weight">
            <input
              className="flow-input"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.0"
              autoComplete="off"
              aria-label="Weight in kilograms"
            />
            <span className="pd-suffix">kg</span>
          </div>
        </div>

        <div className="pd-section">
          <h2>Package Type</h2>
          <p className="pd-hint">Choose a category. If you pick <strong>Other</strong>, describe what you are sending below.</p>
          <div className="pd-select-wrap">
            <select
              className="pd-select"
              value={typeCategory}
              onChange={(e) => setTypeCategory(e.target.value)}
              aria-label="Package type category"
            >
              {PACKAGE_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          {typeCategory === 'Other' ? (
            <div className="flow-input-wrap" style={{ marginTop: '0.65rem' }}>
              <input
                className="flow-input"
                type="text"
                value={typeOther}
                onChange={(e) => setTypeOther(e.target.value)}
                placeholder="e.g. Medical supplies, pet food, tools"
                autoComplete="off"
                maxLength={200}
                aria-label="Describe your package type"
              />
            </div>
          ) : null}
        </div>

        <div className="pd-section">
          <h2>Package Photo</h2>
          <label className="pd-upload">
            <input
              type="file"
              className="pd-upload__input"
              accept="image/*"
              disabled={photoBusy}
              onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                if (!f) {
                  setFileName('');
                  setPhotoDataUrl(null);
                  return;
                }
                setFileName(f.name);
                setPhotoBusy(true);
                setSaveError('');
                try {
                  const url = await compressImageToDataUrl(f, 960, 0.76);
                  setPhotoDataUrl(url);
                } catch (err) {
                  setPhotoDataUrl(null);
                  setSaveError(err?.message || 'Could not read that image. Try another photo.');
                } finally {
                  setPhotoBusy(false);
                }
              }}
            />
            <span aria-hidden>
              <CamIcon />
            </span>
            <span className="pd-upload__text">
              {photoBusy ? 'Processing photo…' : 'Take or upload photo (optional)'}
              {fileName && !photoBusy ? <span className="pd-filename">{` — ${fileName}`}</span> : null}
            </span>
          </label>
        </div>

        <div className="pd-section">
          <h2>Special Instructions</h2>
          <textarea
            className="pd-instructions"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any handling instructions?"
            autoComplete="off"
            maxLength={500}
          />
        </div>
        {saveError ? <p className="pd-save-error">{saveError}</p> : null}
        {photoDataUrl ? (
          <div className="pd-section" style={{ marginTop: '0.5rem' }}>
            <p className="pd-hint" style={{ marginBottom: '0.35rem' }}>
              Package preview
            </p>
            <img
              src={photoDataUrl}
              alt="Your package"
              style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, objectFit: 'contain', display: 'block' }}
            />
          </div>
        ) : null}
        <button type="submit" className="flow-btn" disabled={isSaving || photoBusy}>
          {isSaving ? 'Saving…' : 'Continue'}
        </button>
        </div>
      </div>
    </form>
  );
}
