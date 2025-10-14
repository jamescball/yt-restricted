# ---- 1) Deps ----
FROM node:20.12.2-bookworm-slim AS deps
WORKDIR /app/restricted-yt

# Copy manifests first for better caching
COPY restricted-yt/package.json restricted-yt/package-lock.json* ./

# Install ALL deps (incl. dev) for building
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    bash -lc 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'

# ---- 2) Builder ----
FROM node:20.12.2-bookworm-slim AS builder
WORKDIR /app/restricted-yt

# Reuse installed modules
COPY --from=deps /app/restricted-yt/node_modules ./node_modules
# Copy app source
COPY restricted-yt/ ./

# Build (produces .next/standalone + .next/static)
RUN npm run build

# ---- 3) Runner ----
FROM node:20.12.2-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs
USER nextjs

# Copy standalone output + assets
COPY --from=builder /app/restricted-yt/.next/standalone ./
COPY --from=builder /app/restricted-yt/.next/static ./.next/static
COPY --from=builder /app/restricted-yt/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
