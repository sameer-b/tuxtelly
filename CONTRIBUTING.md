# Contributing to TuxTelly

Use Node.js 24 LTS and pnpm 12.11.2. Install with `pnpm install --frozen-lockfile`.
Run `pnpm format`, `pnpm check`, and `pnpm test:firefox` before submitting changes.

Keep launcher, extension, and protocol changes together in this monorepo. Add
tests for meaningful input, permission, navigation, and tab-lifecycle behavior.
Adapter changes should include a fixture regression or documented manual flow
and accurately describe the provider/browser variants tested.

Do not commit Firefox profiles, provider credentials, cookies, personal browsing
data, or screenshots of private account details. Adapter code ships in the
extension; configuration imports must not introduce executable code.

Tests use generated media. Include provenance and compatible licensing for new
assets. Describe any user-visible limitation in the compatibility documentation.
