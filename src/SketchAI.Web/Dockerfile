# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create runtime config script that injects environment variables
# Using a separate file approach to avoid shell escaping issues
COPY <<'SCRIPT' /docker-entrypoint.d/20-envsubst-config.sh
#!/bin/sh
set -e

# Debug: Log environment variables (redact sensitive values)
echo "=== Runtime Config Injection ==="
echo "API_URL: ${API_URL:-<not set>}"
echo "TURNSTILE_SITE_KEY: ${TURNSTILE_SITE_KEY:+<set>}${TURNSTILE_SITE_KEY:-<not set>}"
echo "APPLICATIONINSIGHTS_CONNECTION_STRING: ${APPLICATIONINSIGHTS_CONNECTION_STRING:+<set>}${APPLICATIONINSIGHTS_CONNECTION_STRING:-<not set>}"

# Generate config.js with proper escaping
cat > /usr/share/nginx/html/config.js << CONFIGEOF
window.__RUNTIME_CONFIG__ = {
  API_URL: "${API_URL:-}",
  APPLICATIONINSIGHTS_CONNECTION_STRING: "${APPLICATIONINSIGHTS_CONNECTION_STRING:-}",
  TURNSTILE_SITE_KEY: "${TURNSTILE_SITE_KEY:-}"
};
CONFIGEOF

echo "Generated /usr/share/nginx/html/config.js:"
cat /usr/share/nginx/html/config.js
echo "=== End Runtime Config ==="
SCRIPT
RUN chmod +x /docker-entrypoint.d/20-envsubst-config.sh

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
