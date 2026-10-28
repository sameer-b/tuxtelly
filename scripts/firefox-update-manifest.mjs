export const FIREFOX_UPDATE_URL =
  "https://github.com/sameer-b/tuxtelly/releases/latest/download/updates.json";

export function createFirefoxUpdateManifest({
  version,
  tag,
  id,
  xpiFilename,
  sha256,
  strictMinVersion,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`)
    throw new Error("A stable vX.Y.Z tag must match the extension version.");
  if (id !== "tuxtelly@sameer-b.github.io")
    throw new Error("Unexpected Firefox add-on ID.");
  if (
    !xpiFilename ||
    xpiFilename !== xpiFilename.split(/[\\/]/).pop() ||
    !xpiFilename.endsWith(".xpi")
  )
    throw new Error("The signed XPI filename must be a simple .xpi filename.");
  if (!/^[a-f0-9]{64}$/i.test(sha256))
    throw new Error("The signed XPI must have a valid SHA-256 hash.");
  if (!strictMinVersion)
    throw new Error("A Firefox minimum version is required.");

  return {
    addons: {
      [id]: {
        updates: [
          {
            version,
            update_link: `https://github.com/sameer-b/tuxtelly/releases/download/${tag}/${encodeURIComponent(xpiFilename)}`,
            update_hash: `sha256:${sha256.toLowerCase()}`,
            applications: { gecko: { strict_min_version: strictMinVersion } },
          },
        ],
      },
    },
  };
}
