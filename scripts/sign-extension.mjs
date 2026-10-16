import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const apiKey = process.env.WEB_EXT_API_KEY;
const apiSecret = process.env.WEB_EXT_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error(
    "Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET from your Mozilla Add-ons developer account.",
  );
  process.exit(2);
}
const artifacts = resolve("artifacts/signed");
await mkdir(artifacts, { recursive: true });
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "web-ext",
    "sign",
    "--channel=unlisted",
    `--api-key=${apiKey}`,
    `--api-secret=${apiSecret}`,
    `--source-dir=${resolve("apps/extension/.output/firefox-mv3")}`,
    `--artifacts-dir=${artifacts}`,
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
