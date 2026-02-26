# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (including lockfile for reproducible builds)
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (Render uses dynamic PORT env)
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
