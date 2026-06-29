# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install all dependencies (including dev deps for build) ----------
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat lets Prisma's engine binaries load on Alpine.
RUN apk add --no-cache libc6-compat

# Copy lock file first for layer caching.
COPY package.json package-lock.json* ./
# `npm ci` is faster & reproducible. Allow fallback to `npm install` if a
# lockfile isn't committed.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- Stage 2: build the Next.js standalone bundle ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Bring in the installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules
# Now copy the rest of the source.
COPY . .

# DATABASE_URL is required by Prisma's postinstall hook (`prisma generate`).
# We just point it at an empty placeholder; it won't be touched at build time.
ENV DATABASE_URL="file:./build-time-placeholder.db" \
    NEXT_TELEMETRY_DISABLED=1

# Generate the Prisma client + run the Next.js production build.
RUN npm run build

# ---------- Stage 3: minimal runtime image ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:/data/dev.db"

# Alpine needs libstdc++ for native bcrypt/prisma binaries and the OpenSSL
# 3 runtime for Next's TLS helpers.
RUN apk add --no-cache libc6-compat openssl

# Create a non-root user for runtime safety.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Persistent SQLite volume — the lesson catalogue + per-visitor progress live here.
RUN mkdir -p /data && chown -R nextjs:nodejs /data

# Copy just what the standalone server needs:
#   1. The build output + traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Bring in prisma assets (the generated client + seed script + schema),
# because the standalone build does not include dev dependencies and we
# want the image to be able to (re)initialise the DB on first run.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/typescript ./node_modules/typescript

USER nextjs

EXPOSE 3000

# On every container start, ensure the DB schema exists and the lesson
# catalogue is seeded, then exec the standalone Next.js server.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --schema=/app/prisma/schema.prisma --skip-generate && node node_modules/.bin/tsx prisma/seed.ts && node server.js"]
