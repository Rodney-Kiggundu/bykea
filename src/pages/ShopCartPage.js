import { useNavigate, Link } from 'react-router-dom';
import { FMT_GBP as FMT } from '../lib/currency';
import { useShopCart } from '../context/ShopCartContext';
import './taxiAndShop.css';

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

export default function ShopCartPage() {
  const navigate = useNavigate();
  const { items, updateQty, subtotal } = useShopCart();

  return (
    <div className="scart" role="main" aria-label="Your cart">
      <header className="scart__h">
        <button type="button" className="scart__back" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="scart__title">Cart</h1>
      </header>

      <div className="scart__body">
        {items.length === 0 ? (
          <p className="scart__empty">Your cart is empty.</p>
        ) : (
          <>
            {items.map((l) => (
              <div key={l.id} className="scart__line">
                {l.imageUrl ? (
                  <img className="scart__thumb" src={l.imageUrl} alt={l.name} loading="lazy" decoding="async" />
                ) : null}
                <div className="scart__name">
                  {l.name}
                  <br />
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>{l.shopName}</span>
                </div>
                <div className="scart__qty" aria-label={`Quantity ${l.qty}`}>
                  <button
                    type="button"
                    className="scart__qtyB"
                    onClick={() => updateQty(l.id, -1)}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
                  <button
                    type="button"
                    className="scart__qtyB"
                    onClick={() => updateQty(l.id, 1)}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--ingo-green, #F18631)', minWidth: '4.5rem', textAlign: 'right' }}>
                  {FMT.format(l.price * l.qty)}
                </div>
              </div>
            ))}
            <div className="scart__tot">
              <span>Subtotal</span>
              <span>{FMT.format(subtotal)}</span>
            </div>
            <button type="button" className="scart__ch" onClick={() => navigate('/shop/checkout')}>
              Checkout
            </button>
            <p style={{ textAlign: 'center', margin: '0.4rem 0' }}>
              <Link to="/shops" style={{ color: '#F18631', fontWeight: 600, fontSize: '0.88rem' }}>
                Continue shopping
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
