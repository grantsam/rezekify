# syntax=docker/dockerfile:1.7
# Stage 1: Build static distribution files
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --silent || npm install --silent

COPY . ./

# Configure Vite to use relative API gateway URL
ENV VITE_API_URL=/api/v1

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Runtime
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
