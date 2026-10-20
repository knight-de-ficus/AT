#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="${NODE_VERSION:-$(node -p 'process.versions.node')}"
machine="$(uname -m)"
case "$machine" in
  x86_64) node_arch="x64" ;;
  aarch64|arm64) node_arch="arm64" ;;
  *) echo "Unsupported architecture: $machine" >&2; exit 1 ;;
esac

cd "$ROOT_DIR"
npm ci
npm run build
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
bundle="$stage/at"
mkdir -p "$bundle/app" "$bundle/runtime"
cp -R dist package.json package-lock.json LICENSE "$bundle/app/"
npm ci --omit=dev --ignore-scripts --prefix "$bundle/app"
archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
curl --fail --location "https://nodejs.org/dist/v${NODE_VERSION}/${archive}" --output "$stage/$archive"
tar -xJf "$stage/$archive" --strip-components=1 -C "$bundle/runtime"
cp scripts/offline-start.sh "$bundle/start.sh"
chmod +x "$bundle/start.sh"
mkdir -p artifacts
output="artifacts/at-linux-${node_arch}-offline.tar.gz"
tar -czf "$output" -C "$stage" at
echo "Created $ROOT_DIR/$output"

