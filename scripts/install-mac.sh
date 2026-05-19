#!/usr/bin/env bash
set -euo pipefail

bash "$(dirname "$0")/build-mac.sh"

# Find the built .app. Its parent directory depends on whether the target arch
# matches process.arch: dist/mac/ when they match, dist/mac-arm64/ or
# dist/mac-x64/ when cross-building.
APP=$(find dist -maxdepth 2 -name 'Wadsworth.app' -type d | head -1)
if [ -z "$APP" ]; then
  echo "Could not find Wadsworth.app in dist/" >&2
  exit 1
fi

# Ad-hoc sign so macOS doesn't keep revalidating on every launch. electron-builder
# skips signing when no Developer ID is present, which makes Gatekeeper treat the
# app as untrusted and adds significant runtime overhead on Apple Silicon.
echo "Ad-hoc signing $APP..."
codesign --force --deep --sign - "$APP"

echo "Installing to /Applications/Wadsworth.app..."
rm -rf /Applications/Wadsworth.app
ditto "$APP" /Applications/Wadsworth.app

echo "Installed to /Applications/Wadsworth.app"
