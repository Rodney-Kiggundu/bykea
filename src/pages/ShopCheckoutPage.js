import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FMT_GBP as FMT } from '../lib/currency';
import { deliveryFeeFromSettings, fetchShopDeliverySettings } from '../lib/shopDeliverySettings';
import { saveShopCustomerOrder } from '../lib/shopCustomerOrderSave';
import { writeShopOrderConfirmationState } from '../lib/shopOrderConfirmationSession';
import { resolveShopPaynowLocalInitiateUrl } from '../lib/shopPaynowLocal';
import {
  isStripePaymentsConfigured,
  setStripeHostedReturnContext,
  stripeHostedCheckoutRedirect,
} from '../lib/stripeEdge';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { useShopCart } from '../context/ShopCartContext';
import './taxiAndShop.css';

function useShopPaynowConfig() {
  return useMemo(() => {
    const localInitiateUrl = resolveShopPaynowLocalInitiateUrl();
    return {
      available: !!localInitiateUrl,
      localInitiateUrl,
    };
  }, []);
}

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

export default function ShopCheckoutPage() {
  const navigate = useNavigate();
  const shopPaynow = useShopPaynowConfig();
  const stripeShop = useMemo(() => isStripePaymentsConfigured(), []);
  const { items, subtotal, clearCart } = useShopCart();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/shop/cart', { replace: true });
    }
  }, [items.length, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured || !supabase) {
        setDeliveryFee(0);
        return;
      }
      const { data, error: qErr } = await fetchShopDeliverySettings(supabase);
      if (cancelled) return;
      if (qErr || !data) {
        setDeliveryFee(0);
        return;
      }
      setDeliveryFee(deliveryFeeFromSettings(data));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grandTotal = subtotal + deliveryFee;

  useEffect(() => {
    if (paymentMethod === 'paynow' && !shopPaynow.available) {
      setPaymentMethod(stripeShop ? 'stripe' : 'cod');
    }
    if (paymentMethod === 'stripe' && !stripeShop) {
      setPaymentMethod(shopPaynow.available ? 'paynow' : 'cod');
    }
  }, [paymentMethod, shopPaynow.available, stripeShop]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const name = fullName.trim();
    const ph = phone.trim();
    const addr = address.trim();
    if (!name || !ph || !addr) {
      setError('Please enter your full name, phone number, and delivery address.');
      return;
    }
    setError('');

    if (!isSupabaseConfigured || !supabase) {
      setError('Orders are saved to Supabase. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, then run supabase/shop_customer_orders.sql.');
      return;
    }

    const customer = {
      fullName: name,
      phone: ph,
      email: email.trim(),
      address: addr,
      notes: notes.trim(),
    };

    setSubmitting(true);
    const { data, error: saveErr } = await saveShopCustomerOrder({
      items,
      customer,
      subtotal,
      deliveryFee,
    });

    if (saveErr || !data) {
      setSubmitting(false);
      setError(saveErr?.message || 'Could not place order. Try again.');
      return;
    }

    const itemCount = items.reduce((s, l) => s + l.qty, 0);
    const paynowBody = {
      orderKind: 'shop',
      orderNumber: data.order_number,
      orderId: data.id,
      amount: grandTotal,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerName: customer.fullName,
    };

    if (stripeShop && paymentMethod === 'stripe') {
      const confirmState = {
        source: 'shop',
        orderId: data.order_number,
        shopOrderDbId: data.id,
        customer,
        priceNum: grandTotal,
        priceLabel: FMT.format(grandTotal),
        from: 'Shop partners',
        to: addr,
        deliveryTitle: 'Shop delivery',
        eta: '30–45 mins',
        placedAt: data.placed_at || new Date().toISOString(),
        package: { type: 'Shop order', size: `${itemCount} item${itemCount === 1 ? '' : 's'}` },
      };
      setStripeHostedReturnContext({ flow: 'order_confirmation', state: confirmState });
      const go = await stripeHostedCheckoutRedirect({
        orderKind: 'shop',
        orderId: data.id,
        cancelPath: '/stripe-cancel',
      });
      if (!go.ok) {
        try {
          if (supabase) await supabase.from('shop_customer_orders').delete().eq('id', data.id);
        } catch {
          // ignore
        }
        setError(go.error || 'Could not start card checkout.');
      }
      setSubmitting(false);
      return;
    }

    if (shopPaynow.available && paymentMethod === 'paynow') {
      try {
        const r = await fetch(shopPaynow.localInitiateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paynowBody),
        });
        let payData = await r.json().catch(() => ({}));
        if (!r.ok && payData && typeof payData === 'object' && !payData.error && !payData.ok) {
          payData = { ...payData, error: `HTTP ${r.status}` };
        } else if (!r.ok && (!payData || typeof payData !== 'object')) {
          payData = {
            ok: false,
            error: `Local Paynow server returned ${r.status}. Run \`cd server && npm start\` (default port 4000).`,
          };
        }

        if (payData?.ok === false || !payData?.redirectUrl) {
          const fromBody = [
            payData?.details?.message,
            payData?.details?.hint,
            payData?.details?.error,
            payData?.details?.status,
            payData?.error,
          ]
            .filter(Boolean)
            .join(' ');
          setError(
            fromBody ||
              'Could not start Paynow. Check `server/.env` (Paynow keys + URLs) and that the local API is running.',
          );
          setSubmitting(false);
          return;
        }
        clearCart();
        writeShopOrderConfirmationState({
          source: 'shop',
          orderId: data.order_number,
          shopOrderDbId: data.id,
          customer,
          priceNum: grandTotal,
          priceLabel: FMT.format(grandTotal),
          from: 'Shop partners',
          to: addr,
          deliveryTitle: 'Shop delivery',
          eta: '30–45 mins',
          placedAt: data.placed_at || new Date().toISOString(),
          package: { type: 'Shop order', size: `${itemCount} item${itemCount === 1 ? '' : 's'}` },
        });
        window.location.href = payData.redirectUrl;
        return;
      } catch (payErr) {
        const msg = payErr?.message || String(payErr || '');
        const netHint =
          /Failed to fetch|NetworkError|fetch/i.test(msg) || String(payErr?.cause?.message || '').includes('fetch')
            ? ' Start the local API: `cd server && npm start`, and set `REACT_APP_SHOP_PAYNOW_LOCAL_URL` in `.env.local`. Restart CRA after env changes.'
            : '';
        setError((payErr?.message || 'Could not start Paynow.') + netHint);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    clearCart();
    const confirmState = {
      source: 'shop',
      orderId: data.order_number,
      shopOrderDbId: data.id,
      customer,
      priceNum: grandTotal,
      priceLabel: FMT.format(grandTotal),
      from: 'Shop partners',
      to: addr,
      deliveryTitle: 'Shop delivery',
      eta: '30–45 mins',
      placedAt: data.placed_at || new Date().toISOString(),
      package: { type: 'Shop order', size: `${itemCount} item${itemCount === 1 ? '' : 's'}` },
    };
    writeShopOrderConfirmationState(confirmState);
    navigate('/order-confirmation', { state: confirmState });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="schk" role="main" aria-label="Checkout">
      <header className="schk__h">
        <button type="button" className="schk__back" onClick={() => navigate('/shop/cart')} aria-label="Back to cart">
          <BackIcon />
        </button>
        <h1 className="schk__title">Checkout</h1>
      </header>

      <form className="schk__body" onSubmit={onSubmit}>
        <p className="schk__lead">Enter your details to place your shop order.</p>

        <section className="schk__sum" aria-label="Order summary">
          <h2 className="schk__secT">Order summary</h2>
          <ul className="schk__lines">
            {items.map((l) => (
              <li key={l.id} className="schk__line">
                <span className="schk__lineN">
                  {l.name}
                  <span className="schk__lineQ">
                    {' '}
                    ×
                    {l.qty}
                  </span>
                </span>
                <span className="schk__lineP">{FMT.format(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="schk__subtot">
            <span>Subtotal</span>
            <span>{FMT.format(subtotal)}</span>
          </div>
          <div className="schk__subtot">
            <span>Delivery</span>
            <span>{FMT.format(deliveryFee)}</span>
          </div>
          <div className="schk__tot schk__tot--grand">
            <span>Total</span>
            <span>{FMT.format(grandTotal)}</span>
          </div>
        </section>

        <section className="schk__fields" aria-label="Your details">
          <h2 className="schk__secT">Your details</h2>
          <label className="schk__lab" htmlFor="schk-name">
            Full name
            <span className="schk__req" aria-hidden>
              {' '}
              *
            </span>
          </label>
          <input
            id="schk-name"
            className="schk__inp"
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder="As on your ID"
            required
          />

          <label className="schk__lab" htmlFor="schk-phone">
            Phone
            <span className="schk__req" aria-hidden>
              {' '}
              *
            </span>
          </label>
          <input
            id="schk-phone"
            className="schk__inp"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+44 7700 900123"
            required
          />

          <label className="schk__lab" htmlFor="schk-email">
            Email
          </label>
          <input
            id="schk-email"
            className="schk__inp"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />

          <label className="schk__lab" htmlFor="schk-address">
            Delivery address
            <span className="schk__req" aria-hidden>
              {' '}
              *
            </span>
          </label>
          <textarea
            id="schk-address"
            className="schk__ta"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
            placeholder="House / street, area, city"
            rows={3}
            required
          />

          <label className="schk__lab" htmlFor="schk-notes">
            Notes for delivery (optional)
          </label>
          <textarea
            id="schk-notes"
            className="schk__ta schk__ta--sm"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, landmark, etc."
            rows={2}
          />

          {shopPaynow.available || stripeShop ? (
            <>
              <h2 className="schk__secT">Payment</h2>
              <fieldset className="schk__payFieldset">
                <legend className="schk__payLegend">Payment method</legend>
                <label className="schk__payOpt">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <span>Cash on delivery</span>
                </label>
                {shopPaynow.available ? (
                  <label className="schk__payOpt">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="paynow"
                      checked={paymentMethod === 'paynow'}
                      onChange={() => setPaymentMethod('paynow')}
                    />
                    <span>Pay now (Paynow — EcoCash, card, or other enabled methods)</span>
                  </label>
                ) : null}
                {stripeShop ? (
                  <label className="schk__payOpt">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="stripe"
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                    />
                    <span>Card</span>
                  </label>
                ) : null}
              </fieldset>
            </>
          ) : null}
        </section>

        {error ? (
          <p className="schk__err" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="schk__submit" disabled={submitting}>
          {submitting
            ? paymentMethod === 'paynow'
              ? 'Starting payment…'
              : paymentMethod === 'stripe'
                ? 'Preparing card payment…'
                : 'Placing order…'
            : paymentMethod === 'paynow' && shopPaynow.available
              ? 'Continue to Paynow'
              : paymentMethod === 'stripe' && stripeShop
                ? 'Continue with card'
                : 'Place order'}
        </button>
        {shopPaynow.available && paymentMethod === 'paynow' ? (
          <p className="schk__fine">You will be redirected to Paynow to complete payment.</p>
        ) : null}
        {stripeShop && paymentMethod === 'stripe' ? (
          <p className="schk__fine">You will be redirected to a secure page to pay by card.</p>
        ) : null}
        <p className="schk__linkRow">
          <Link to="/shop/cart" className="schk__link">
            ← Back to cart
          </Link>
        </p>
      </form>
    </div>
  );
}
