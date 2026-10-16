# Security reporting

For security issues, use GitHub's private vulnerability reporting feature if
enabled for this repository. Do not put credentials or exploit details in a
public issue. A dedicated public reporting contact will be established before
the first public release.

The preview is under active development and has not undergone an independent
security audit. Its intended boundaries are optional per-host access, exact
origin/path checks for the hosted launcher, managed-tab checks for provider
commands, and settings changes restricted to extension-owned pages.

Streaming authentication stays with the provider in Firefox. Configuration
exports do not contain provider credentials or cookies.
