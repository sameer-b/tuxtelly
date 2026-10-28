#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
if [[ $# -ne 1 || ! -f "$1" || "$1" != *.xpi ]]; then
  echo "Usage: $0 /path/to/Mozilla-signed-tuxtelly.xpi" >&2
  exit 2
fi
if ! command -v rpmbuild >/dev/null; then
  echo "rpmbuild is required (install the Fedora rpm-build package)." >&2
  exit 1
fi

version="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$repo_root/package.json")"
python3 - "$1" "$version" <<'PY'
import json, sys, zipfile
archive, expected_version = sys.argv[1:]
with zipfile.ZipFile(archive) as xpi:
    names = {name.lower() for name in xpi.namelist()}
    if not any(name.startswith("meta-inf/mozilla.") and name.endswith(".rsa") for name in names):
        raise SystemExit("The XPI does not appear Mozilla-signed (missing META-INF/mozilla*.rsa).")
    manifest = json.loads(xpi.read("manifest.json"))
    gecko_id = manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id")
    if gecko_id != "tuxtelly@sameer-b.github.io":
        raise SystemExit(f"Unexpected extension ID: {gecko_id!r}")
    if manifest.get("version") != expected_version:
        raise SystemExit(f"XPI version {manifest.get('version')!r} does not match project version {expected_version!r}.")
PY
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
top="$tmp/rpmbuild"
mkdir -p "$top"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
install -m 0644 "$1" "$top/SOURCES/tuxtelly.xpi"
install -m 0755 "$repo_root/integrations/linux/tuxtelly" "$top/SOURCES/tuxtelly"
install -m 0755 "$repo_root/integrations/linux/policy.py" "$top/SOURCES/policy.py"
install -m 0644 "$repo_root/integrations/linux/tuxtelly.desktop" "$top/SOURCES/tuxtelly.desktop"
install -m 0644 "$repo_root/LICENSE" "$top/SOURCES/LICENSE"
sed "s/@VERSION@/$version/g" "$repo_root/integrations/linux/tuxtelly.spec.in" >"$top/SPECS/tuxtelly.spec"
rpmbuild --define "_topdir $top" -bb "$top/SPECS/tuxtelly.spec"
mkdir -p "$repo_root/artifacts"
cp "$top"/RPMS/noarch/*.rpm "$repo_root/artifacts/"
echo "Built $(basename "$repo_root"/artifacts/tuxtelly-*.rpm)"
