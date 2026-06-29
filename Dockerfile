# syntax=docker/dockerfile:1.7
#
# Learninx production image.
#
# Stages:
#   deps    - install all npm deps (incl. dev) so `next build` and the
#             Prisma client generation succeed.
#   builder - generate prisma client + `next build` (output: standalone).
#   runner  - minimal `node:20-alpine` runtime that executes the
#             standalone `server.js`. Persists SQLite at /data, seeds the
#             lesson catalogue on every start via the plain-JS
#             `prisma/seed.cjs` (no tsx, esbuild, or other dev-only deps
#             required at runtime).
#

# ---------- Stage 1: install dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma's engines need libc + OpenSSL 3 on Alpine.
RUN apk add --no-cache libc6-compat openssl

# Copy manifests and Prisma schema so `prisma generate` (postinstall) has
# what it needs.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholder. The real DATABASE_URL is set in `runner`.
ENV DATABASE_URL="file:./build-time-placeholder.db" \
    NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

# ---------- Stage 3: minimal runtime image ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:/data/dev.db"

RUN apk add --no-cache libc6-compat openssl

# Non-root runtime user.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Persistent SQLite volume mount point.
RUN mkdir -p /data && chown -R nextjs:nodejs /data

# Copy what the standalone server needs.
COPY --chown=nextjs:nodejs public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma runtime artifacts (the client package + generated engine +
# schema + the plain-JS seed), because the standalone build does not
# include dev dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# On every start: apply the Prisma schema, run the plain-JS seed, then
# exec the standalone server. All three steps are idempotent.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma --skip-generate && node prisma/seed.cjs && node server.js"]
