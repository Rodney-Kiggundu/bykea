# Paynow / relay API only. The React app (InGo) must be hosted separately
# (Firebase, Netlify, Vercel, etc.) with REACT_APP_SHOP_PAYNOW_LOCAL_URL pointing here.
#
# Railway: with this file at the repo root, builds use Docker instead of Nixpacks
# detecting the root CRA package.json — so this URL serves the API, not the SPA.
FROM node:20-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./

ENV NODE_ENV=production
CMD ["node", "index.js"]
