#!/usr/bin/env bash
# Configure Firefox's enterprise policy to install a signed TuxTelly XPI.
# This is system-wide policy (all Firefox profiles); it never disables signing.
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" || "$1" != *.xpi ]]; then
  echo "Usage: $0 /path/to/Mozilla-signed-tuxtelly.xpi" >&2
  exit 2
fi
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  exec sudo -- "$0" "$1"
fi

extension_id="tuxtelly@sameer-b.github.io"
install_dir="/usr/local/share/tuxtelly"
install_xpi="$install_dir/tuxtelly.xpi"
policy_dir="/etc/firefox/policies"
policy_file="$policy_dir/policies.json"
backup_file="$policy_dir/policies.json.pre-tuxtelly"
mkdir -p "$install_dir" "$policy_dir"
install -m 0644 "$1" "$install_xpi"
if [[ -f "$policy_file" && ! -f "$backup_file" ]]; then
  cp -a "$policy_file" "$backup_file"
fi

python3 - "$policy_file" "$extension_id" "$install_xpi" <<'PY'
import json, pathlib, re, subprocess, sys
policy_path, extension_id, xpi_path = sys.argv[1:]
path = pathlib.Path(policy_path)
document = json.loads(path.read_text()) if path.exists() else {"policies": {}}
policies = document.setdefault("policies", {})
settings = policies.setdefault("ExtensionSettings", {})
version = subprocess.run(
    ["firefox", "--version"], capture_output=True, text=True, check=False
).stdout
match = re.search(r"Firefox\s+(\d+)", version)
major = int(match.group(1)) if match else 0
extension = {"installation_mode": "normal_installed"}
if major >= 151:
    extension["update_url"] = (
        "https://github.com/sameer-b/tuxtelly/releases/latest/download/updates.json"
    )
if major < 158:
    extension["install_url"] = pathlib.Path(xpi_path).as_uri()
settings[extension_id] = extension
temporary = path.with_suffix(".json.tmp")
temporary.write_text(json.dumps(document, indent=2) + "\n")
temporary.chmod(0o644)
temporary.replace(path)
PY

echo "Installed signed TuxTelly XPI and configured Firefox policy."
echo "Restart Firefox to install or update it. The policy applies to every Firefox profile."
echo "To undo, remove the TuxTelly entry from $policy_file and remove $install_xpi."
