# The web service (OPS-006): the SvelteKit SPA built with Node, served by Caddy,
# which also proxies the API to the backend service. Build context: repository root.
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# npm 10 reads this lockfile as out of sync; npm 11 installs it (frontend/README.md).
RUN npx --yes npm@11 ci --ignore-scripts --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM caddy:2.10-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/build /srv
