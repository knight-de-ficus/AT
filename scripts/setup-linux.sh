#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() { printf 'AT setup error: %s\n' "$1" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail "Node.js is missing. Install Node.js 20 or newer, then rerun this command."
command -v npm >/dev/null 2>&1 || fail "npm is missing. Install npm for the current Node.js runtime, then rerun this command."
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$node_major" -ge 20 ] || fail "Node.js $(node -v) is too old. Version 20 or newer is required."
[ -f "$ROOT_DIR/package-lock.json" ] || fail "package-lock.json is missing; the source checkout is incomplete."

cd "$ROOT_DIR"
echo "[1/3] Installing locked JavaScript dependencies..."
if [ "${AT_OFFLINE:-0}" = "1" ]; then
  npm ci --offline || fail "The npm cache does not contain every dependency. Use the release offline bundle instead."
else
  npm ci
fi
echo "[2/3] Building frontend and backend..."
npm run build
echo "[3/3] Starting AT..."
bash scripts/atctl.sh restart
echo "AT is ready at http://127.0.0.1:${PORT:-4174}"

