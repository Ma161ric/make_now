# Multi-stage build for production
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/core/tsconfig.json ./packages/core/

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - serve built files
FROM node:22-alpine

WORKDIR /app

# Install a simple HTTP server to serve static files
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/apps/web/dist ./dist

# Expose port
EXPOSE 3000

# Start server
CMD ["serve", "-s", "dist", "-l", "3000"]
