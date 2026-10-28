# TuxTelly

Your streaming services, one Linux TV remote.

TuxTelly is an MIT-licensed Linux TV frontend that runs locally in Firefox. Its
companion extension provides the Home screen, service tabs, remote navigation, and
player controls. It needs no web server or PVE container for a single TV. Provider
logins and DRM stay in ordinary Firefox tabs on the TV laptop.

## Project status

**Development preview.** The Firefox extension, signing tools, and experimental
Fedora packaging are implemented. The tag release workflow builds, tests, and
submits signed XPI updates to Mozilla, then publishes the signed extension and
update manifest to GitHub Releases. The first automatic update requires a signed
bootstrap installation; see the [release instructions](docs/publication.md).

The preview includes recent-use service ordering, a last-used resume action,
guided service setup, keyboard mapping and calibration, managed tabs, an in-page
switcher, HTML video controls, optional site
permissions, local config backup, privacy-limited diagnostics, a bundled Home
screen, and local TMDB-powered global search. Search configuration and the TMDB
key stay in the Firefox profile; no server is needed. Peacock is included in the
home service list and global search filters. See
[global search setup](docs/global-search.md).

Automated checks cover configuration, navigation, player controls, permissions,
and service-tab lifecycle. A separate opt-in YouTube probe checks signed-out
public playback, search, controls, and tab switching. Fixture checks do not
establish full provider compatibility.
Prime Video, Netflix, Disney+, HBO Max, Peacock, and signed-in YouTube flows
remain unverified.
See [test status](docs/acceptance.md).

## Try the local preview

Use Node.js 24 LTS and pnpm 12.11.2 to build it:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm check
pnpm test:firefox
pnpm package
```

Load `apps/extension/.output/firefox-mv3/manifest.json` through Firefox's
`about:debugging` temporary add-on loader. Open TuxTelly from Firefox's Extensions
menu; its Home screen is bundled in the extension. Settings, service definitions,
and permissions are stored in that Firefox profile. Grant access only to the
streaming sites you want TuxTelly to control, then sign in on each provider's page.

For a Fedora TV setup, use the [installation instructions](docs/installation.md).
Temporary add-ons disappear when Firefox restarts. Persistent installation needs
a Mozilla-signed extension; the preview package is unsigned. Enable **Open
TuxTelly Home when this Firefox profile starts** in the dedicated TV profile to
open Home at startup; no launcher URL or server startup is needed.

A static launcher that can be served from another machine remains optional for
multi-TV setups. PVE, Caddy, a database, and a Node server are not needed for local
use.

- [Architecture and requirements](docs/project-plan.md)
- [Implementation progress and roadmap](docs/implementation-plan.md)
- [Global search server option analysis](docs/global-search-server-plan.md) (server deferred)
- [Hardware and provider acceptance checklist](docs/acceptance.md)
- [Contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [Publication and release preparation](docs/publication.md)

## Controls

| Action                             | Default            |
| ---------------------------------- | ------------------ |
| Navigate / select in TuxTelly Home | Arrow keys / Enter |
| Service switcher                   | F8                 |
| Home inside a managed service      | Home               |
| Browser-wide recovery Home         | Alt+Shift+H        |
| Play / pause                       | Space or K         |
| Captions / player fullscreen       | C / F              |
| Player mute / volume               | M / + / -          |

Inside streaming services, use the remote’s gyro mouse and each provider’s own
controls. TuxTelly leaves arrow keys to the site. Other bindings can be changed
in Remote settings. System audio keys stay with KDE; player volume is separate
from system volume.
Adding an arbitrary URL provides launch support. Navigation and playback control
depend on the website and require permission plus a compatible adapter.

## Reference test environment

- Fedora 44, KDE Wayland, native Firefox, and an x86-64 laptop.
- A USB air mouse and keyboard remote; physical calibration remains pending.
- One local Firefox profile; optional static hosting only for multiple TVs.
- Provider implementation and testing order: YouTube, Netflix, Disney+, HBO Max,
  then Prime Video.

Home can be opened with the `Home` remote key or Firefox's `Alt+Shift+H` extension
shortcut; `F8` opens the in-page service switcher. Settings explain site access,
provider sign-in, button remapping, and safe diagnostic export. System volume is
controlled by KDE; player volume affects the active HTML video only.
Home & display settings include solid colors, gradients, soft blurred palettes,
and locally bundled 4K photo wallpapers. The cozy VHS living-room theme is the
default, with Windows 95 and midnight themes available. See the
[wallpaper credits](packages/ui/src/assets/wallpapers/README.md).
The app’s **About & credits** page includes TMDB and JustWatch attribution.
Source code is MIT-licensed; bundled photographs and the TMDB logo retain their
respective licenses and attribution requirements.

## Repository layout

```text
apps/launcher/        Optional React + Vite hosted launcher
apps/extension/       WXT Firefox extension and bundled local Home screen
packages/core/        Configuration, protocol, input, geometry, tab coordination
packages/adapters/    Generic controls and initial provider hooks
packages/ui/          Shared launcher, settings, and remote calibration
tests/                Local video fixtures and Firefox integration checks
deploy/caddy/         Optional static hosting configuration
integrations/fedora/  Fedora setup and diagnostics scripts
integrations/linux/   Firefox launcher, desktop entry, and Fedora RPM sources
docs/                 Requirements, installation, and acceptance status
```

`pnpm test:firefox` exercises the extension with an isolated Firefox profile.
`pnpm test:youtube` runs an opt-in live-site check. `pnpm package` creates the
extension archive plus an optional hosted-launcher archive and checksums.

An experimental Fedora RPM can be built on Fedora with `rpmbuild` and a
Mozilla-signed XPI: `scripts/build-rpm.sh artifacts/signed/tuxtelly.xpi`. It
installs the launcher and a Firefox extension policy while preserving unrelated
policy entries. See [Fedora app packaging](docs/installation.md#fedora-app-package).

TuxTelly is independent of the streaming providers. Provider names identify
intended integrations and do not imply endorsement or verified compatibility.
