# ==============================================================================
# HypothesiAI Backend — Multi-stage Production Dockerfile
# ==============================================================================

# Stage 1: Build TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy TypeScript source and configurations
COPY tsconfig*.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory and set permissions for non-root node user
RUN mkdir -p uploads/papers && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
