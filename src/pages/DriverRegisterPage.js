import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatGBP } from '../lib/currency';
import { dialCodeForIso, PHONE_COUNTRY_CODES } from '../lib/phoneCountryCodes';
import { customerEmailVerifySend } from '../lib/customerEmailVerify';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { formatVehicleTypeForDisplay } from '../lib/vehicleTypeDisplay';
import { PARCEL_DRIVER_VEHICLE_TYPES } from '../lib/deliveryVehicleTypes';
import './driverPortal.css';

const VEHICLE_TYPES = [...PARCEL_DRIVER_VEHICLE_TYPES];
const DOCS = [
  { id: 'nid', label: 'National ID / Passport' },
  { id: 'lic', label: "Driver's License" },
  { id: 'vreg', label: 'Vehicle Registration' },
  { id: 'pv', label: 'Profile Photo with Vehicle' },
];
const DEPOSIT = 10;

function BackIcon() {
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
function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="13" rx="1.2" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path d="M2 8V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function UplIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7a7a7a" aria-hidden>
      <path
        d="M12 16V5M7 8l5-3 5 3M4 20h16"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M4.5 12.2l3.1 2.3 6.5-5.8"
        stroke="#F18631"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.2" stroke="#F18631" strokeWidth="1.2" fill="none" />
      <path
        d="M12 10.2V16M12 7.1v.05"
        stroke="#F18631"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

const DRIVER_DOCS_BUCKET = 'driver-documents';

const initialFiles = () =>
  DOCS.reduce((a, d) => {
    a[d.id] = null;
    return a;
  }, {});

function safeStorageName(name) {
  const n = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return n.slice(0, 96) || 'file';
}

function extFromFile(file) {
  const n = file?.name || '';
  const i = n.lastIndexOf('.');
  if (i <= 0 || i === n.length - 1) return '';
  return n.slice(i);
}

/** Map UI doc id → DB column */
function docColumnForUiId(id) {
  if (id === 'nid') return 'doc_national_id_url';
  if (id === 'lic') return 'doc_license_url';
  if (id === 'vreg') return 'doc_vehicle_registration_url';
  if (id === 'pv') return 'doc_profile_with_vehicle_url';
  return null;
}

export default function DriverRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
    password: '',
    confirm: '',
    countryIso: 'GB',
    vehicleType: 'Motorbike',
    vMake: '',
    vModel: '',
    vPlate: '',
    vColor: '',
  });
  /** @type {{ [key: string]: { name: string, file: File } | null }} */
  const [docFiles, setDocFiles] = useState(() => initialFiles());
  /** Headshot step 1 — optional; saved as profile_photo_url */
  const [profilePhoto, setProfilePhoto] = useState(null);
  const fileRefs = useRef({});
  const profilePhotoInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(
    () => () => {
      if (profilePhoto?.previewUrl) URL.revokeObjectURL(profilePhoto.previewUrl);
    },
    [profilePhoto?.previewUrl],
  );

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const pick = (id) => {
    fileRefs.current[id]?.click();
  };
  const onFile = (id, e) => {
    const f = e.target.files?.[0];
    if (f) setDocFiles((d) => ({ ...d, [id]: { name: f.name, file: f } }));
  };

  const pickProfilePhoto = () => profilePhotoInputRef.current?.click();

  const onProfilePhotoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) {
      if (f && !f.type.startsWith('image/')) {
        e.target.value = '';
      }
      return;
    }
    setProfilePhoto((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file: f, name: f.name, previewUrl: URL.createObjectURL(f) };
    });
    e.target.value = '';
  };

  const onProfilePhotoKeyDown = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      pickProfilePhoto();
    }
  };

  const canNext1 =
    form.fullName &&
    form.phone &&
    form.email &&
    form.nationalId &&
    form.password &&
    form.password === form.confirm;
  const canNext2 = form.vMake && form.vModel && form.vPlate && form.vColor;
  const canSubmit = DOCS.every((d) => docFiles[d.id]?.file);

  const submitApplication = async () => {
    setErrorMessage('');
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, then restart the dev server.');
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const email = form.email.trim().toLowerCase();
      const uploadBatch = crypto.randomUUID();
      const docUrls = {};

      for (const d of DOCS) {
        const entry = docFiles[d.id];
        const col = docColumnForUiId(d.id);
        if (!entry?.file || !col) continue;
        const ext =
          extFromFile(entry.file) ||
          (entry.file.type === 'application/pdf' ? '.pdf' : '.jpg');
        const path = `applications/${uploadBatch}/${d.id}_${safeStorageName(entry.file.name.replace(/\.[^.]+$/, ''))}${ext}`;
        const { error: upErr } = await supabase.storage.from(DRIVER_DOCS_BUCKET).upload(path, entry.file, {
          cacheControl: '3600',
          upsert: true,
          contentType: entry.file.type || 'application/octet-stream',
        });
        if (upErr) {
          docUrls[col] = `pending:${entry.name}`;
        } else {
          const { data: pub } = supabase.storage.from(DRIVER_DOCS_BUCKET).getPublicUrl(path);
          docUrls[col] = pub?.publicUrl || `pending:${entry.name}`;
        }
      }

      let profilePhotoUrl = null;
      if (profilePhoto?.file) {
        const pf = profilePhoto.file;
        const ext = extFromFile(pf) || (pf.type === 'image/png' ? '.png' : '.jpg');
        const path = `applications/${uploadBatch}/profile_${safeStorageName(pf.name.replace(/\.[^.]+$/, ''))}${ext}`;
        const { error: pErr } = await supabase.storage.from(DRIVER_DOCS_BUCKET).upload(path, pf, {
          cacheControl: '3600',
          upsert: true,
          contentType: pf.type || 'image/jpeg',
        });
        if (pErr) {
          profilePhotoUrl = `pending:${profilePhoto.name}`;
        } else {
          const { data: pub } = supabase.storage.from(DRIVER_DOCS_BUCKET).getPublicUrl(path);
          profilePhotoUrl = pub?.publicUrl || `pending:${profilePhoto.name}`;
        }
      }

      const { data: inserted, error } = await supabase
        .from('driver_registrations')
        .insert({
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          email,
          national_id: form.nationalId.trim(),
          password: form.password,
          phone_country_code: dialCodeForIso(form.countryIso),
          vehicle_type: form.vehicleType,
          vehicle_make: form.vMake.trim(),
          vehicle_model: form.vModel.trim(),
          vehicle_plate: form.vPlate.trim(),
          vehicle_color: form.vColor.trim(),
          deposit_required_gbp: DEPOSIT,
          profile_photo_url: profilePhotoUrl,
          doc_national_id_url: docUrls.doc_national_id_url ?? null,
          doc_license_url: docUrls.doc_license_url ?? null,
          doc_vehicle_registration_url: docUrls.doc_vehicle_registration_url ?? null,
          doc_profile_with_vehicle_url: docUrls.doc_profile_with_vehicle_url ?? null,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          setErrorMessage('You already have a pending application with this email. Wait for review or contact support.');
        } else {
          setErrorMessage(error.message || 'Could not save your application. Please try again.');
        }
        return;
      }

      const send = await customerEmailVerifySend({ email, password: form.password, realm: 'driver' });
      if (!send.ok) {
        await supabase.from('driver_registrations').delete().eq('id', inserted.id);
        setErrorMessage(send.error || 'Could not send verification email. Try again in a moment.');
        return;
      }

      navigate(`/verify-email?realm=driver&email=${encodeURIComponent(email)}`, { replace: true });
    } catch {
      setErrorMessage('Network error. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dp">
      <header className="dp-h">
        <button type="button" className="dp-back" onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="dp-tit">Driver Registration</h1>
      </header>
      <div className="dp-sc">
        <p className="dp-stepT">
          Step {step} of 3
        </p>
        <div className="dp-dots" aria-hidden>
          <span className={step === 1 ? 'dp-dot dp-dot--on' : 'dp-dot'} />
          <span className={step === 2 ? 'dp-dot dp-dot--on' : 'dp-dot'} />
          <span className={step === 3 ? 'dp-dot dp-dot--on' : 'dp-dot'} />
        </div>

        {step === 1 && (
          <>
            <div className="dp-pho">
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                aria-label="Choose profile photo"
                onChange={onProfilePhotoChange}
              />
              <div
                className={profilePhoto?.previewUrl ? 'dp-phoC dp-phoC--has' : 'dp-phoC'}
                role="button"
                tabIndex={0}
                onClick={pickProfilePhoto}
                onKeyDown={onProfilePhotoKeyDown}
                aria-label={profilePhoto ? 'Change profile photo' : 'Add profile photo'}
              >
                {profilePhoto?.previewUrl ? (
                  <img src={profilePhoto.previewUrl} alt="Profile preview" />
                ) : (
                  <CamIcon />
                )}
              </div>
              <button type="button" className="dp-phoT" onClick={pickProfilePhoto}>
                {profilePhoto ? 'Change photo' : 'Upload Photo'}
              </button>
            </div>
            <label className="dp-lab" htmlFor="dr-n">
              Full Name
            </label>
            <input className="dp-inp" id="dr-n" name="fullName" value={form.fullName} onChange={onChange} autoComplete="name" placeholder="Full name" />
            <label className="dp-lab" htmlFor="dr-p">
              Phone Number
            </label>
            <div className="dp-row2" style={{ marginBottom: 0, alignItems: 'center' }}>
              <select
                className="dp-cc"
                name="countryIso"
                value={form.countryIso}
                aria-label="Country calling code"
                onChange={onChange}
              >
                {PHONE_COUNTRY_CODES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.name} ({c.dial})
                  </option>
                ))}
              </select>
              <input
                className="dp-inp"
                id="dr-p"
                name="phone"
                value={form.phone}
                onChange={onChange}
                type="tel"
                inputMode="numeric"
                placeholder="300 1234567"
                style={{ marginBottom: 0, flex: 1 }}
                autoComplete="tel-national"
              />
            </div>
            <label className="dp-lab" htmlFor="dr-e">
              Email Address
            </label>
            <input className="dp-inp" id="dr-e" name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" placeholder="you@email.com" />
            <label className="dp-lab" htmlFor="dr-nid">
              National ID Number
            </label>
            <input className="dp-inp" id="dr-nid" name="nationalId" value={form.nationalId} onChange={onChange} autoComplete="off" placeholder="CNIC / ID number" />
            <label className="dp-lab" htmlFor="dr-pw1">
              Password
            </label>
            <input
              className="dp-inp"
              id="dr-pw1"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              autoComplete="new-password"
              placeholder="Create password"
            />
            <label className="dp-lab" htmlFor="dr-pw2">
              Confirm Password
            </label>
            <input
              className="dp-inp"
              id="dr-pw2"
              name="confirm"
              type="password"
              value={form.confirm}
              onChange={onChange}
              autoComplete="new-password"
              placeholder="Confirm password"
            />
            {form.password && form.confirm && form.password !== form.confirm && (
              <p style={{ color: '#c62828', fontSize: '0.75rem', margin: '0.1rem 0 0.3rem' }}>Passwords do not match</p>
            )}
            <button type="button" className="dp-btn" onClick={() => setStep(2)} disabled={!canNext1}>
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <label className="dp-lab" htmlFor="dr-vt">
              Vehicle Type
            </label>
            <select
              className="dp-sel"
              id="dr-vt"
              name="vehicleType"
              value={form.vehicleType}
              onChange={onChange}
            >
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatVehicleTypeForDisplay(v)}
                </option>
              ))}
            </select>
            <label className="dp-lab" htmlFor="dr-vmk">
              Vehicle Make
            </label>
            <input className="dp-inp" id="dr-vmk" name="vMake" value={form.vMake} onChange={onChange} placeholder="e.g. Honda" />
            <label className="dp-lab" htmlFor="dr-vmd">
              Vehicle Model
            </label>
            <input className="dp-inp" id="dr-vmd" name="vModel" value={form.vModel} onChange={onChange} placeholder="e.g. 125" />
            <label className="dp-lab" htmlFor="dr-vpl">
              Plate Number
            </label>
            <input className="dp-inp" id="dr-vpl" name="vPlate" value={form.vPlate} onChange={onChange} placeholder="e.g. ABC-2019" />
            <label className="dp-lab" htmlFor="dr-vcl">
              Vehicle Color
            </label>
            <input className="dp-inp" id="dr-vcl" name="vColor" value={form.vColor} onChange={onChange} placeholder="e.g. Red" />
            <button type="button" className="dp-btn" onClick={() => setStep(3)} disabled={!canNext2}>
              Next
            </button>
          </>
        )}

        {step === 3 && (
          <>
            {errorMessage ? (
              <p style={{ color: '#b42318', fontSize: '0.78rem', fontWeight: 600, margin: '0 0 0.75rem', width: '100%' }} role="alert">
                {errorMessage}
              </p>
            ) : null}
            <h2 className="dp-tit" style={{ fontSize: '0.95rem', textAlign: 'left', marginBottom: 12, width: '100%' }}>
              Upload Your Documents
            </h2>
            {DOCS.map((d) => (
              <div key={d.id}>
                <input
                  ref={(el) => {
                    fileRefs.current[d.id] = el;
                  }}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => onFile(d.id, e)}
                  aria-label={d.label}
                />
                <button
                  type="button"
                  className={docFiles[d.id]?.file ? 'dp-docB dp-docB--ok' : 'dp-docB'}
                  onClick={() => pick(d.id)}
                >
                  {docFiles[d.id]?.file ? <CheckIcon /> : <UplIcon />}
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333' }}>{d.label}</div>
                  <div className="dp-docG">Tap to upload</div>
                  {docFiles[d.id] && <div className="dp-docF">{docFiles[d.id].name}</div>}
                </button>
              </div>
            ))}
            <div className="dp-dep" role="note">
              <span aria-hidden>
                <InfoIcon />
              </span>
              <div>
                <p className="dp-depA">A refundable deposit is required before you start delivering</p>
                <p className="dp-depAmt">{formatGBP(DEPOSIT)}</p>
              </div>
            </div>
            <button type="button" className="dp-btn" onClick={submitApplication} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Application'}
            </button>
            <p className="dp-foot">Your application will be reviewed within 24 hours</p>
          </>
        )}

      </div>
    </div>
  );
}
