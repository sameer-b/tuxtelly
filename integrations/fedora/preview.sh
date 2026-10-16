#!/usr/bin/env bash
# Run an unpacked preview in a separate profile without changing desktop startup.
set -euo pipefail
preview_dir="${1:-$(cd -- "$(dirname -- "$0")" && pwd)}"
preview_profile="${XDG_DATA_HOME:-$HOME/.local/share}/tuxtelly-preview/profile"
preview_port="${TUXTELLY_PREVIEW_PORT:-8734}"
if [[ ! -f "$preview_dir/launcher/index.html" || ! -f "$preview_dir/extension/manifest.json" ]]; then
  echo "Usage: $0 /path/to/unpacked-preview (must contain launcher/ and extension/)" >&2
  exit 1
fi
command -v firefox >/dev/null
command -v python3 >/dev/null
mkdir -p "$preview_profile"
python3 -m http.server "$preview_port" --bind 127.0.0.1 --directory "$preview_dir/launcher" &
preview_server_pid=$!
trap 'kill "$preview_server_pid" 2>/dev/null || true; wait "$preview_server_pid" 2>/dev/null || true' EXIT
sleep 1
if ! kill -0 "$preview_server_pid" 2>/dev/null; then
  echo "Preview server failed to start; select another TUXTELLY_PREVIEW_PORT." >&2
  exit 1
fi
printf 'Load Temporary Add-on: %s/extension/manifest.json\n' "$preview_dir"
printf 'Save and trust launcher address: http://127.0.0.1:%s/\n' "$preview_port"
firefox --no-remote --profile "$preview_profile" \
  "http://127.0.0.1:$preview_port/" 'about:debugging#/runtime/this-firefox'
