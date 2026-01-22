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
