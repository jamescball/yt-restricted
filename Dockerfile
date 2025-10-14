# ---- Build args ----
ARG NODE_VERSION=20.12.2

# ---- 1) Base ----
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Use the app subfolder as working directory
WORKDIR /app/restricted-yt

# ---- 2) Deps (install node_modules) ----
FROM base AS deps

# Copy lockfiles for better caching (adjust if you use yarn/pnpm)
COPY restricted-yt/package.json restricted-yt/package-lock.json* ./

RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci

# ---- 3) Builder (build Next.js) ----
FROM base AS builder
# Reuse deps
COPY --from=deps /app/restricted-yt/node_modules ./node_modules
# Copy the app source
COPY restricted-yt ./

# Build Next.js (standalone output)
RUN npm run build

# ---- 4) Runner (minimal image) ----
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone server and assets from the subproject
# .next/standalone contains server.js + minimal node_modules
COPY --from=builder /app/restricted-yt/.next/standalone ./ 
COPY --from=builder /app/restricted-yt/.next/static ./.next/static
COPY --from=builder /app/restricted-yt/public ./public

# Own files
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Start the Next.js standalone server
CMD ["node", "server.js"]
