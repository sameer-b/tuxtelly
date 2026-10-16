#!/usr/bin/env bash
# Run TuxTelly's bundled Firefox home in a separate profile.
set -euo pipefail
preview_dir="${1:-$(cd -- "$(dirname -- "$0")" && pwd)}"
preview_profile="${XDG_DATA_HOME:-$HOME/.local/share}/tuxtelly-preview/profile"
if [[ ! -f "$preview_dir/extension/manifest.json" ]]; then
  echo "Usage: $0 /path/to/unpacked-preview (must contain extension/)" >&2
  exit 1
fi
command -v firefox >/dev/null
mkdir -p "$preview_profile"
printf 'In about:debugging, load this temporary add-on:\n%s/extension/manifest.json\n' "$preview_dir"
printf 'Then click TuxTelly in Firefox Extensions to open its bundled Home.\n'
firefox --no-remote --profile "$preview_profile" 'about:debugging#/runtime/this-firefox'
