# Publication and release preparation

Publishing the source and distributing a stable app release are separate actions.
The project is a development preview; keep the compatibility limits in
[acceptance](acceptance.md) visible when publishing it.

## Before each code change

Run `pnpm format:check`, `pnpm check`, and `pnpm test:firefox`, and confirm the
GitHub Check workflow passes on the exact commit. The opt-in
`pnpm test:youtube` probes one signed-out public video and is not a DRM or
account-provider acceptance test.

Scan all branches and history for secrets, as well as PR content, Actions logs,
and downloadable artifacts. Inspect screenshots for personal information. Keep
`.env.local`, Firefox profiles, signed packages, and local logs under the existing
ignore rules. Never upload a browser profile as a CI artifact.

Commit author names and email addresses will be public along with history. The
maintainer has accepted the existing public GitHub email. Older commits retain
older reference-machine documentation; the current instructions use portable paths.

## Private security reporting

[SECURITY.md](../SECURITY.md) provides an email contact immediately. GitHub’s
private vulnerability reporting is enabled. Confirm it remains enabled and that
the repository’s Security tab offers **Report a vulnerability**:

```sh
gh api repos/sameer-b/tuxtelly/private-vulnerability-reporting --jq .enabled
```

The command should print `true`. Subscribe to security alerts so reports reach
the maintainer. See [GitHub’s configuration guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Before distributing an app release

- Use a new version consistently in the root package, extension package, and
  `packages/core/src/index.ts`.
- Push a stable `vX.Y.Z` tag that points to a commit on `main`. GitHub Actions
  checks the tag, runs the full test suite, and submits the XPI for Mozilla
  unlisted signing before it creates a GitHub Release.
- The release contains the Mozilla-signed XPI, `updates.json`, and its SHA-256
  checksum. The permanent Firefox update URL points to
  `releases/latest/download/updates.json`; preserve that release asset name.
- Each release replaces the release's latest `updates.json` asset with the new
  version and XPI URL. The update manifest uses Firefox's standard signed-XPI
  format.
- Store `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` as repository Actions secrets.
  The workflow exposes them only to the Mozilla signing step.
- Build and sign using the [installation guide](installation.md). Keep signing
  credentials in the local environment or repository secrets; never in source,
  command arguments, release notes, or artifacts.
- Test the signed XPI in a dedicated Firefox profile, including updating from
  the previous version and preserving settings. `pnpm package` creates unsigned
  development archives; it does not sign or publish a release.
- Retain the app’s About & credits page, original TMDB logo and disclaimer,
  JustWatch attribution, and wallpaper provenance. TuxTelly’s MIT license covers
  its source code; third-party artwork retains its own terms.
- Publish only deliberately selected release files and checksums. Describe the
  actual tested platforms and remaining provider/hardware limitations.

The update feed is configured in the Firefox manifest and served from the latest
GitHub Release. Updating installations requires one signed bootstrap XPI built
with that update URL; installations of older versions need that version installed
manually once. Publishing source commits alone does not trigger releases; push a
stable version tag to start the release workflow.
