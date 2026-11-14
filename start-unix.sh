#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  node scripts/server.mjs
elif command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 5174 --bind 127.0.0.1
else
  echo 'Install Node.js or Python 3, or use another static HTTP server.' >&2
  exit 1
fi
