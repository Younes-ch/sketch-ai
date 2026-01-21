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
RUN echo '#!/bin/sh' > /docker-entrypoint.d/20-envsubst-config.sh && \
    echo 'cat > /usr/share/nginx/html/config.js << EOF' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    echo 'window.__RUNTIME_CONFIG__ = {' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    echo '  API_URL: "${API_URL}",' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    echo '  APPLICATIONINSIGHTS_CONNECTION_STRING: "${APPLICATIONINSIGHTS_CONNECTION_STRING}"' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    echo '};' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    echo 'EOF' >> /docker-entrypoint.d/20-envsubst-config.sh && \
    chmod +x /docker-entrypoint.d/20-envsubst-config.sh

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
