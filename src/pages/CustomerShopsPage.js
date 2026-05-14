import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FMT_GBP as FMT } from '../lib/currency';
import { mapShopOwnerToCard } from '../lib/customerShopMap';
import { SHOP_CATEGORY_COVER_IMAGES } from '../lib/shopCategoryCovers';
import { SHOP_BUSINESS_TYPES } from '../lib/shopBusinessTypes';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { useShopCart } from '../context/ShopCartContext';
import './taxiAndShop.css';

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M6.5 7H20l-1.3 6.6a1.2 1.2 0 0 1-1.1 1H7.2a1.1 1.1 0 0 1-1.1-.7L4.2 3H2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="16" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="10.2" cy="10.2" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M14.3 14.2L19 19" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function stars(n) {
  return '★'.repeat(Math.max(0, Math.min(5, Math.floor(n) || 0)));
}

function ratingLine(rating) {
  if (rating == null || Number.isNaN(Number(rating))) {
    return <span className="shops__rateNew">New on InGo</span>;
  }
  const n = Math.floor(Number(rating));
  return (
    <>
      <span className="shop__sStar" aria-hidden>
        {stars(n)}
      </span>
      {rating}
    </>
  );
}

function formatP(p) {
  return FMT.format(p);
}

function CategoryTileCover({ category }) {
  const src = SHOP_CATEGORY_COVER_IMAGES[category];
  const [broken, setBroken] = useState(false);
  return (
    <div className="shopsCatTile__pic">
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <div className="shopsCatTile__fallback" aria-hidden />
      )}
    </div>
  );
}

export default function CustomerShopsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { totalCount, subtotal } = useShopCart();
  const [q, setQ] = useState('');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const showAll = searchParams.get('all') === '1';
  const catParam = searchParams.get('cat');

  const selectedCategory = useMemo(() => {
    if (!catParam) return null;
    try {
      const dec = decodeURIComponent(catParam);
      return SHOP_BUSINESS_TYPES.includes(dec) ? dec : null;
    } catch {
      return null;
    }
  }, [catParam]);

  const isLanding = !showAll && selectedCategory === null;

  useEffect(() => {
    if (!catParam || selectedCategory) return;
    navigate('/shops', { replace: true });
  }, [catParam, selectedCategory, navigate]);

  const loadShops = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    if (!isSupabaseConfigured || !supabase) {
      setShops([]);
      setLoadError('Shops load from the database. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('shop_owners')
      .select('id, business_name, business_type, business_address, shop_image_url')
      .order('business_name', { ascending: true });
    setLoading(false);
    if (error) {
      setShops([]);
      setLoadError(error.message);
      return;
    }
    setShops((data || []).map(mapShopOwnerToCard).filter(Boolean));
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const filtered = useMemo(() => {
    let list = shops;
    if (selectedCategory) {
      list = list.filter((s) => s.category === selectedCategory);
    }
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((s) => `${s.name} ${s.category} ${s.delivery}`.toLowerCase().includes(t));
  }, [q, shops, selectedCategory]);

  const listTitle = showAll ? 'All shops' : selectedCategory || 'Shops';

  const goCategory = (cat) => {
    navigate(`/shops?cat=${encodeURIComponent(cat)}`);
  };

  const goBrowseAll = () => {
    navigate('/shops?all=1');
  };

  const goCategoriesHome = () => {
    navigate('/shops');
    setQ('');
  };

  return (
    <div className="shop">
      <header className="shop__head">
        <h1 className="shop__h1">Shops</h1>
        <Link to="/shop/cart" className="shop__cart" aria-label={`Cart, ${totalCount} items`}>
          <CartIcon />
          {totalCount > 0 && (
            <span className="shop__cartBadge" aria-hidden>
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </Link>
      </header>

      <div className="shop__body">
        {isLanding ? (
          <>
            <p className="shops__intro shops__intro--landing">Choose a category to see shops near you.</p>
            {loadError ? (
              <p className="shops__bannerErr" role="alert">
                {loadError}
              </p>
            ) : null}
            <div className="shopsLandingGrid" role="navigation" aria-label="Shop categories">
              {SHOP_BUSINESS_TYPES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="shopsCatTile"
                  onClick={() => goCategory(cat)}
                >
                  <CategoryTileCover category={cat} />
                  <span className="shopsCatTile__label">{cat}</span>
                </button>
              ))}
            </div>
            <button type="button" className="shopsBrowseAllBtn" onClick={goBrowseAll}>
              Browse all shops
            </button>
          </>
        ) : (
          <>
            <button type="button" className="shopsBackBtn" onClick={goCategoriesHome}>
              ← Categories
            </button>
            <p className="shops__intro">Tap a shop to view products and add items to your cart.</p>
            {loadError ? (
              <p className="shops__bannerErr" role="alert">
                {loadError}
              </p>
            ) : null}
            <div className="shop__search" role="search">
              <SearchIcon />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search shops…"
                aria-label="Search shops"
              />
            </div>

            <h2 className="shop__subT">{listTitle}</h2>
            {loading ? (
              <p className="shops__loading" role="status">
                Loading shops…
              </p>
            ) : null}
            <div className="shop__feat shop__feat--grid2">
              {!loading &&
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="shop__sCard"
                    onClick={() => navigate(`/shop/${s.id}`)}
                  >
                    {s.imageUrl ? (
                      <img
                        className="shop__sPh shop__sPh--img"
                        src={s.imageUrl}
                        alt={s.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="shop__sPh" role="img" aria-hidden />
                    )}
                    <div className="shop__sB">
                      <h3 className="shop__sName">{s.name}</h3>
                      <p className="shop__sCat">{s.category}</p>
                      <p className="shop__sRate" aria-label={s.rating != null ? `${s.rating} out of 5` : 'New shop'}>
                        {ratingLine(s.rating)}
                      </p>
                      <p className="shop__sMeta">
                        {s.delivery} · {s.fee}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
            {!loading && filtered.length === 0 ? (
              <p className="shops__empty" role="status">
                {loadError
                  ? 'Fix the issue above, then refresh the page to load shops.'
                  : shops.length === 0
                    ? 'No registered shops yet. Shop owners can sign up from the shop portal.'
                    : q.trim()
                      ? 'No shops match your search.'
                      : selectedCategory
                        ? 'No shops in this category yet.'
                        : 'No shops found.'}
              </p>
            ) : null}
          </>
        )}
      </div>

      {totalCount > 0 && (
        <Link
          to="/shop/cart"
          className="shop__cbar"
          tabIndex={0}
          aria-label={`View cart, ${totalCount} items, total ${formatP(subtotal)}`}
        >
          <span className="shop__cbarL">
            View Cart — {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
          <span className="shop__cbarR" aria-hidden>
            {formatP(subtotal)}
          </span>
        </Link>
      )}
    </div>
  );
}
