import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { compressImageToDataUrl } from '../lib/compressImageToDataUrl';
import { getShopOwnerSession, saveShopOwnerSession } from '../lib/shopOwnerAuth';
import { SHOP_BUSINESS_TYPES } from '../lib/shopBusinessTypes';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const emptyForm = () => ({
  business: '',
  owner: '',
  phone: '',
  email: '',
  pass: '',
  pass2: '',
  type: SHOP_BUSINESS_TYPES[0],
  address: '',
});

export default function ShopOwnerProfilePage() {
  const session = getShopOwnerSession();
  const [form, setForm] = useState(() => emptyForm());
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const shopImgRef = useRef(null);
  const [shopImageUrl, setShopImageUrl] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadProfile = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    const s = getShopOwnerSession();
    if (!s?.id) {
      setForm(emptyForm());
      setShopImageUrl(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('shop_owners')
      .select('id, business_name, owner_full_name, phone, email, business_type, business_address, shop_image_url')
      .eq('id', s.id)
      .maybeSingle();
    setLoading(false);
    if (error || !data) {
      setLoadError(error?.message || 'Could not load your profile.');
      return;
    }
    const typeVal = data.business_type?.trim() || SHOP_BUSINESS_TYPES[0];
    setForm({
      business: data.business_name ?? '',
      owner: data.owner_full_name ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      pass: '',
      pass2: '',
      type: typeVal,
      address: data.business_address ?? '',
    });
    setShopImageUrl(data.shop_image_url || null);
  }, []);

  useEffect(() => {
    if (!getShopOwnerSession()?.id) {
      setLoading(false);
      return;
    }
    loadProfile();
  }, [loadProfile]);

  const pickShopImage = () => {
    setImageError('');
    shopImgRef.current?.click();
  };

  const onShopImageChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('Choose an image (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image is too large. Maximum size is 12 MB.');
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setShopImageUrl(dataUrl);
    } catch (err) {
      setImageError(err?.message || 'Could not process this image.');
    } finally {
      setImageBusy(false);
    }
  };

  const clearShopImage = () => {
    setShopImageUrl(null);
    setImageError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaved(false);
    const s = getShopOwnerSession();
    if (!s?.id) {
      setSaveError('Not signed in.');
      return;
    }
    if (form.pass || form.pass2) {
      if (form.pass !== form.pass2) {
        setSaveError('New passwords do not match.');
        return;
      }
      if (form.pass.length < 6) {
        setSaveError('New password must be at least 6 characters.');
        return;
      }
    }
    if (!isSupabaseConfigured || !supabase) {
      setSaveError('Supabase is not configured.');
      return;
    }

    const emailNorm = form.email.trim().toLowerCase();
    const payload = {
      business_name: form.business.trim(),
      owner_full_name: form.owner.trim(),
      phone: form.phone.trim(),
      email: emailNorm,
      business_type: form.type,
      business_address: form.address.trim(),
      shop_image_url: shopImageUrl || null,
    };
    if (form.pass.trim()) {
      payload.password = form.pass;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('shop_owners')
        .update(payload)
        .eq('id', s.id)
        .select('id, business_name, owner_full_name, phone, email, shop_image_url')
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          setSaveError('That email is already used by another account.');
        } else {
          setSaveError(error.message || 'Could not save.');
        }
        return;
      }
      if (data) {
        saveShopOwnerSession(data);
      }
      setForm((f) => ({ ...f, pass: '', pass2: '' }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch {
      setSaveError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sop">
      <div className="sopPageH">
        <h1>Profile &amp; settings</h1>
        {saved ? (
          <span className="sopBdg sopBdg--d" role="status">
            Saved
          </span>
        ) : null}
      </div>

      {!session?.id ? (
        <p className="sopCard" role="alert" style={{ color: '#b42318', fontSize: '0.88rem', fontWeight: 600, maxWidth: '36rem', padding: '0.75rem 1rem' }}>
          You are not signed in.{' '}
          <Link to="/shop-owner/login" className="sopLink">
            Go to login
          </Link>
        </p>
      ) : (
        <form className="sopCard sopPanForm" onSubmit={save} style={{ maxWidth: '36rem', marginBottom: '0.65rem' }}>
          {loadError ? (
            <p role="alert" style={{ color: '#b42318', fontSize: '0.88rem', margin: '0 0 0.65rem', fontWeight: 600 }}>
              {loadError}{' '}
              <button type="button" className="sopLink" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => loadProfile()}>
                Retry
              </button>
            </p>
          ) : null}
          {loading ? (
            <p className="admDim" role="status">
              Loading your details…
            </p>
          ) : !loadError ? (
            <>
              <h2 style={{ margin: '0 0 0.55rem', fontSize: '0.95rem', fontWeight: 800 }}>Shop &amp; account</h2>
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: '#666' }}>
                Same details as when you registered — change anything below, then save.
              </p>
              {saveError ? (
                <p role="alert" style={{ color: '#c62828', fontSize: '0.82rem', margin: '0 0 0.45rem', fontWeight: 600 }}>
                  {saveError}
                </p>
              ) : null}
              <input
                ref={shopImgRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                aria-hidden
                tabIndex={-1}
                onChange={onShopImageChange}
              />
              <label className="sopL" htmlFor="sopf-bn">
                Business name
              </label>
              <input className="sopI" id="sopf-bn" value={form.business} onChange={set('business')} required autoComplete="organization" />
              <label className="sopL" htmlFor="sopf-on">
                Owner full name
              </label>
              <input className="sopI" id="sopf-on" value={form.owner} onChange={set('owner')} required autoComplete="name" />
              <label className="sopL" htmlFor="sopf-ph">
                Phone number
              </label>
              <input className="sopI" id="sopf-ph" type="tel" value={form.phone} onChange={set('phone')} required autoComplete="tel" />
              <label className="sopL" htmlFor="sopf-em">
                Email address
              </label>
              <input className="sopI" id="sopf-em" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
              <label className="sopL" htmlFor="sopf-p1">
                New password <span style={{ fontWeight: 500, color: '#888' }}>(optional)</span>
              </label>
              <input
                className="sopI"
                id="sopf-p1"
                type="password"
                value={form.pass}
                onChange={set('pass')}
                minLength={6}
                autoComplete="new-password"
                placeholder="Leave blank to keep current password"
              />
              <label className="sopL" htmlFor="sopf-p2">
                Confirm new password
              </label>
              <input
                className="sopI"
                id="sopf-p2"
                type="password"
                value={form.pass2}
                onChange={set('pass2')}
                minLength={6}
                autoComplete="new-password"
                placeholder="Leave blank if not changing password"
              />
              {form.pass && form.pass2 && form.pass !== form.pass2 ? (
                <p style={{ color: '#c62828', fontSize: '0.75rem', margin: '0.1rem 0' }}>Passwords do not match</p>
              ) : null}
              <label className="sopL" htmlFor="sopf-ty">
                Business type
              </label>
              <select className="sopSel" id="sopf-ty" value={form.type} onChange={set('type')}>
                {!SHOP_BUSINESS_TYPES.includes(form.type) ? (
                  <option value={form.type}>
                    {form.type} (current)
                  </option>
                ) : null}
                {SHOP_BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="sopL" htmlFor="sopf-ad">
                Business address
              </label>
              <input className="sopI" id="sopf-ad" value={form.address} onChange={set('address')} required autoComplete="street-address" />
              <p className="sopL" style={{ marginTop: '0.45rem' }}>
                Shop photo <span style={{ fontWeight: 500, color: '#888' }}>(optional)</span>
              </p>
              {imageError ? (
                <p role="alert" style={{ color: '#c62828', fontSize: '0.78rem', margin: '0 0 0.35rem', fontWeight: 600 }}>
                  {imageError}
                </p>
              ) : null}
              <div
                className="sopDz2 sopDzPr sopRegShopImg"
                style={{
                  position: 'relative',
                  width: '100%',
                  cursor: imageBusy ? 'wait' : 'pointer',
                  padding: shopImageUrl ? 0 : undefined,
                  overflow: 'hidden',
                  minHeight: '5rem',
                }}
                onClick={() => !imageBusy && pickShopImage()}
                onKeyDown={(e) => {
                  if (imageBusy) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pickShopImage();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={shopImageUrl ? 'Change shop photo' : 'Upload shop photo'}
              >
                {shopImageUrl ? (
                  <img src={shopImageUrl} alt="" style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover' }} />
                ) : (
                  <span style={{ display: 'block', padding: '0.55rem', fontSize: '0.82rem', color: '#666' }}>
                    {imageBusy ? 'Processing…' : 'Tap to add or change shop photo'}
                  </span>
                )}
                {shopImageUrl ? (
                  <button
                    type="button"
                    className="sopImgRm"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearShopImage();
                    }}
                    aria-label="Remove shop photo"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#888', margin: '0.2rem 0 0.5rem' }}>
                JPEG, PNG, WebP, or GIF — max 12 MB. For production, use Supabase Storage URLs instead of large data URLs.
              </p>
              <button type="submit" className="sopBtn" style={{ marginTop: '0.25rem', maxWidth: '16rem' }} disabled={saving || loading}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : null}
        </form>
      )}
    </div>
  );
}
