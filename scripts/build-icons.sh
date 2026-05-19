#!/usr/bin/env bash
#
# Regenerate the platform icon files from build/icon.svg.
#
# Outputs:
#   build/icon.png   - 512x512 master PNG (electron-builder fallback)
#   build/icon.icns  - macOS icon bundle
#   build/icon.ico   - Windows icon bundle
#   build/icons/*    - Linux: PNGs at standard hicolor sizes (16-512px)
#
# Linux desktops only scan canonical hicolor icon sizes (16, 22, 24, 32, 48,
# 64, 96, 128, 256, 512). If we ship a single 1024x1024 PNG, electron-builder
# installs it to /usr/share/icons/hicolor/1024x1024/ which no desktop looks at.
# Providing the build/icons/ directory with standard sizes makes electron-
# builder install one PNG per canonical size, so the icon actually shows up.
#
# Requires: macOS (uses qlmanage). Pulls in icon-gen via npx for ICNS + ICO.
#
set -euo pipefail

SVG="build/icon.svg"
BUILD="build"
ICONS_DIR="$BUILD/icons"

if [ ! -f "$SVG" ]; then
  echo "Source SVG not found: $SVG" >&2
  exit 1
fi

echo "Rendering SVG -> 1024x1024 master PNG..."
qlmanage -t -s 1024 "$SVG" -o /tmp >/dev/null 2>&1
MASTER=/tmp/icon.svg.png

echo "Generating Linux icons (build/icons/)..."
rm -rf "$ICONS_DIR"
mkdir -p "$ICONS_DIR"
for size in 16 32 48 64 128 256 512; do
  sips -Z "$size" "$MASTER" --out "$ICONS_DIR/${size}x${size}.png" >/dev/null
done

echo "Generating build/icon.png (512x512 fallback)..."
sips -Z 512 "$MASTER" --out "$BUILD/icon.png" >/dev/null

echo "Generating ICNS and ICO via icon-gen..."
TMP_OUT=$(mktemp -d)
trap 'rm -rf "$TMP_OUT" "$MASTER"' EXIT
npx -y icon-gen -i "$SVG" -o "$TMP_OUT" --ico --icns >/dev/null
mv "$TMP_OUT/app.icns" "$BUILD/icon.icns"
mv "$TMP_OUT/app.ico" "$BUILD/icon.ico"

echo
echo "Generated:"
ls -la "$BUILD/icon.png" "$BUILD/icon.icns" "$BUILD/icon.ico"
echo
ls -la "$ICONS_DIR/"
