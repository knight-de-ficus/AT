#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${AT_RUNTIME_DIR:-$HOME/.local/share/at-runtime}"
NODE_VERSION="${NODE_VERSION:-22.20.0}"

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  machine="$(uname -m)"
  case "$machine" in
    x86_64) node_arch="x64" ;;
    aarch64|arm64) node_arch="arm64" ;;
    *) echo "Unsupported architecture: $machine" >&2; exit 1 ;;
  esac
  mkdir -p "$RUNTIME_DIR"
  archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${archive}"
  echo "Downloading Node.js ${NODE_VERSION}..."
  curl --fail --location "$url" --output "/tmp/${archive}"
  tar -xJf "/tmp/${archive}" --strip-components=1 -C "$RUNTIME_DIR"
  rm -f "/tmp/${archive}"
  export PATH="$RUNTIME_DIR/bin:$PATH"
fi

cd "$ROOT_DIR"
npm ci
npm run build
echo
echo "Installation complete. Start with:"
echo "  cd $ROOT_DIR && PORT=4174 npm start"

