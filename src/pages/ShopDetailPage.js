import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FMT_GBP as FMT } from '../lib/currency';
import { mapRowsToCustomerProducts, mapShopOwnerToCard } from '../lib/customerShopMap';
import { groupByCategory } from '../data/mockShopData';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { useShopCart } from '../context/ShopCartContext';
import './taxiAndShop.css';

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
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

function stars(n) {
  return '★'.repeat(Math.max(0, Math.min(5, Math.floor(n) || 0)));
}

function formatP(p) {
  return FMT.format(p);
}

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { addToCart, totalCount, subtotal } = useShopCart();
  const [shop, setShop] = useState(null);
  const [prods, setProds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!shopId) {
      setShop(null);
      setProds([]);
      setLoading(false);
      return;
    }
    setShop(null);
    setProds([]);
    setLoadError('');
    setLoading(true);
    if (!isSupabaseConfigured || !supabase) {
      setShop(null);
      setProds([]);
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    const { data: ownerRow, error: ownerErr } = await supabase
      .from('shop_owners')
      .select('id, business_name, business_type, business_address, shop_image_url')
      .eq('id', shopId)
      .maybeSingle();
    if (ownerErr || !ownerRow) {
      setShop(null);
      setProds([]);
      setLoadError(ownerErr?.message || 'Shop not found.');
      setLoading(false);
      return;
    }
    const card = mapShopOwnerToCard(ownerRow);
    setShop(card);
    const { data: productRows, error: prodErr } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_owner_id', shopId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    setLoading(false);
    if (prodErr) {
      setProds([]);
      setLoadError(prodErr.message);
      return;
    }
    setProds(mapRowsToCustomerProducts(productRows, shopId, card.name));
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const byCat = groupByCategory(prods);

  if (loading) {
    return (
      <div className="shop-d" role="main">
        <div className="shop-d__top">
          <button type="button" className="shop-d__back" onClick={() => navigate('/shops')} aria-label="Back to shops">
            <BackIcon />
          </button>
        </div>
        <p className="shops__loading" style={{ padding: '1rem 1.25rem' }} role="status">
          Loading shop…
        </p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="shop-d" role="main">
        {loadError ? (
          <p className="shops__bannerErr" style={{ margin: '1rem' }} role="alert">
            {loadError}
          </p>
        ) : (
          <p style={{ padding: '1rem' }}>Shop not found.</p>
        )}
        <button type="button" onClick={() => navigate('/shops')} style={{ marginLeft: '1rem' }}>
          Back to shops
        </button>
      </div>
    );
  }

  return (
    <div className="shop-d" role="main">
      <div className="shop-d__top">
        <button
          type="button"
          className="shop-d__back"
          onClick={() => navigate('/shops')}
          aria-label="Back to shops"
        >
          <BackIcon />
        </button>
        <div
          className={`shop-d__ban${shop?.imageUrl ? ' shop-d__ban--photo' : ''}`}
          role="img"
          aria-hidden
          style={
            shop?.imageUrl
              ? {
                  backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0.45)), url(${shop.imageUrl})`,
                }
              : undefined
          }
        />
        <div className="shop-d__h">
          <h1 className="shop-d__name">{shop?.name}</h1>
          <div className="shop-d__meta">
            {shop?.rating != null && !Number.isNaN(Number(shop.rating)) ? (
              <span className="shop-d__star" aria-label={`Rating ${shop.rating}`}>
                {stars(Math.floor(Number(shop.rating)))} {shop.rating}
              </span>
            ) : (
              <span className="shops__rateNew">New on InGo</span>
            )}
            <span>
              {shop?.delivery} · {shop?.fee}
            </span>
          </div>
        </div>
      </div>

      {loadError && shop ? (
        <p className="shops__bannerErr" style={{ margin: '0.75rem 1rem 0' }} role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="shop-d__sc">
        {prods.length === 0 && !loadError ? (
          <p className="shops__empty" style={{ padding: '1rem 1.25rem' }} role="status">
            This shop has no active products yet.
          </p>
        ) : null}
        {byCat.map(([cname, products]) => (
          <div key={cname}>
            <h2 className="shop__catH">{cname}</h2>
            {products.map((p) => (
              <div key={p.id} className="shop__pRow" role="listitem">
                {p.imageUrl ? (
                  <img
                    className="shop__pRowPh shop__pRowPh--img"
                    src={p.imageUrl}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="shop__pRowPh" role="img" aria-hidden />
                )}
                <div className="shop__pRowBody">
                  <div className="shop__pRowN">{p.name}</div>
                  <div className="shop__pRowP">{formatP(p.price)}</div>
                </div>
                {p.inStock ? (
                  <button
                    type="button"
                    className="shop__pAdd"
                    onClick={() => addToCart(p)}
                    aria-label={`Add ${p.name} to cart`}
                  >
                    Add to cart
                  </button>
                ) : (
                  <div className="shop__pAdd shop__pDis" aria-disabled>
                    Unavailable
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <button type="button" className="shop__cbar" onClick={() => navigate('/shop/cart')}>
          <span className="shop__cbarL">
            View Cart — {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
          <span className="shop__cbarR">{formatP(subtotal)}</span>
        </button>
      )}
    </div>
  );
}
