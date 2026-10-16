#!/usr/bin/env bash
# Disable automatic launch. Keep the Firefox profile and provider logins intact.
set -euo pipefail
autostart_file="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/tuxtelly.desktop"
rm -f "$autostart_file"
echo "Removed $autostart_file. The TuxTelly Firefox profile was left intact."
