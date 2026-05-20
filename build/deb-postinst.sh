#!/bin/sh
# Wadsworth .deb post-install.
#
# Installs a launcher at /usr/bin/wadsworth that forces the X11 Ozone backend.
# Electron picks its Ozone platform during early startup — before any app
# JavaScript runs — so it can't be set from inside the app. Some Wayland
# compositors (notably Cosmic) hang Electron's window creation. The launcher
# passes --ozone-platform=x11 as a real startup argument; XWayland is reliable
# everywhere. An explicit --ozone-platform argument is passed through untouched.
set -e

LAUNCHER=/usr/bin/wadsworth
DESKTOP=/usr/share/applications/wadsworth.desktop

# /usr/bin/wadsworth is normally a symlink to the real binary. Remove it first:
# writing through the symlink would clobber the real Electron binary.
rm -f "$LAUNCHER"

cat > "$LAUNCHER" <<'LAUNCH'
#!/bin/sh
# Force the X11 Ozone backend unless a platform was explicitly requested.
for arg in "$@"; do
  case "$arg" in
    --ozone-platform=* | --ozone-platform-hint=*)
      exec /opt/Wadsworth/wadsworth "$@" ;;
  esac
done
exec /opt/Wadsworth/wadsworth --ozone-platform=x11 "$@"
LAUNCH
chmod 755 "$LAUNCHER"

# Route menu launches through the launcher too.
if [ -f "$DESKTOP" ]; then
  sed -i 's|^Exec=.*|Exec=/usr/bin/wadsworth %U|' "$DESKTOP"
fi

# Refresh desktop/icon caches (no-ops if the tools are absent).
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true

exit 0
