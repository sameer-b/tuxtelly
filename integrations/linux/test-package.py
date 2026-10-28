#!/usr/bin/env python3
"""Small local tests for the Linux launcher and Firefox policy helper."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "integrations/linux/tuxtelly"
POLICY = ROOT / "integrations/linux/policy.py"


class LinuxPackageTests(unittest.TestCase):
    def test_policy_install_preserves_existing_policies_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            policy = root / "policies.json"
            xpi = root / "tuxtelly.xpi"
            xpi.write_bytes(b"signed-test-xpi")
            original = {"policies": {"DisableAppUpdate": True, "ExtensionSettings": {
                "other@example.org": {"installation_mode": "allowed"},
                "tuxtelly@sameer-b.github.io": {"installation_mode": "allowed", "install_url": "https://old.example/tuxtelly.xpi"},
            }}}
            policy.write_text(json.dumps(original), encoding="utf-8")
            state = root / "var/lib/tuxtelly/policy-backup.json"

            for _ in range(2):
                subprocess.run(["python3", str(POLICY), "install", str(policy), str(xpi), str(state)], check=True)

            actual = json.loads(policy.read_text(encoding="utf-8"))
            self.assertTrue(actual["policies"]["DisableAppUpdate"])
            settings = actual["policies"]["ExtensionSettings"]
            self.assertEqual(settings["other@example.org"]["installation_mode"], "allowed")
            self.assertEqual(settings["tuxtelly@sameer-b.github.io"]["installation_mode"], "normal_installed")
            self.assertEqual(settings["tuxtelly@sameer-b.github.io"]["install_url"], xpi.as_uri())
            self.assertEqual(json.loads(state.read_text(encoding="utf-8"))["entry"], original["policies"]["ExtensionSettings"]["tuxtelly@sameer-b.github.io"])

            subprocess.run(["python3", str(POLICY), "remove", str(policy), str(xpi), str(state)], check=True)
            actual = json.loads(policy.read_text(encoding="utf-8"))
            self.assertEqual(actual, original)
            self.assertFalse(state.exists())

    def test_policy_remove_cleans_up_generated_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            policy = root / "policies.json"
            xpi = root / "tuxtelly.xpi"
            xpi.write_bytes(b"signed-test-xpi")
            state = root / "var/lib/tuxtelly/policy-backup.json"
            subprocess.run(["python3", str(POLICY), "install", str(policy), str(xpi), str(state)], check=True)
            subprocess.run(["python3", str(POLICY), "remove", str(policy), str(xpi), str(state)], check=True)
            self.assertFalse(policy.exists())

    def test_launcher_reuses_profile_and_passes_firefox_arguments(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_firefox = root / "firefox"
            capture = root / "args"
            fake_firefox.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" >\"$CAPTURE_ARGS\"\n",
                encoding="utf-8",
            )
            fake_firefox.chmod(0o755)
            env = os.environ | {
                "HOME": str(root),
                "TUXTELLY_FIREFOX_BIN": str(fake_firefox),
                "CAPTURE_ARGS": str(capture),
                "XDG_DATA_HOME": str(root / "data"),
            }
            subprocess.run([str(LAUNCHER), "--kiosk"], env=env, check=True)
            args = capture.read_text(encoding="utf-8").splitlines()
            profile = str(root / "data/tuxtelly/firefox-profile")
            self.assertEqual(args, ["--no-remote", "--profile", profile, "--kiosk"])
            self.assertTrue(Path(profile).is_dir())
            self.assertEqual(subprocess.check_output([str(LAUNCHER), "--profile-path"], env=env, text=True).strip(), profile)

    def test_launcher_adopts_existing_preview_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy_profile = root / "data/tuxtelly-preview/profile"
            legacy_profile.mkdir(parents=True)
            env = os.environ | {"HOME": str(root), "XDG_DATA_HOME": str(root / "data")}
            output = subprocess.check_output([str(LAUNCHER), "--profile-path"], env=env, text=True).strip()
            self.assertEqual(output, str(legacy_profile))

    def test_autostart_enable_disable_is_user_scoped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = os.environ | {"HOME": str(root), "XDG_CONFIG_HOME": str(root / "config")}
            subprocess.run([str(LAUNCHER), "--enable-autostart"], env=env, check=True, capture_output=True)
            entry = root / "config/autostart/tuxtelly.desktop"
            self.assertIn("Exec=/usr/bin/tuxtelly", entry.read_text(encoding="utf-8"))
            subprocess.run([str(LAUNCHER), "--disable-autostart"], env=env, check=True, capture_output=True)
            self.assertFalse(entry.exists())


if __name__ == "__main__":
    unittest.main()
