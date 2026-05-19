#!/usr/bin/env bash
set -euo pipefail

# Detect the real hardware architecture. uname -m and sysctl hw.machine both
# lie under Rosetta (they report the process arch, not the hardware). The
# hw.optional.arm64 flag is the only reliable signal: 1 on Apple Silicon, 0
# on Intel, regardless of whether the calling process is translated.
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  ARCH_FLAG="--arm64"
else
  ARCH_FLAG="--x64"
fi

echo "Building Wadsworth for macOS ($ARCH_FLAG)..."
electron-vite build
electron-builder --mac "$ARCH_FLAG"
