import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const destination = resolve("artifacts");
await mkdir(destination, { recursive: true });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
execFileSync("tar", [
  "--no-xattrs",
  "-czf",
  `${destination}/tuxtelly-launcher-${version}.tar.gz`,
  "-C",
  "apps/launcher/dist",
  ".",
]);
// Development package only: normal Firefox release installations require Mozilla signing.
// zip updates existing archives; remove the old one to avoid shipping deleted files.
await rm(`${destination}/tuxtelly-extension-${version}-unsigned.zip`, {
  force: true,
});
execFileSync(
  "zip",
  ["-qr", `${destination}/tuxtelly-extension-${version}-unsigned.zip`, "."],
  { cwd: "apps/extension/.output/firefox-mv3" },
);
const files = (await readdir(destination)).filter(
  (name) => name.endsWith(".tar.gz") || name.endsWith("-unsigned.zip"),
);
const checksums = await Promise.all(
  files.map(
    async (name) =>
      `${createHash("sha256")
        .update(await readFile(`${destination}/${name}`))
        .digest("hex")}  ${name}`,
  ),
);
await writeFile(`${destination}/SHA256SUMS`, checksums.join("\n") + "\n");
console.log(files.join("\n"));
