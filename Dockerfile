# syntax=docker/dockerfile:1.7
#
# Learninx production image.
#
# Stages:
#   deps    - install all npm deps (build + runtime).
#   builder - run `next build` with `output: 'standalone'`.
#   runner  - minimal `node:20-alpine` runtime that executes the standalone
#             `server.js`. No database is required — lessons and quiz
#             questions are baked into the JS bundle, and per-visitor
#             progress lives in a signed cookie.
#

# ---------- Stage 1: install dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests and install.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 3: minimal runtime image ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Non-root runtime user.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy what the standalone server needs.
COPY --chown=nextjs:nodejs public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The standalone server does not bundle the copy script, so we add it back.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000

# On every start: copy static assets into the standalone output, then exec
# the server. The copy step is idempotent and cheap.
CMD ["sh", "-c", "node scripts/copy-standalone-assets.mjs && node server.js"]
