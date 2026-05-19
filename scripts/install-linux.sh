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

API_TMP=$(mktemp)
TMP_DEB=""
trap 'rm -f "$API_TMP" "$TMP_DEB"' EXIT

echo "Looking up the latest Wadsworth release..."
HTTP_CODE=$(
  curl -sSL -o "$API_TMP" -w "%{http_code}" \
    "https://api.github.com/repos/$REPO/releases/latest"
)

if [ "$HTTP_CODE" = "404" ]; then
  echo "No 'latest' release found for $REPO." >&2
  echo >&2
  echo "GitHub's 'latest release' excludes drafts and pre-releases. If the" >&2
  echo "release you want is currently marked as a pre-release, edit it on" >&2
  echo "GitHub and check 'Set as the latest release'." >&2
  echo >&2
  echo "See https://github.com/$REPO/releases for the list." >&2
  exit 1
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "GitHub API returned HTTP $HTTP_CODE" >&2
  exit 1
fi

# `|| true` keeps set -e + pipefail from killing the script when grep finds
# no matching .deb (e.g. arm64 .deb isn't available yet). Without this, the
# script exits silently with no error before reaching the helpful message
# below.
ASSET_URL=$(
  { grep "browser_download_url.*_${DEB_ARCH}\.deb\"" "$API_TMP" || true; } |
    head -1 |
    cut -d '"' -f 4
)

if [ -z "$ASSET_URL" ]; then
  echo "No .deb asset for $DEB_ARCH in the latest release." >&2
  echo >&2
  echo "Available assets:" >&2
  grep -o '"name": "[^"]*\.deb"' "$API_TMP" | cut -d '"' -f 4 | sed 's/^/  /' >&2 || true
  echo >&2
  echo "See https://github.com/$REPO/releases for the full list." >&2
  exit 1
fi

TMP_DEB=$(mktemp --suffix=.deb)

echo "Downloading $ASSET_URL"
curl -fsSL -o "$TMP_DEB" "$ASSET_URL"

echo "Installing (you may be prompted for your sudo password)..."
sudo apt install -y "$TMP_DEB"

echo
echo "Installed. Launch Wadsworth from your application menu or run: wadsworth"
