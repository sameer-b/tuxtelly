# TuxTelly

Your streaming services, one Linux TV remote.

TuxTelly is an MIT-licensed Linux TV frontend that runs locally in Firefox. Its
companion extension provides the Home screen, service tabs, remote navigation, and
player controls. It needs no web server or PVE container for a single TV. Provider
logins and DRM stay in ordinary Firefox tabs on the TV laptop.

## Project status

**Initial development preview.** The approved plan is being implemented in one
private monorepo. Public release and persistent extension signing remain pending.

The preview includes recent-use service ordering, a last-used resume action,
guided service setup, keyboard mapping and calibration, managed tabs, an in-page
switcher, HTML video controls, optional site
permissions, local config backup, privacy-limited diagnostics, and a bundled
Home screen.

Local checks pass 25 unit tests. The most recent recorded run passed 19 Firefox
integration checks on the reference Fedora 44 laptop with Firefox 156; the new
Prime Video and recent-use-ordering flows still need a browser run. Fixture checks
do not establish full provider compatibility. A separate live YouTube probe
passed 9 checks covering public playback, search, controls, and tab switching.
Prime Video, Netflix, Disney+, HBO Max, and signed-in YouTube flows remain
unverified.
See [test status](docs/acceptance.md).

## Try the local preview

Use Node.js 24 LTS and pnpm 12.11.2 to build it:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm package
```

Load `apps/extension/.output/firefox-mv3/manifest.json` through Firefox's
`about:debugging` temporary add-on loader. Open TuxTelly from Firefox's Extensions
menu; its Home screen is bundled in the extension. Settings, service definitions,
and permissions are stored in that Firefox profile. Grant access only to the
streaming sites you want TuxTelly to control, then sign in on each provider's page.

For your Fedora TV laptop, use the [preview setup instructions](docs/installation.md).
Temporary add-ons disappear when Firefox restarts. Persistent installation needs
a Mozilla-signed extension; the preview package is unsigned. Enable **Open
TuxTelly Home when this Firefox profile starts** in the dedicated TV profile to
open Home at startup; no launcher URL or server startup is needed.

A static launcher that can be served from another machine remains optional for
multi-TV setups. PVE, Caddy, a database, and a Node server are not needed for local
use.

- [Architecture and requirements](docs/project-plan.md)
- [Implementation progress and roadmap](docs/implementation-plan.md)
- [Hardware and provider acceptance checklist](docs/acceptance.md)
- [Contributing](CONTRIBUTING.md)

## Controls

| Action                                             | Default            |
| -------------------------------------------------- | ------------------ |
| Navigate / select in TuxTelly Home                 | Arrow keys / Enter |
| Service switcher                                   | F8                 |
| Home inside a managed service                      | Home               |
| Browser-wide recovery Home                         | Alt+Shift+H        |
| Play / pause                                       | Space or K         |
| Captions / player fullscreen                       | C / F              |
| Player mute / volume                               | M / + / -          |

Inside streaming services, use the remote’s gyro mouse and each provider’s own
controls. TuxTelly leaves arrow keys to the site. Other bindings can be changed
in Remote settings. System audio keys stay with KDE; player volume is separate
from system volume.
Adding an arbitrary URL provides launch support. Navigation and playback control
depend on the website and require permission plus a compatible adapter.

## Reference setup

- Fedora 44, KDE Wayland, Firefox; Intel i5-1135G7, x86-64, 8 GB RAM.
- Rii MX3 2.4 GHz air mouse and keyboard remote, pending physical calibration.
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

## Repository layout

```text
apps/launcher/        Optional React + Vite hosted launcher
apps/extension/       WXT Firefox extension and bundled local Home screen
packages/core/        Configuration, protocol, input, geometry, tab coordination
packages/adapters/    Generic controls and initial provider hooks
packages/ui/          Shared launcher, settings, and remote calibration
tests/                Local video fixtures and Firefox integration checks
deploy/caddy/         Optional static hosting configuration
integrations/fedora/  Read-only diagnostics and local preview launcher
docs/                 Requirements, installation, and acceptance status
```

`pnpm test:firefox` exercises the extension with an isolated Firefox profile.
`pnpm test:youtube` runs an opt-in live-site check. `pnpm package` creates the
extension archive plus an optional hosted-launcher archive and checksums.

TuxTelly is independent of the streaming providers. Provider names identify
intended integrations and do not imply endorsement or verified compatibility.
