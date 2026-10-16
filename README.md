# TuxTelly

Your streaming services, one Linux TV remote.

TuxTelly is a planned open-source, self-hosted TV frontend for Linux. A
remote-friendly launcher and companion Firefox extension will let you browse
streaming services, control playback, and switch between ordinary Firefox tabs.

## Project status

**Planning.** The project name and private monorepo have been selected. The
architecture and implementation roadmap are proposals awaiting approval; no
application or extension code has been implemented, and no provider compatibility
has been verified on the target hardware.

- [Architecture, technology stack, and requirements](docs/project-plan.md)
- [Implementation roadmap and acceptance criteria](docs/implementation-plan.md)

## Intended experience

1. Boot a Linux laptop connected to a TV and start Firefox fullscreen.
2. Open the self-hosted TuxTelly launcher.
3. Add a service URL and log in directly on the provider's website.
4. Navigate with a remote or keyboard, control playback, and switch services.
5. Keep each service in its own Firefox tab and retain its normal browser session.

The proposed hosting component serves static frontend assets. Playback, provider
authentication, and DRM stay in Firefox on the TV-connected laptop. A companion
extension is required to manage tabs and provide controls inside service pages.

## Initial target

- Fedora 44 with KDE and Firefox.
- Intel Core i5-1135G7, x86-64, 8 GB RAM.
- Rii MX3 2.4 GHz remote with air mouse and keyboard; actual key events require calibration.
- Static hosting in a Proxmox VE LXC container.
- Provider priority: YouTube, Netflix, Disney+, then HBO Max.

Adding an arbitrary URL provides launch support. Generic controls depend on the
page, and reliable provider navigation requires a tested service adapter.

## Repository layout

One monorepo is planned so launcher, extension, and shared protocol changes can
be reviewed together. Only documentation exists today.

```text
apps/            # Planned launcher and Firefox extension
packages/        # Planned shared UI, configuration, input, navigation, and adapters
tests/           # Planned fixtures, Firefox integration, and acceptance tests
deploy/          # Planned Caddy and LXC deployment resources
integrations/    # Planned Fedora/KDE setup resources
docs/            # Architecture, requirements, and implementation roadmap
```

## Open-source release

The intended destination is a public open-source project. MIT is the proposed
license in the project plan; a license has not yet been adopted. Keeping the
repository private during planning is separate from that release decision.

TuxTelly is an independent project. Provider names describe intended compatibility.
