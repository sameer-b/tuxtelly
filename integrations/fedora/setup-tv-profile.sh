#!/usr/bin/env bash
# Create a dedicated Firefox profile and add a reversible KDE login entry.
set -euo pipefail

profile_dir="${XDG_DATA_HOME:-$HOME/.local/share}/tuxtelly/firefox-profile"
autostart_dir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
autostart_file="$autostart_dir/tuxtelly.desktop"
template="$(cd -- "$(dirname -- "$0")" && pwd)/tuxtelly.desktop.example"

command -v firefox >/dev/null || {
  echo "Firefox is not on PATH. Install Firefox, then run this from KDE." >&2
  exit 1
}
if [[ ! -d "$profile_dir" ]]; then
  mkdir -p "$(dirname -- "$profile_dir")"
  firefox --no-remote -CreateProfile "TuxTelly $profile_dir"
fi
mkdir -p "$autostart_dir"
if [[ -e "$autostart_file" ]]; then
  echo "Keeping existing autostart entry: $autostart_file" >&2
  exit 0
fi
install -m 0644 "$template" "$autostart_file"
echo "Created Firefox profile at $profile_dir and KDE autostart entry at $autostart_file."
echo "Start the profile once, install the signed extension, then enable Home-at-startup in TuxTelly settings."
