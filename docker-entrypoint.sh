#!/bin/sh
# Inject deployment configuration into the pre-built bundle at container start.
#
# Vite resolves import.meta.env.* at build time, so a naively built image would
# hardcode one deployment's API URL and Auth0 tenant. Instead the image is built
# with sentinel placeholders, and this script substitutes the real values here,
# which lets a single published image serve any deployment.
set -eu

subst() {
  placeholder="$1"
  value="$2"
  # '|' is not valid in any of these values, so it is a safe sed delimiter.
  find /app/dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
    -exec sed -i "s|${placeholder}|${value}|g" {} +
}

subst "__OSW_API_URI__"          "${VITE_OSWATCHER_API_URI:-http://localhost:4000/}"
subst "__OSW_AUTH0_DOMAIN__"     "${VITE_AUTH0_DOMAIN:-}"
subst "__OSW_AUTH0_CLIENT_ID__"  "${VITE_AUTH0_CLIENT_ID:-}"
subst "__OSW_AUTH0_AUDIENCE__"   "${VITE_AUTH0_AUDIENCE:-}"

exec "$@"
