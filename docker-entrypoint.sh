#!/bin/sh
# Generate runtime config from Docker environment variables.
# The app fetches /config.json at startup to read Firebase config.
# For local dev, import.meta.env (from .env) is used as fallback.
cat <<EOF > /usr/share/nginx/html/config.json
{
  "ENVIRONMENT_NAME": "${ENVIRONMENT_NAME:-}",
  "FIREBASE_API_KEY": "${FIREBASE_API_KEY:-}",
  "FIREBASE_AUTH_DOMAIN": "${FIREBASE_AUTH_DOMAIN:-}",
  "FIREBASE_PROJECT_ID": "${FIREBASE_PROJECT_ID:-}",
  "FIREBASE_STORAGE_BUCKET": "${FIREBASE_STORAGE_BUCKET:-}",
  "FIREBASE_MESSAGING_SENDER_ID": "${FIREBASE_MESSAGING_SENDER_ID:-}",
  "FIREBASE_APP_ID": "${FIREBASE_APP_ID:-}"
}
EOF

exec nginx -g 'daemon off;'
