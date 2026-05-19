#!/usr/bin/env bash
#
# Regenerate the platform icon files from build/icon.svg.
#
# Outputs:
#   build/icon.png   - 512x512 master PNG (electron-builder fallback)
#   build/icon.icns  - macOS icon bundle
#   build/icon.ico   - Windows icon bundle
#   build/icons/*    - Linux: PNGs at standard hicolor sizes
#
# All rasterization goes through icon-gen, which preserves alpha. Earlier
# versions used qlmanage + sips, but qlmanage flattens SVGs against a white
# background, so the rounded-corner pixels in the output PNGs were opaque
# white instead of transparent — visible as white square halos around the
# icon on Linux desktops that paint icons on a non-white background.
#
# Linux desktops only scan canonical hicolor icon sizes (16, 22, 24, 32, 48,
# 64, 96, 128, 256, 512). Providing build/icons/ with PNGs at each canonical
# size lets electron-builder install them where desktops actually look.
#
set -euo pipefail

SVG="build/icon.svg"
BUILD="build"
ICONS_DIR="$BUILD/icons"

if [ ! -f "$SVG" ]; then
  echo "Source SVG not found: $SVG" >&2
  exit 1
fi

TMP_OUT=$(mktemp -d)
trap 'rm -rf "$TMP_OUT"' EXIT

echo "Generating PNGs, ICNS, and ICO via icon-gen..."
npx -y icon-gen -i "$SVG" -o "$TMP_OUT" \
  --ico --icns \
  --favicon --favicon-png-sizes 16,32,48,64,128,256,512 \
  >/dev/null

# Linux icons at standard hicolor sizes
rm -rf "$ICONS_DIR"
mkdir -p "$ICONS_DIR"
for size in 16 32 48 64 128 256 512; do
  cp "$TMP_OUT/favicon-${size}.png" "$ICONS_DIR/${size}x${size}.png"
done

# 512x512 master PNG as the electron-builder fallback
cp "$TMP_OUT/favicon-512.png" "$BUILD/icon.png"

# macOS and Windows
mv "$TMP_OUT/app.icns" "$BUILD/icon.icns"
mv "$TMP_OUT/app.ico" "$BUILD/icon.ico"

echo
echo "Generated:"
ls -la "$BUILD/icon.png" "$BUILD/icon.icns" "$BUILD/icon.ico"
echo
ls -la "$ICONS_DIR/"
