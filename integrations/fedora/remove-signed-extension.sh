#!/usr/bin/env bash
# Remove only TuxTelly's managed Firefox policy entry and signed package.
set -euo pipefail
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  exec sudo -- "$0"
fi
policy_file="/etc/firefox/policies/policies.json"
python3 - "$policy_file" "tuxtelly@sameer-b.github.io" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
extension_id = sys.argv[2]
if not path.exists():
    raise SystemExit(0)
document = json.loads(path.read_text())
settings = document.get("policies", {}).get("ExtensionSettings", {})
settings.pop(extension_id, None)
temporary = path.with_suffix(".json.tmp")
temporary.write_text(json.dumps(document, indent=2) + "\n")
temporary.chmod(0o644)
temporary.replace(path)
PY
rm -f /usr/local/share/tuxtelly/tuxtelly.xpi
echo "Removed TuxTelly policy entry and package. Restart Firefox to finish removal."
