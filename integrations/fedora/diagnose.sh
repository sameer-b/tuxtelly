#!/usr/bin/env bash
# Read-only checks. Does not inspect browser profiles, cookies, credentials, or history.
set -u
printf 'TuxTelly Fedora preflight\n\n'
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  printf 'OS: %s\n' "${PRETTY_NAME:-unknown}"
fi
printf 'Architecture: %s\n' "$(uname -m)"
printf 'Desktop: %s\nSession type: %s\n' "${XDG_CURRENT_DESKTOP:-unknown}" "${XDG_SESSION_TYPE:-unknown (run from a KDE terminal)}"
if command -v firefox >/dev/null; then firefox --version; else printf 'Firefox is not on PATH. Check whether it is installed as a Flatpak.\n'; fi
if command -v flatpak >/dev/null; then flatpak list --app --columns=application,version | awk 'tolower($0) ~ /firefox/' || true; fi
if command -v wpctl >/dev/null; then wpctl get-volume @DEFAULT_AUDIO_SINK@ || true; else printf 'wpctl is unavailable.\n'; fi
if command -v free >/dev/null; then free -h; fi
printf '\nManual checks:\n'
printf '  1. In Firefox settings, enable Play DRM-controlled content.\n'
printf '  2. Check about:support for graphics and media capability.\n'
printf '  3. Play a title on each provider and record success/quality.\n'
printf '  4. Use TuxTelly Remote to capture actual remote buttons.\n'
printf '  5. Verify HDMI audio, fullscreen, and resume after suspend.\n'
