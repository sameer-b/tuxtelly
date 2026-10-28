#!/usr/bin/env python3
"""Add or remove only TuxTelly's managed Firefox extension policy."""
import json
import os
from pathlib import Path
import sys
import tempfile

EXTENSION_ID = "tuxtelly@sameer-b.github.io"


def write_json(path: Path, document: dict, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(document, indent=2, sort_keys=True) + "\n"
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def update(
    policy_path: Path, action: str, xpi_path: Path, state_path: Path | None = None
) -> None:
    if policy_path.exists():
        document = json.loads(policy_path.read_text(encoding="utf-8"))
    else:
        document = {"policies": {}}
    if not isinstance(document, dict):
        raise ValueError("Firefox policy document must be a JSON object")
    policies = document.setdefault("policies", {})
    if not isinstance(policies, dict):
        raise ValueError("Firefox policies entry must be a JSON object")
    settings = policies.setdefault("ExtensionSettings", {})
    if not isinstance(settings, dict):
        raise ValueError("Firefox ExtensionSettings entry must be a JSON object")

    if action == "install":
        if not xpi_path.is_file():
            raise FileNotFoundError(f"Signed TuxTelly XPI not found: {xpi_path}")
        if state_path is not None and not state_path.exists():
            prior_entry = settings.get(EXTENSION_ID)
            write_json(
                state_path,
                {"had_entry": EXTENSION_ID in settings, "entry": prior_entry},
                0o600,
            )
        settings[EXTENSION_ID] = {
            "installation_mode": "normal_installed",
            "install_url": xpi_path.as_uri(),
        }
    elif action == "remove":
        if state_path is not None and state_path.exists():
            previous = json.loads(state_path.read_text(encoding="utf-8"))
            if previous.get("had_entry"):
                settings[EXTENSION_ID] = previous["entry"]
            else:
                settings.pop(EXTENSION_ID, None)
        else:
            settings.pop(EXTENSION_ID, None)
        if not settings:
            policies.pop("ExtensionSettings", None)
        if not policies:
            document.pop("policies", None)
        if not document:
            policy_path.unlink(missing_ok=True)
            return
    else:
        raise ValueError("action must be install or remove")

    write_json(policy_path, document, 0o644)
    if action == "remove" and state_path is not None:
        state_path.unlink(missing_ok=True)
        try:
            state_path.parent.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    if len(sys.argv) not in (4, 5):
        raise SystemExit(
            f"Usage: {sys.argv[0]} install|remove POLICY_JSON XPI [STATE_JSON]"
        )
    state = Path(sys.argv[4]) if len(sys.argv) == 5 else None
    update(Path(sys.argv[2]), sys.argv[1], Path(sys.argv[3]), state)
