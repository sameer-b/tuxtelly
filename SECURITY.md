# Security reporting

Report security issues privately to [bs.sameer1@gmail.com](mailto:bs.sameer1@gmail.com)
with the subject **TuxTelly security report**. You can also use
[GitHub’s private vulnerability form](https://github.com/sameer-b/tuxtelly/security/advisories/new)
when it is available. If that page is unavailable, use email.

Include the affected TuxTelly and Firefox versions, reproduction steps using a
test profile, expected impact, and any suggested fix. Omit passwords, API keys,
cookies, browser profiles, and personal viewing data. Do not post exploit
details in a public issue or PR before a fix has been coordinated.

Security fixes target the latest development version. Older preview builds do
not have a separate support branch. The maintainer will respond as availability
allows; this project does not offer a guaranteed response time or a bug bounty.

The preview is under active development and has not undergone an independent
security audit. Its intended boundaries are optional per-host access, exact
origin/path checks for the hosted launcher, managed-tab checks for provider
commands, and settings changes restricted to extension-owned pages.

Streaming authentication stays with the provider in Firefox. Configuration
exports do not contain provider credentials or cookies.
