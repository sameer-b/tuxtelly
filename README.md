# TuxTelly

Your streaming services, one Linux TV remote.

TuxTelly is an MIT-licensed, self-hosted TV frontend for Linux. Its remote-friendly
launcher and Firefox extension manage streaming services in ordinary Firefox tabs.
Provider logins and DRM stay in Firefox on the TV laptop; the server serves static
files and never handles streaming credentials or video.

## Project status

**Initial development preview.** The approved plan is being implemented in one
private monorepo. Public release and extension signing remain pending.

The preview includes a customizable launcher, service settings, keyboard mapping
and calibration, managed tabs, an in-page switcher, generic spatial navigation,
HTML video controls, optional site permissions, and a bundled offline launcher.

Local checks pass 20 unit tests; 15 Firefox integration checks pass on the
reference Fedora 44 laptop with Firefox 156. These establish fixture behavior,
not full compatibility with streaming providers. A separate live YouTube probe
passes 9 checks covering public playback, search, controls, and tab switching.
Netflix, Disney+, HBO Max, and signed-in YouTube flows remain unverified.
See [test status](docs/acceptance.md).

## Try the preview

Use Node.js 24 LTS and pnpm 12.11.2:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Load `apps/extension/.output/firefox-mv3/manifest.json` through Firefox's
`about:debugging` temporary add-on loader. Open the extension's Settings, save and
trust the launcher address (`http://127.0.0.1:5173/` locally), and grant access to
the services you want to control. Log in directly on each provider's website.

Temporary add-ons disappear after Firefox restarts. Persistent installation needs
a Mozilla-signed extension; the preview package is unsigned.

- [Installation, Fedora setup, and PVE LXC hosting](docs/installation.md)
- [Architecture, technology stack, and requirements](docs/project-plan.md)
- [Implementation progress and roadmap](docs/implementation-plan.md)
- [Hardware and provider acceptance checklist](docs/acceptance.md)
- [Contributing](CONTRIBUTING.md)

## Controls

| Action                                             | Default            |
| -------------------------------------------------- | ------------------ |
| Navigate / select                                  | Arrow keys / Enter |
| Service switcher                                   | F8                 |
| Home inside a managed service                      | Home               |
| Browser-wide recovery Home                         | Alt+Shift+H        |
| Play / pause                                       | Space or K         |
| Seek during playback when the page/video has focus | Left / Right       |
| Captions / player fullscreen                       | C / F              |
| Player mute / volume                               | M / + / -          |

Bindings can be changed in Remote settings. Text fields retain normal typing.
System audio keys stay with KDE; player volume is separate from system volume.
Adding an arbitrary URL provides launch support. Navigation and playback control
depend on the website and require permission plus a compatible adapter.

## Reference setup

- Fedora 44, KDE Wayland, Firefox; Intel i5-1135G7, x86-64, 8 GB RAM.
- Rii MX3 2.4 GHz air mouse and keyboard remote, pending physical calibration.
- Static hosting in a Proxmox VE unprivileged LXC, pending deployment validation.
- Provider implementation and testing order: YouTube, Netflix, Disney+, HBO Max.

## Repository layout

```text
apps/launcher/       React + Vite hosted launcher
apps/extension/      WXT Firefox extension and bundled launcher
packages/core/       Configuration, protocol, input, geometry, tab coordination
packages/adapters/   Generic controls and initial provider hooks
packages/ui/         Shared launcher, settings, and remote calibration
tests/              Local video fixtures and Firefox integration checks
deploy/caddy/       Static hosting configuration
integrations/fedora/ Read-only diagnostics and autostart template
docs/               Requirements, installation, and acceptance status
```

Run `pnpm test:firefox` after building to test with an isolated Firefox profile.
Run `pnpm package` to create launcher and unsigned extension archives with checksums.

TuxTelly is independent of the streaming providers. Provider names identify
intended integrations and do not imply endorsement or verified compatibility.
