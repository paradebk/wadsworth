#!/bin/sh
# Wadsworth .deb post-remove. Drops the launcher installed by deb-postinst.sh.
set -e

if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
  rm -f /usr/bin/wadsworth
fi

exit 0
