#!/usr/bin/env bash
#
# Installs the latest published release of Wadsworth on Debian/Ubuntu and
# derivatives.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/paradebk/wadsworth/main/scripts/install-linux.sh | bash
#
# To uninstall later: sudo apt remove wadsworth
#
set -euo pipefail

REPO="paradebk/wadsworth"

# Map kernel arch to Debian's arch naming used in the .deb filename.
case "$(uname -m)" in
  x86_64) DEB_ARCH="amd64" ;;
  aarch64 | arm64) DEB_ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

for cmd in curl sudo apt; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    echo "This installer is for Debian-based systems (Debian, Ubuntu, Mint, etc.)." >&2
    exit 1
  fi
done

echo "Looking up the latest Wadsworth release..."
ASSET_URL=$(
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
    grep "browser_download_url.*_${DEB_ARCH}\.deb\"" |
    head -1 |
    cut -d '"' -f 4
)

if [ -z "$ASSET_URL" ]; then
  echo "Could not find a .deb asset for $DEB_ARCH in the latest release." >&2
  echo "See https://github.com/$REPO/releases for available downloads." >&2
  exit 1
fi

TMP_DEB=$(mktemp --suffix=.deb)
trap 'rm -f "$TMP_DEB"' EXIT

echo "Downloading $ASSET_URL"
curl -fsSL -o "$TMP_DEB" "$ASSET_URL"

echo "Installing (you may be prompted for your sudo password)..."
sudo apt install -y "$TMP_DEB"

echo
echo "Installed. Launch Wadsworth from your application menu or run: wadsworth"
