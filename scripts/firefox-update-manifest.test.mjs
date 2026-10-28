import { describe, expect, it } from "vitest";
import { createFirefoxUpdateManifest } from "./firefox-update-manifest.mjs";

const release = {
  version: "0.2.19",
  tag: "v0.2.19",
  id: "tuxtelly@sameer-b.github.io",
  xpiFilename: "tuxtelly-0.2.19.xpi",
  sha256: "a".repeat(64),
  strictMinVersion: "142.0",
};

describe("Firefox update manifest", () => {
  it("publishes the signed release XPI URL and integrity hash", () => {
    expect(createFirefoxUpdateManifest(release)).toEqual({
      addons: {
        "tuxtelly@sameer-b.github.io": {
          updates: [
            {
              version: "0.2.19",
              update_link:
                "https://github.com/sameer-b/tuxtelly/releases/download/v0.2.19/tuxtelly-0.2.19.xpi",
              update_hash: `sha256:${"a".repeat(64)}`,
              applications: { gecko: { strict_min_version: "142.0" } },
            },
          ],
        },
      },
    });
  });

  it.each([
    { tag: "v0.2.18" },
    { sha256: "not-a-hash" },
    { xpiFilename: "../../unexpected.xpi" },
  ])("rejects invalid release metadata", (invalid) => {
    expect(() =>
      createFirefoxUpdateManifest({ ...release, ...invalid }),
    ).toThrow();
  });
});
