import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { compressImageToDataUrl } from '../lib/compressImageToDataUrl';
import { SHOP_BUSINESS_TYPES } from '../lib/shopBusinessTypes';
import { customerEmailVerifySend } from '../lib/customerEmailVerify';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export default function ShopOwnerRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    business: '',
    owner: '',
    phone: '',
    email: '',
    pass: '',
    pass2: '',
    type: SHOP_BUSINESS_TYPES[0],
    address: '',
  });
  const [agree, setAgree] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shopImgRef = useRef(null);
  const [shopImageUrl, setShopImageUrl] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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

  const submit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (form.pass !== form.pass2) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!agree) {
      setErrorMessage('Please agree to the terms.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Add env vars and restart npm start.');
      return;
    }

    const emailNorm = form.email.trim().toLowerCase();
    setIsSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from('shop_owners')
        .insert({
          business_name: form.business.trim(),
          owner_full_name: form.owner.trim(),
          phone: form.phone.trim(),
          email: emailNorm,
          password: form.pass,
          business_type: form.type,
          business_address: form.address.trim(),
          shop_image_url: shopImageUrl || null,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          setErrorMessage('This email is already registered. Try logging in.');
        } else {
          setErrorMessage(error.message || 'Could not register. Run supabase/shop_owners.sql if the table is missing.');
        }
        return;
      }

      const send = await customerEmailVerifySend({ email: emailNorm, password: form.pass, realm: 'shop_owner' });
      if (!send.ok) {
        await supabase.from('shop_owners').delete().eq('id', inserted.id);
        setErrorMessage(send.error || 'Could not send verification email. Try again in a moment.');
        return;
      }

      navigate(`/verify-email?realm=shop_owner&email=${encodeURIComponent(emailNorm)}`, { replace: true });
    } catch {
      setErrorMessage('Network error. Please check internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sop sopAuth" role="main">
      <div className="sopLeft">
        <Link to="/" className="sopBrand" aria-label="InGo home">
          InGo
        </Link>
        <h1 className="sopH1L">Grow your business with InGo</h1>
        <p className="sopSubL">Reach more customers and manage your deliveries in one place.</p>
      </div>
      <div className="sopRight" style={{ justifyContent: 'flex-start', paddingTop: '1.25rem', paddingBottom: '1.5rem' }}>
        <h1 className="sopH1R" style={{ marginTop: 0 }}>
          Register your shop
        </h1>
        <p className="sopSubR">Create your shop owner account</p>
        <form className="sopF" onSubmit={submit} autoComplete="on">
          {errorMessage ? (
            <p role="alert" style={{ color: '#c62828', fontSize: '0.82rem', margin: '0 0 0.45rem', fontWeight: 600 }}>
              {errorMessage}
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
          <label className="sopL" htmlFor="sor-bn">
            Business name
          </label>
          <input className="sopI" id="sor-bn" value={form.business} onChange={set('business')} required />
          <label className="sopL" htmlFor="sor-on">
            Owner full name
          </label>
          <input className="sopI" id="sor-on" value={form.owner} onChange={set('owner')} required autoComplete="name" />
          <label className="sopL" htmlFor="sor-ph">
            Phone number
          </label>
          <input
            className="sopI"
            id="sor-ph"
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            required
            autoComplete="tel"
          />
          <label className="sopL" htmlFor="sor-em">
            Email address
          </label>
          <input
            className="sopI"
            id="sor-em"
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />
          <label className="sopL" htmlFor="sor-p1">
            Password
          </label>
          <input
            className="sopI"
            id="sor-p1"
            type="password"
            value={form.pass}
            onChange={set('pass')}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <label className="sopL" htmlFor="sor-p2">
            Confirm password
          </label>
          <input
            className="sopI"
            id="sor-p2"
            type="password"
            value={form.pass2}
            onChange={set('pass2')}
            required
            autoComplete="new-password"
          />
          {form.pass && form.pass2 && form.pass !== form.pass2 && (
            <p style={{ color: '#c62828', fontSize: '0.75rem', margin: '0.1rem 0' }}>Passwords do not match</p>
          )}
          <label className="sopL" htmlFor="sor-ty">
            Business type
          </label>
          <select className="sopSel" id="sor-ty" value={form.type} onChange={set('type')}>
            {SHOP_BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="sopL" htmlFor="sor-ad">
            Business address
          </label>
          <input className="sopI" id="sor-ad" value={form.address} onChange={set('address')} required autoComplete="street-address" />
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
              maxWidth: '22rem',
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
              <img src={shopImageUrl} alt="" style={{ width: '100%', display: 'block', maxHeight: 140, objectFit: 'cover' }} />
            ) : (
              <span style={{ display: 'block', padding: '0.55rem', fontSize: '0.82rem', color: '#666' }}>
                {imageBusy ? 'Processing…' : 'Tap to add a logo or storefront photo'}
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
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '0.2rem 0 0.35rem', maxWidth: '22rem' }}>
            JPEG, PNG, WebP, or GIF — max 12 MB. Image is resized in your browser. You can skip this and add one later from your profile when that is available.
          </p>
          <label className="sopChkL" style={{ margin: '0.2rem 0' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            I agree to the{' '}
            <Link to="/terms" className="sopLink">
              terms
            </Link>
          </label>
          <button className="sopBtn" type="submit" style={{ marginTop: '0.3rem' }} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Register shop'}
          </button>
        </form>
        <p className="sopBot" style={{ marginTop: '0.5rem' }}>
          <Link to="/shop-owner/login" className="sopLink">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
