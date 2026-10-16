# TuxTelly implementation roadmap

Status: **Approved and in progress. Initial preview implemented.**

The confirmed provider order is YouTube, Netflix, Disney+, HBO Max. Implementation
was approved by the project owner. The following phases retain the full release
scope; the initial preview does not satisfy all exit criteria.

## Current progress

- Phase 0: Fedora/Wayland/Firefox environment inspected; isolated browser checks pass.
  Physical remote, HDMI, real accounts, and DRM checks remain pending.
- Phase 1: workspace, MIT license, schemas, build/check tooling, CI workflow,
  catalog/text-entry/video fixtures implemented. Advanced dynamic-row fixtures remain.
- Phase 2: local Home settings, origin permissions, managed tabs, duplicate prevention,
  closed-tab recovery, and bundled local Home implemented and fixture-tested. No runtime
  server is required for one TV. Persistent installation/restart acceptance remains pending.
- Phase 3: generic navigation, remote calibration, configurable keys, switcher,
  pause/mute policy, and HTML video controls implemented. Nine live YouTube public-video
  checks pass, including a regression fix for focused player wrappers. Full YouTube qualification,
  virtualized catalogs, and additional focus restoration remain.
- Phases 4–5: initial provider selector hooks exist; Netflix, Disney+, and HBO Max
  support is unverified and requires account-based implementation/acceptance.
- Phase 6: Fedora diagnostics, local preview script, packaging, and installation
  documentation exist. Extension signing, performance/soak tests, and release
  qualification remain pending; Caddy/LXC is optional for later multi-TV sharing.
- Follow-up Home improvements: pinned services, two-way ordering, last-used resume,
  visible access status, onboarding guidance, action-labeled key mapping, and a
  privacy-limited diagnostic export are implemented. AMO signing and Fedora policy
  install/removal scripts are prepared; credentials and TV-side acceptance remain.

Controlled tests: 22 local unit tests and 19 Firefox integration checks passed
on the reference Fedora laptop. See [acceptance](acceptance.md) for detailed boundaries.

## Phase 0: Prove browser and remote assumptions

- Verify baseline playback for all four providers in ordinary Firefox on the target machine.
- Record Firefox version/packaging, DRM/codecs, display session, and audio output.
- Capture actual remote events, including keys intercepted by KDE and infrared-only buttons.
- Prototype permitted tab switching, YouTube control, fullscreen transitions, and Home recovery.
- Identify a normal Firefox installation path and extension signing dependencies early.

Exit: demonstrate the core interaction loop and document hardware/provider
blockers. Physical remote checks and account login require the actual TV setup.

## Phase 1: Project foundation

- Adopt the project license and establish the pnpm/TypeScript workspace.
- Add launcher and extension build targets, checks, and CI.
- Define configuration schema, migration rules, message protocol, and adapter contract.
- Add local fixtures for catalogs, dynamic rows, dialogs, editable fields, and video.

Exit: reproducible launcher/extension builds, validated communication, and passing
configuration/protocol tests.

## Phase 2: Local Home and tab manager

- Bundled local Home, service CRUD/order, profile persistence, and site-permission setup.
- Lazy tab creation, idempotent launch, existing-tab activation, and restart reconciliation.
- Service switching, extension-command Home, and local bundled recovery.
- Validate imports and handle frontend/extension version mismatches.

Exit: add services in the UI, open each once, switch without duplicates, and retain
settings after Firefox restart.

## Phase 3: Navigation and YouTube

- Input contexts, text-entry protection, calibration, and configurable mappings.
- Generic spatial navigation, focus restoration, modal scopes, and pointer coexistence.
- YouTube navigation, player discovery, playback controls, captions, and fullscreen.
- Switcher and pause/mute policy with result handling.

Exit: browse, search, select, play, seek, adjust volume, use captions, enter
fullscreen, switch services, and return using the remote.

## Phase 4: Netflix

- Profiles, catalog/search, title and episode selection, and Back behavior.
- Player controls, subtitles/audio menus, fullscreen, and selection restoration.
- Real-profile login persistence and DRM playback acceptance testing.

Exit: documented Netflix viewing flow passes using the remote; unsupported
capabilities are explicitly recorded.

## Phase 5: Disney+ and HBO Max

- Provider adapters using the established contracts.
- Test profiles, menus, routes, player changes, localization, and available account variants.
- Publish provider capability results with tested versions and date.

Exit: each provider passes its published acceptance matrix. A service that cannot
play in ordinary Firefox is an external compatibility blocker, not a supported
integration. Do not silently reduce the agreed scope.

## Phase 6: Packaging, deployment, and release qualification

- Complete signed local installation and reversible Fedora/KDE setup documentation.
- Keep Caddy/LXC hosting optional for multi-TV sharing.
- Build release artifacts, checksums, source packages, and upgrade/rollback instructions.
- Prepare a Mozilla-signed extension for normal Firefox installations.
- Validate backup/restore, local profile and extension restart, lost permissions, browser restart, and tab crash recovery.
- Measure latency, CPU/memory, accessibility, and an eight-hour viewing/switching soak.
- Complete contribution, adapter, troubleshooting, and compatibility documentation.

Exit: a clean installation reaches the launcher, preserves configuration and valid
provider sessions across restarts, and passes end-to-end acceptance checks.

Public release/publishing is a separate release action; initial repository
visibility remains private.

## Verification strategy

1. Unit/component and fixture tests: directional decisions, input contexts, repeat
   handling, settings validation/migrations, tab reconciliation, and adapter regressions.
2. Actual Firefox extension integration: permissions, messaging, tabs, focus,
   fullscreen transitions, and recovery using Selenium/WebDriver.
3. Manual hardware/provider acceptance: real accounts, DRM, Rii remote, KDE audio,
   HDMI, suspend/resume, and the complete viewing loop.

Controlled fixtures do not prove provider compatibility or DRM playback.
Chromium extension tests do not prove Firefox extension behavior. Normal Firefox
release installations require signed extensions, including self-distributed ones.

## Definition of done

- Boot the laptop and reach the fullscreen launcher.
- Add a service URL, grant necessary access, and log in directly with the provider.
- Browse and search using the remote, select a title, and begin playback.
- Use available playback, seeking, subtitle, volume, and fullscreen controls.
- Switch services without conflicting audio and return without unnecessary page resets.
- Restart Firefox without losing configuration or creating duplicate service tabs.
- Recover when a provider adapter is unavailable.
- Document actual test results for all four providers on the reference setup.
- Install from documented artifacts without depending on a temporary development extension.

## Current source layout

```text
apps/
  launcher/
  extension/
packages/
  core/
  adapters/
  ui/
tests/
  fixtures/
  firefox/
deploy/
  caddy/
integrations/
  fedora/
docs/
```

## References

- [Mozilla signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Selenium Firefox integration](https://www.selenium.dev/selenium/docs/api/javascript/module-selenium-webdriver_firefox-Driver.html)
- [Playwright extension test scope](https://playwright.dev/docs/chrome-extensions)
