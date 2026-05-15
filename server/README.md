# Local Paynow API

Runs on your PC so Paynow is called from Node (usually works even when Supabase Edge cannot reach `paynow.co.zw`).

## One-time setup

1. **Backend env** — from repo root:

```bash
cd server
npm install
cp .env.example .env
```

On Windows PowerShell: `copy .env.example .env`

2. Edit **`server/.env`**: fill `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, and URLs (see below).

3. **Frontend** — in repo root `.env.local` set **`REACT_APP_SHOP_PAYNOW_LOCAL_URL=http://localhost:4000`** (see `env.local.example`). Shop checkout calls **`POST /paynow/initiate`** on this server only; it does **not** call Supabase Edge `paynow-initiate`.

## Run backend (from repo root)

You can use either:

```bash
npm run paynow:server
```

or:

```bash
cd server && npm start
```

You should see: `Paynow local API http://localhost:4000`

## Run frontend (separate terminal)

```bash
npm start
```

## `server/.env` options

Optional:

- **`SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`** — updates `shop_customer_orders` Paynow fields after initiate.

### URLs

- **`PAYNOW_RETURN_URL`** — page after Paynow (`http://localhost:3000/order-confirmation` locally, or `https://hotel-demo-11dcb.web.app/order-confirmation` when testing against hosted app).
- **`PAYNOW_RESULT_URL`** — Paynow server callback. Often must be **HTTPS**. Use ngrok on port 4000: `https://YOUR-SUBDOMAIN.ngrok-free.app/paynow/result`.

### Paynow test mode (`authemail`)

Test integrations reject a random shopper email. Either:

- **`PAYNOW_OMIT_AUTH_EMAIL=true`** — do not send the customer’s email to Paynow (default in `.env.example`), or  
- **`PAYNOW_MERCHANT_AUTH_EMAIL`** — full merchant address Paynow expects (same as `it@i***.co.zw`, unmasked from dashboard).

Same variable names work if you later run this server on a public host and point `REACT_APP_SHOP_PAYNOW_LOCAL_URL` at that HTTPS origin.

## Production / hosted app

Deploy this **`server/`** (or equivalent) to a public URL, set **`REACT_APP_SHOP_PAYNOW_LOCAL_URL`** to that origin (e.g. `https://api.yourdomain.com`), and configure Paynow **`PAYNOW_RESULT_URL`** (often still a Supabase Edge `paynow-result` URL or your own HTTPS callback). Initiation stays on your Node host, not Edge.

---

## Deploy on Railway (from GitHub)

Railway runs this Node app on a public HTTPS URL so your React app can call **`POST /paynow/initiate`**.

### 1. Push the repo to GitHub

From your machine (use your real remote name / branch):

```bash
git add server/
git commit -m "Add Railway Paynow server config"
git push origin main
```

You can push the **whole** `bykea` monorepo; Railway will only build the **`server/`** folder (see step 3).

### 2. Create a Railway project

1. Open [railway.app](https://railway.app) → **New project** → **Deploy from GitHub**.
2. Authorize GitHub and select the repository that contains this `server/` directory.
3. Railway creates a service — open it → **Settings** → **Root Directory** → set to **`server`** (important).
4. **Settings** → **Networking** → **Generate domain** (e.g. `https://your-service.up.railway.app`).

### If you see the full **InGo** website on Railway

That means the service is building the **repo root** (Create React App), not this API.

1. Open the **same** Railway service → **Settings**.
2. Set **Root Directory** to **`server`** (exactly — the folder that contains `server/package.json` and this README).
3. Set **Start Command** to **`npm start`** (or leave empty so `server/railway.toml` `startCommand` is used).
4. Remove any root-level **Build** that runs `react-scripts build` or serves `build/` for this service. This service should only run **`node index.js`** via `npm start` from **`server/`**.
5. Redeploy. Visiting your Railway URL in a browser should show **JSON** from `GET /` (Paynow API metadata) or **`GET /health`**, not the React SPA.

6. **If Root Directory is easy to miss:** this repo includes a **root `Dockerfile`** that only copies **`server/`** into the image. After you push, Railway should log **“Using detected Dockerfile!”** and stop building the Create React App at the monorepo root. If the dashboard still uses Nixpacks, open **Settings → Build** and set the builder to **Dockerfile** (or add variable **`RAILWAY_DOCKERFILE_PATH=Dockerfile`**), then redeploy.

Host the **customer React app** on Firebase Hosting, Netlify, Vercel, etc., and set **`REACT_APP_SHOP_PAYNOW_LOCAL_URL`** there to your Railway origin, e.g. `https://bykea-production.up.railway.app` (no trailing slash required).

### 3. Environment variables (Railway → Variables)

| Variable | Example / notes |
|----------|-----------------|
| `PORT` | **Do not set** — Railway injects `PORT` automatically. |
| `PAYNOW_INTEGRATION_ID` | From Paynow dashboard. |
| `PAYNOW_INTEGRATION_KEY` | From Paynow dashboard. |
| `PAYNOW_RETURN_URL` | **Your live customer app** URL where shoppers return after Paynow, e.g. `https://your-app.netlify.app/order-confirmation` or your custom domain + path. |
| `PAYNOW_RESULT_URL` | **Must be HTTPS** Paynow can reach. Often `https://<your-supabase>.supabase.co/functions/v1/paynow-result` if you use the Edge callback, **or** `https://<railway-domain>/paynow/result` if Paynow is allowed to POST to this server (currently minimal handler — prefer Edge for production). |
| `PAYNOW_OMIT_AUTH_EMAIL` | `true` for Paynow test, unless you set `PAYNOW_MERCHANT_AUTH_EMAIL`. |
| `SUPABASE_URL` | Optional; needed if this server should update orders after initiate. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; same as above. |
| `PAYNOW_RELAY_SECRET` | Only if you use **`POST /paynow/relay-initiate`** from Supabase Edge; must match Supabase secret. |

After the first deploy, copy the **public Railway URL** (no trailing slash required).

### 4. Point the React app at Railway

In your **hosted** frontend env (Netlify, Vercel, `.env.production`, etc.):

```bash
REACT_APP_SHOP_PAYNOW_LOCAL_URL=https://your-service.up.railway.app
```

Rebuild/redeploy the frontend. Locally, `.env.local` can use the same URL to test against production Paynow.

### 5. Paynow dashboard

Ensure **return** and **result** URLs match what you set in `PAYNOW_RETURN_URL` and `PAYNOW_RESULT_URL` (Paynow may also validate allowed URLs in their UI).

### Health check

`GET /health` returns JSON `{ ok: true }` for Railway healthchecks (`server/railway.toml`).
