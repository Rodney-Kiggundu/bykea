import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatGBP } from '../lib/currency';
import { compressImageToDataUrl } from '../lib/compressImageToDataUrl';
import { getShopOwnerSession } from '../lib/shopOwnerAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import './shopOwnerPortal.css';

const MAX_FILE_BYTES = 12 * 1024 * 1024;

const CATS2 = ['Dairy', 'Bakery', 'Produce', 'Pantry', 'Beverages', 'Other'];

const emptyForm = () => ({
  name: '',
  category: CATS2[0],
  description: '',
  price: '',
  compare: '',
  stock: '',
  sku: '',
  weight: '',
  active: true,
  hasVariants: false,
  variants: [],
});

export default function ShopOwnerAddProductPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const slotPickerRef = useRef(0);
  const [f, setF] = useState(() => emptyForm());
  const [images, setImages] = useState([null, null, null, null, null]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [vType, setVType] = useState('Size');
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [vStock, setVStock] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickSlot = (i) => {
    setImageError('');
    slotPickerRef.current = i;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setImageError('Image is too large. Maximum size is 12 MB.');
      return;
    }
    const i = slotPickerRef.current;
    setImageBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setImages((m) => {
        const n = [...m];
        n[i] = { dataUrl, name: file.name };
        return n;
      });
    } catch (err) {
      setImageError(err?.message || 'Could not process this image.');
    } finally {
      setImageBusy(false);
    }
  };

  const rmSlot = (i) => {
    setImages((m) => {
      const n = [...m];
      n[i] = null;
      return n;
    });
  };
  const addVar = () => {
    if (!vName.trim()) return;
    setF((p) => ({
      ...p,
      variants: [...p.variants, { type: vType, name: vName, price: vPrice || f.price, stock: vStock || f.stock || '0' }],
    }));
    setVName('');
    setVPrice('');
    setVStock('');
  };

  const save = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const price = parseFloat(f.price) || 0;
    const st = parseInt(f.stock, 10);
    const session = getShopOwnerSession();
    if (!session?.id) {
      setSubmitError('You must be logged in as a shop owner to save products.');
      return;
    }

    const primaryUrl = images[0]?.dataUrl ?? null;
    const galleryUrls = [1, 2, 3, 4].map((idx) => images[idx]?.dataUrl).filter(Boolean);

    if (isSupabaseConfigured && supabase) {
      setSubmitting(true);
      try {
        const row = {
          shop_owner_id: session.id,
          name: f.name.trim() || 'New product',
          category: f.category,
          description: f.description.trim() || null,
          price,
          compare_at_price: f.compare ? parseFloat(f.compare) : null,
          stock: Number.isFinite(st) ? st : 0,
          sku: f.sku.trim() || null,
          weight: f.weight.trim() || null,
          currency: 'GBP',
          is_active: f.active,
          has_variants: f.hasVariants,
          variants: f.variants,
          image_primary_url: primaryUrl,
          image_urls: galleryUrls,
        };
        const { error } = await supabase.from('shop_products').insert(row);
        if (error) {
          setSubmitError(
            error.message.includes('row-level security') || error.message.includes('shop_products')
              ? `${error.message} — Run supabase/shop_products.sql in Supabase.`
              : error.message,
          );
          return;
        }
        navigate('/shop-owner/products', { replace: true, state: { refreshProducts: true } });
      } catch {
        setSubmitError('Network error while saving. Try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const product = {
      id: String(Date.now()),
      name: f.name.trim() || 'New product',
      category: f.category,
      price,
      stock: Number.isFinite(st) ? st : 0,
      active: f.active,
      primaryImageUrl: primaryUrl,
      galleryImageUrls: galleryUrls,
    };
    navigate('/shop-owner/products', { replace: true, state: { addedProduct: product } });
  };

  return (
    <div className="sop">
      <div className="sopPageH" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.35rem' }}>
        <Link to="/shop-owner/products" className="sopLink" style={{ fontWeight: 600 }}>
          ← Back to products
        </Link>
        <h1 style={{ margin: 0 }}>Add product</h1>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b6b6b' }}>Fill in the details below, then save to list this item.</p>
      </div>

      <form className="sopCard sopPanForm" onSubmit={save} style={{ maxWidth: '36rem', marginTop: '0.65rem' }}>
        {submitError ? (
          <p role="alert" style={{ color: '#c62828', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            {submitError}
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          aria-hidden
          tabIndex={-1}
          onChange={onFileChange}
        />
        <p className="sopL">Product images</p>
        {imageError ? (
          <p role="alert" style={{ color: '#c62828', fontSize: '0.78rem', margin: '0 0 0.35rem', fontWeight: 600 }}>
            {imageError}
          </p>
        ) : null}
        <div
          className="sopDz2 sopDzPr"
          style={{
            position: 'relative',
            width: '100%',
            cursor: imageBusy ? 'wait' : 'pointer',
            padding: images[0] ? 0 : undefined,
            overflow: 'hidden',
            minHeight: '5.5rem',
          }}
          onClick={() => !imageBusy && pickSlot(0)}
          onKeyDown={(e) => {
            if (imageBusy) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pickSlot(0);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={images[0] ? 'Change primary product image' : 'Upload primary product image'}
        >
          {images[0] ? (
            <img src={images[0].dataUrl} alt="" style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover' }} />
          ) : (
            <span style={{ display: 'block', padding: '0.5rem' }}>
              {imageBusy ? 'Processing…' : 'Tap to upload primary image'}
            </span>
          )}
          {images[0] ? (
            <button
              type="button"
              className="sopImgRm"
              onClick={(e) => {
                e.stopPropagation();
                rmSlot(0);
              }}
              aria-label="Remove primary image"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="sopDzR">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="sopDzSm"
              style={{ cursor: imageBusy ? 'wait' : 'pointer', padding: images[i] ? 0 : undefined }}
              onClick={() => !imageBusy && pickSlot(i)}
              onKeyDown={(e) => {
                if (imageBusy) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pickSlot(i);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={images[i] ? `Change extra image ${i}` : `Add extra image ${i}`}
            >
              {images[i] ? (
                <img src={images[i].dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span>+{i + 1}</span>
              )}
              {images[i] ? (
                <button
                  type="button"
                  className="sopImgRm"
                  onClick={(e) => {
                    e.stopPropagation();
                    rmSlot(i);
                  }}
                  aria-label={`Remove image ${i}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.68rem', color: '#888', margin: '0.1rem 0' }}>
          Up to 5 images. JPEG, PNG, WebP, or GIF — max 12 MB each. Images are resized in the browser for preview.
        </p>
        <label className="sopL" htmlFor="ap-name">
          Product name
        </label>
        <input
          className="sopI"
          id="ap-name"
          value={f.name}
          onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))}
          required
        />
        <label className="sopL" htmlFor="ap-cat">
          Category
        </label>
        <select className="sopSel" id="ap-cat" value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))}>
          {CATS2.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="sopL" htmlFor="ap-desc">
          Description
        </label>
        <textarea
          id="ap-desc"
          value={f.description}
          onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))}
          placeholder="Describe the product"
        />
        <label className="sopL" htmlFor="ap-price">
          Price (GBP)
        </label>
        <input
          className="sopI"
          id="ap-price"
          type="number"
          min="0"
          step="0.01"
          value={f.price}
          onChange={(e) => setF((x) => ({ ...x, price: e.target.value }))}
          required
        />
        <label className="sopL" htmlFor="ap-cmp">
          Compare at price (optional)
        </label>
        <input
          className="sopI"
          id="ap-cmp"
          type="number"
          min="0"
          step="0.01"
          placeholder="Original / MSRP"
          value={f.compare}
          onChange={(e) => setF((x) => ({ ...x, compare: e.target.value }))}
        />
        <label className="sopL" htmlFor="ap-st">
          Stock quantity
        </label>
        <input className="sopI" id="ap-st" type="number" min="0" value={f.stock} onChange={(e) => setF((x) => ({ ...x, stock: e.target.value }))} />
        <label className="sopL" htmlFor="ap-sku">
          SKU / product code (optional)
        </label>
        <input className="sopI" id="ap-sku" value={f.sku} onChange={(e) => setF((x) => ({ ...x, sku: e.target.value }))} />
        <label className="sopL" htmlFor="ap-w">
          Weight (for delivery)
        </label>
        <input
          className="sopI"
          id="ap-w"
          type="text"
          placeholder="e.g. 0.5 kg"
          value={f.weight}
          onChange={(e) => setF((x) => ({ ...x, weight: e.target.value }))}
        />
        <div className="sopRow" style={{ margin: '0.3rem 0' }}>
          <span className="sopL" style={{ margin: 0 }}>
            Has variants?
          </span>
          <button
            type="button"
            className={f.hasVariants ? 'sopTgl2 sopTgl2--on' : 'sopTgl2'}
            style={{ position: 'relative' }}
            aria-pressed={f.hasVariants}
            onClick={() => setF((x) => ({ ...x, hasVariants: !x.hasVariants }))}
          />
        </div>
        {f.hasVariants && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, margin: '0.2rem 0' }}>
              <select className="sopSelS" value={vType} onChange={(e) => setVType(e.target.value)} aria-label="Variant type">
                <option>Size</option>
                <option>Color</option>
                <option>Style</option>
              </select>
              <input className="sopI" style={{ flex: '1 1 5rem', minWidth: 0 }} placeholder="Name" value={vName} onChange={(e) => setVName(e.target.value)} />
              <input className="sopI" style={{ flex: '0 0 4.5rem' }} placeholder="Price" value={vPrice} onChange={(e) => setVPrice(e.target.value)} type="number" step="0.01" />
              <input className="sopI" style={{ flex: '0 0 4.5rem' }} placeholder="Stock" value={vStock} onChange={(e) => setVStock(e.target.value)} type="number" />
              <button type="button" className="sopBsm" onClick={addVar} style={{ alignSelf: 'center' }}>
                Add variant
              </button>
            </div>
            {f.variants.map((v, j) => (
              <div key={j} className="sopVarB">
                {v.type}: {v.name} — {formatGBP(parseFloat(v.price) || 0)} / {v.stock} in stock
              </div>
            ))}
          </div>
        )}
        <div className="sopRow" style={{ margin: '0.35rem 0' }}>
          <span className="sopL" style={{ margin: 0 }}>
            Product is active
          </span>
          <button
            type="button"
            className={f.active ? 'sopTgl2 sopTgl2--on' : 'sopTgl2'}
            style={{ position: 'relative' }}
            aria-pressed={f.active}
            onClick={() => setF((x) => ({ ...x, active: !x.active }))}
          />
        </div>
        {f.compare && f.price && (
          <p style={{ fontSize: '0.75rem', color: '#888' }}>
            Compare: <s>{formatGBP(parseFloat(f.compare))}</s> now {formatGBP(parseFloat(f.price))}
          </p>
        )}
        <div className="sopFootBtns">
          <button type="submit" className="sopBtn2" style={{ flex: 1, margin: 0 }} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save product'}
          </button>
          <Link to="/shop-owner/products" className="sopBtnO" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
