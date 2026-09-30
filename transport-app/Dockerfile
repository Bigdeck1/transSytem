# ====================================================
# JRR Transport System — Web Hub & API Server
# Multi-stage Docker build for cloud deployment
# ====================================================

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (leverage layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm install typescript@5

# Copy source code
COPY tsconfig.json ./
COPY server/ ./server/
COPY ipc/ ./ipc/
COPY main.ts preload.ts global.d.ts ./

# Build TypeScript to dist/
RUN npx tsc --outDir dist

# Stage 2: Production runtime
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy static frontend assets (HTML, CSS, JS, images)
COPY renderer/ ./renderer/
COPY assets/ ./assets/

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the Express server (compiled output)
CMD ["node", "dist/server/server.js"]
