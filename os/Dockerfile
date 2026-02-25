# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public (build-time) env vars are baked into the Next.js bundle.
# Supply them as --build-arg in `docker build` or via the args: block
# in docker-compose.yml (they are read from the .env file at build time).
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_YOUTUBE_API_KEY

ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CONVEX_SITE_URL=$NEXT_PUBLIC_CONVEX_SITE_URL
ENV NEXT_PUBLIC_YOUTUBE_API_KEY=$NEXT_PUBLIC_YOUTUBE_API_KEY

RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output (the compiled server + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Express server source + generated Convex types
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/convex ./convex
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# We need tsx + concurrently at runtime to run the Express server
# Copy only the packages required at runtime (not the whole devDeps tree)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

# Next.js standalone server port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
EXPOSE 3001

# Run Next.js (standalone) + Express server concurrently
CMD ["node_modules/.bin/concurrently", \
     "--kill-others", \
     "\"node server.js\"", \
     "\"node_modules/.bin/tsx server/index.ts\""]
