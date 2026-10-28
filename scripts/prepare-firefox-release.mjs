import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  createFirefoxUpdateManifest,
  FIREFOX_UPDATE_URL,
} from "./firefox-update-manifest.mjs";

const tag = process.env.RELEASE_TAG;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
  throw new Error("RELEASE_TAG must be a stable vX.Y.Z version.");

const version = tag.slice(1);
const [rootPackage, extensionPackage, core, manifest] = await Promise.all([
  readFile("package.json", "utf8").then(JSON.parse),
  readFile("apps/extension/package.json", "utf8").then(JSON.parse),
  readFile("packages/core/src/index.ts", "utf8"),
  readFile("apps/extension/.output/firefox-mv3/manifest.json", "utf8").then(
    JSON.parse,
  ),
]);
const coreVersion = core.match(/export const VERSION = "([^"]+)"/)?.[1];
if (
  [
    rootPackage.version,
    extensionPackage.version,
    coreVersion,
    manifest.version,
  ].some((item) => item !== version)
)
  throw new Error(
    `Release ${tag} does not match all built extension versions.`,
  );

const id = manifest.browser_specific_settings?.gecko?.id;
const updateUrl = manifest.browser_specific_settings?.gecko?.update_url;
if (id !== "tuxtelly@sameer-b.github.io")
  throw new Error(`Unexpected Firefox add-on ID: ${id}`);
if (updateUrl !== FIREFOX_UPDATE_URL)
  throw new Error("The Firefox update URL is missing or unexpected.");

const signedDirectory = resolve("artifacts/signed");
const signedFiles = (await readdir(signedDirectory)).filter((file) =>
  file.endsWith(".xpi"),
);
if (signedFiles.length !== 1)
  throw new Error(
    `Expected one Mozilla-signed XPI; found ${signedFiles.length}.`,
  );

const xpi = signedFiles[0];
const xpiPath = join(signedDirectory, xpi);
const signatureFiles = execFileSync("unzip", ["-Z1", xpiPath], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => /^META-INF\/mozilla.*\.rsa$/i.test(file));
if (!signatureFiles.length)
  throw new Error("The XPI does not contain a Mozilla signature.");
const signedManifest = JSON.parse(
  execFileSync("unzip", ["-p", xpiPath, "manifest.json"], {
    encoding: "utf8",
  }),
);
if (
  signedManifest.version !== version ||
  signedManifest.browser_specific_settings?.gecko?.id !== id ||
  signedManifest.browser_specific_settings?.gecko?.update_url !== updateUrl
)
  throw new Error(
    "The signed XPI metadata does not match the release manifest.",
  );

const hash = createHash("sha256")
  .update(await readFile(xpiPath))
  .digest("hex");
const update = createFirefoxUpdateManifest({
  version,
  tag,
  id,
  xpiFilename: xpi,
  sha256: hash,
  strictMinVersion: manifest.browser_specific_settings.gecko.strict_min_version,
});

const output = resolve("artifacts/release");
await mkdir(output, { recursive: true });
await writeFile(join(output, basename(xpi)), await readFile(xpiPath));
await writeFile(
  join(output, "updates.json"),
  `${JSON.stringify(update, null, 2)}\n`,
);
await writeFile(join(output, "SHA256SUMS"), `${hash}  ${xpi}\n`);
console.log(
  `Prepared signed Firefox release ${tag} with update manifest for ${id}.`,
);
