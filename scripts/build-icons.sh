#!/usr/bin/env bash
#
# Regenerate the platform icon files from build/icon.svg.
#
# Outputs:
#   build/icon.png  - 1024x1024 master PNG (Linux + electron-builder fallback)
#   build/icon.icns - macOS icon bundle
#   build/icon.ico  - Windows icon bundle
#
# Requires: macOS (uses qlmanage). Pulls in icon-gen via npx for ICNS + ICO.
#
set -euo pipefail

SVG="build/icon.svg"
BUILD="build"

if [ ! -f "$SVG" ]; then
  echo "Source SVG not found: $SVG" >&2
  exit 1
fi

echo "Rendering SVG -> 1024x1024 PNG..."
qlmanage -t -s 1024 "$SVG" -o /tmp >/dev/null 2>&1
cp /tmp/icon.svg.png "$BUILD/icon.png"
rm -f /tmp/icon.svg.png

echo "Generating ICNS and ICO via icon-gen..."
TMP_OUT=$(mktemp -d)
trap 'rm -rf "$TMP_OUT"' EXIT
npx -y icon-gen -i "$SVG" -o "$TMP_OUT" --ico --icns >/dev/null
mv "$TMP_OUT/app.icns" "$BUILD/icon.icns"
mv "$TMP_OUT/app.ico" "$BUILD/icon.ico"

echo
echo "Generated:"
ls -la "$BUILD/icon.png" "$BUILD/icon.icns" "$BUILD/icon.ico"
