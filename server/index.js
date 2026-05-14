require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Paynow } = require('paynow');
const { createClient } = require('@supabase/supabase-js');

const PORT = Number(process.env.PORT) || 4000;
const PAYNOW_RESULT_URL = process.env.PAYNOW_RESULT_URL || '';
const PAYNOW_RETURN_URL = process.env.PAYNOW_RETURN_URL || '';

const app = express();
app.use(cors({ origin: true }));

/** Railway / load balancer health check */
app.get('/health', (_req, res) => {
  res.status(200).type('application/json').send({ ok: true, service: 'ingo-paynow-local' });
});

const PAYNOW_OFFICIAL_INITIATE =
  process.env.PAYNOW_OFFICIAL_INITIATE_URL?.trim() ||
  'https://www.paynow.co.zw/interface/initiatetransaction';

/**
 * HTTPS relay for Supabase Edge: forwards the same x-www-form-urlencoded body to Paynow.
 * Host this on a machine/region where Paynow accepts TLS (VPS, Railway, Fly, etc.), then set
 * Supabase secrets PAYNOW_INITIATE_URL + PAYNOW_RELAY_SECRET (same secret here).
 */
app.post(
  '/paynow/relay-initiate',
  express.raw({
    type: (req) => String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded'),
    limit: '128kb',
  }),
  async (req, res) => {
    const secret = process.env.PAYNOW_RELAY_SECRET?.trim();
    if (!secret) {
      return res.status(503).type('text/plain').send('Relay not configured (set PAYNOW_RELAY_SECRET).');
    }
    const got = String(req.headers['x-paynow-relay-secret'] || '');
    if (got !== secret) {
      return res.status(403).type('text/plain').send('Forbidden');
    }
    const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    if (!bodyStr) {
      return res.status(400).type('text/plain').send('Empty body');
    }
    try {
      const out = await fetch(PAYNOW_OFFICIAL_INITIATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/plain, */*',
          Connection: 'close',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: bodyStr,
      });
      const text = await out.text();
      const ct = out.headers.get('content-type') || 'text/plain; charset=utf-8';
      res.status(out.status).set('Content-Type', ct).send(text);
    } catch (e) {
      res
        .status(502)
        .type('text/plain')
        .send(e instanceof Error ? e.message : 'Relay fetch failed');
    }
  },
);

app.use(express.json());

/**
 * Paynow test integrations: if `authemail` is sent, it must equal the merchant’s registered email.
 * Set PAYNOW_MERCHANT_AUTH_EMAIL to that full address, or PAYNOW_OMIT_AUTH_EMAIL=true to send empty.
 */
function resolvePaynowAuthEmail(customerEmailRaw) {
  const merchantMail = process.env.PAYNOW_MERCHANT_AUTH_EMAIL?.trim();
  if (merchantMail) return merchantMail;
  if (process.env.PAYNOW_OMIT_AUTH_EMAIL === 'true') return '';
  return String(customerEmailRaw || '').trim();
}

/** Paynow may POST transaction updates here (same shape as RESULT_URL expects). */
app.post('/paynow/result', express.urlencoded({ extended: true }), (req, res) => {
  // Acknowledge quickly; extend later to verify hash + update DB.
  res.status(200).send('OK');
});

app.post('/paynow/initiate', async (req, res) => {
  const id = process.env.PAYNOW_INTEGRATION_ID || '';
  const key = process.env.PAYNOW_INTEGRATION_KEY || '';
  const resultUrl = PAYNOW_RESULT_URL;
  const returnUrl = PAYNOW_RETURN_URL;

  if (!id || !key || !resultUrl || !returnUrl) {
    return res.status(500).json({
      ok: false,
      error:
        'Missing env: PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, PAYNOW_RESULT_URL, PAYNOW_RETURN_URL',
    });
  }

  const {
    orderNumber,
    orderId,
    amount,
    customerEmail,
    customerName: nameIn,
    orderKind: kindIn,
  } = req.body || {};

  const rawKind = String(kindIn || 'shop').toLowerCase();
  let orderKind = 'shop';
  if (rawKind === 'delivery') orderKind = 'delivery';
  else if (rawKind === 'taxi') orderKind = 'taxi';
  else if (rawKind === 'tuk' || rawKind === 'tuktuk' || rawKind === 'tuk_tuk') orderKind = 'tuk';
  else if (rawKind === 'driver_deposit' || rawKind === 'driverdeposit' || rawKind === 'driver_wallet')
    orderKind = 'driver_deposit';

  const orderNum = String(orderNumber || '').trim();
  const orderUuid = String(orderId || '').trim();
  const amt = Number(amount);
  const customerName = String(nameIn || '').trim() || 'Customer';

  if (!orderNum || !orderUuid || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ ok: false, error: 'orderNumber, orderId and amount are required.' });
  }

  const rounded = Number(amt.toFixed(2));

  try {
    const paynow = new Paynow(id, key, resultUrl, returnUrl);
    const resolved = resolvePaynowAuthEmail(customerEmail);
    const authEmail = resolved === '' ? undefined : resolved;
    const payment = paynow.createPayment(orderNum, authEmail);
    const lineLabel =
      orderKind === 'delivery'
        ? `Delivery ${orderNum} (${customerName})`
        : orderKind === 'taxi'
          ? `Taxi ride ${orderNum} (${customerName})`
          : orderKind === 'tuk'
            ? `Tuk-Tuk ${orderNum} (${customerName})`
            : orderKind === 'driver_deposit'
              ? `Driver wallet deposit ${orderNum} (${customerName})`
            : `Shop order ${orderNum} (${customerName})`;
    payment.add(lineLabel, rounded);

    const response = await paynow.send(payment);

    if (!response || !response.success || !response.redirectUrl) {
      return res.status(200).json({
        ok: false,
        error: 'Paynow initiation failed.',
        details: response || null,
      });
    }

    const updatePayload = {
      payment_gateway: 'paynow',
      payment_status: 'pending',
      paynow_reference: orderNum,
      paynow_poll_url: response.pollUrl || null,
      paynow_redirect_url: response.redirectUrl || null,
      payment_started_at: new Date().toISOString(),
    };

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const table =
        orderKind === 'delivery'
          ? 'customer_delivery_orders'
          : orderKind === 'taxi'
            ? 'taxi_bookings'
            : orderKind === 'tuk'
              ? 'tuk_tuk_bookings'
              : orderKind === 'driver_deposit'
                ? 'driver_wallet_topups'
              : 'shop_customer_orders';
      const { error: updErr } = await supabase.from(table).update(updatePayload).eq('id', orderUuid);

      if (updErr) {
        return res.status(500).json({
          ok: false,
          error: 'Paynow started but Supabase order update failed.',
          details: updErr.message,
          redirectUrl: response.redirectUrl,
          pollUrl: response.pollUrl || null,
        });
      }
    }

    return res.json({
      ok: true,
      redirectUrl: response.redirectUrl,
      pollUrl: response.pollUrl || null,
      reference: orderNum,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Paynow API listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log('POST /paynow/initiate  |  POST /paynow/relay-initiate  |  POST /paynow/result  |  GET /health');
});
