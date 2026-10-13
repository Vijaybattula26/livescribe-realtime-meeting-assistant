# ==========================================
# Stage 1: Build the Frontend & Backend
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source files and configs
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/
COPY server/ ./server/

# Build client (Vite -> dist) and server (tsc -> dist-server)
RUN npm run build

# ==========================================
# Stage 2: Production Slim Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package descriptors and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/public ./public

# Ensure non-root node user owns application files
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose standard Cloud Run port
EXPOSE 8080

# Health check endpoint for container orchestrator
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/healthz || exit 1

# Start the Node.js production server
CMD ["node", "dist-server/index.js"]
