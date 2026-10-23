# syntax=docker/dockerfile:1
#
# Production image for BudgetBD.
#
#   docker build -t budgetbd .
#   docker run -p 3000:3000 -v budgetbd-data:/data budgetbd
#
# The SQLite database lives on the /data volume. Without a volume the data
# disappears with the container.

ARG NODE_VERSION=24.11.1

# ---- 1. Dependencies, from the lockfile only, no install scripts ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- 2. Build a self-contained server --------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time only: extra Server Action origins when a proxy rewrites Host.
ARG SERVER_ACTIONS_ALLOWED_ORIGINS=""
RUN npm run build

# ---- 3. Runtime: just the traced files, as an unprivileged user ------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/budget.db \
    TRUSTED_PROXY_HOPS=1 \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

RUN mkdir -p /data && chown node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
VOLUME ["/data"]
EXPOSE 3000

# Healthy only when the database answers (see src/app/api/health/route.js).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Next handles SIGTERM: in-flight requests finish before the process exits.
CMD ["node", "server.js"]
