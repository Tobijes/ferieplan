#!/bin/sh
# Generate runtime config, then delegate to nginx's entrypoint (template processing + start).
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

exec /docker-entrypoint.sh nginx -g 'daemon off;'
