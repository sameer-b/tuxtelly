# Publication and release preparation

Publishing the source and distributing a stable app release are separate actions.
The project is a development preview; keep the compatibility limits in
[acceptance](acceptance.md) visible when publishing it.

## Before making the repository public

Run `pnpm format:check`, `pnpm check`, and `pnpm test:firefox`, and confirm the
GitHub Check workflow passes on the exact commit to be published. The opt-in
`pnpm test:youtube` probes one signed-out public video and is not a DRM or
account-provider acceptance test.

Scan all branches and history for secrets, as well as PR content, Actions logs,
and downloadable artifacts. Inspect screenshots for personal information. Keep
`.env.local`, Firefox profiles, signed packages, and local logs under the existing
ignore rules. Never upload a browser profile as a CI artifact.

Commit author names and email addresses will be public along with history. The
maintainer has accepted the existing public GitHub email. Older commits retain
reference-machine documentation; the current instructions use portable paths.

## Security reporting after publication

[SECURITY.md](../SECURITY.md) provides an email contact immediately. GitHub’s
private vulnerability reporting is available for public repositories, so enable
it after the repository visibility changes:

```sh
gh api --method PUT repos/sameer-b/tuxtelly/private-vulnerability-reporting
gh api repos/sameer-b/tuxtelly/private-vulnerability-reporting --jq .enabled
```

Verify that the second command prints `true` and that the repository’s Security
tab offers **Report a vulnerability**. Subscribe to security alerts so reports
reach the maintainer. See [GitHub’s configuration guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Before distributing an app release

- Use a new version consistently in the root package, extension package, and
  `packages/core/src/index.ts`.
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

An automatic update feed is not configured yet. Publishing this repository alone
does not enable automatic updates in already-installed extensions.
