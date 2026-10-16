# Install the preview

This is a development preview. The local Firefox extension is the primary app;
live streaming-provider support and physical Fedora hardware acceptance remain
to be verified.

## Build from source

Use Node.js 24 LTS and pnpm 12.11.2. Install dependencies and build:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm package
```

The local Firefox extension is `apps/extension/.output/firefox-mv3/`. Load its
`manifest.json` in Firefox through `about:debugging#/runtime/this-firefox` and
**Load Temporary Add-on**. Open TuxTelly from the Extensions menu. Its Home screen
is part of the extension, so normal single-TV use needs no local or remote server.

## Fedora TV preview

The preview files have already been staged on the reference laptop. In a KDE
terminal, run:

```sh
bash ~/.local/share/tuxtelly-preview/0.1.0/preview.sh
```

In Firefox's debugging tab, choose **Load Temporary Add-on** and select:

```text
/home/sam/.local/share/tuxtelly-preview/0.1.0/extension/manifest.json
```

Open TuxTelly from Firefox's Extensions menu to reach its bundled Home screen.
In Settings, grant access to the streaming sites you want TuxTelly to control.
Return to Home, launch a service, and sign in directly on the provider's page.
Use **Remote** to see the keys sent by the Rii remote and adjust bindings.

The script uses a dedicated Firefox profile at
`~/.local/share/tuxtelly-preview/profile`; it does not modify your normal Firefox
profile or desktop startup. Settings and any provider logins stay in this profile.
The preview extension is temporary and must be loaded again after Firefox restarts.
The profiles and credentials remain local to the laptop.

## Persistent Firefox setup

A normal Firefox installation requires a Mozilla-signed extension. The package
created by `pnpm package` is explicitly unsigned and intended for development.
After a persistent signed build is available, create a dedicated Firefox profile
and configure KDE autostart with a copy of
`integrations/fedora/tuxtelly.desktop.example`. The extension opens its bundled
Home when Firefox starts. Keep the profile persistent so provider logins survive
restarts. Configure browser fullscreen and laptop lid or
sleep behavior through KDE, then verify suspend/resume on the TV.

Use KDE to choose the HDMI audio sink and control system volume. TuxTelly's
player volume controls are separate. Remove the autostart file to undo startup
configuration. Export settings before uninstalling the extension if you want to
keep them.

## Optional network-hosted launcher

For multiple TVs, you may serve the optional React launcher from one host. This
mode uses the Caddy configuration in `deploy/caddy/` and requires a network
address trusted by each TV's Firefox profile. Set the hosted address in TuxTelly's
advanced settings and grant that origin. A Proxmox VE unprivileged Debian LXC can
host the static files; an initial allocation is 1 vCPU, 512 MB RAM, and 4 GB disk.
The container does not handle provider sessions, video, or DRM.

This optional mode adds certificate, backup, upgrade, and rollback work. Settings
remain in each TV's extension profile. LXC hosting is not needed for local use.

## Browser tests

```sh
pnpm build
pnpm test:firefox
```

The tests use a fresh WebDriver Firefox profile, local pages, and a generated
video fixture. They do not open your normal profile or use provider credentials.
Set `FIREFOX_BINARY` or `GECKODRIVER_BINARY` if binaries need explicit paths. Set
`HEADED=1` for visible browser tests. Firefox screenshots/results go to `artifacts/`.

The fixture video was generated with FFmpeg's testsrc2 filter, with no third-party
media. Regenerate it with:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=320x180:rate=15' -t 30 -c:v libvpx -b:v 120k -an tests/fixtures/sample.webm
```

### Optional live YouTube probe

After building, run `pnpm test:youtube` to check signed-out public-video playback,
search, keyboard controls, and return-to-Home behavior in an isolated profile.
This uses YouTube's live website and is deliberately separate from deterministic
CI tests. It can fail because of network, consent, ads, or provider changes.
`YOUTUBE_TEST_URL` can select a different public `https://www.youtube.com` video.
Results are written to `artifacts/youtube-results.json` only after a successful
run. A successful probe does not qualify signed-in accounts or every video.

Both browser suites accept `SELENIUM_REMOTE_URL` for a remote geckodriver. Bind
geckodriver to loopback and access it through SSH; use `--allow-system-access`
for the isolated extension test profile. When running fixtures remotely, set
`FIXTURE_PORT` and forward that port from the browser machine to the runner.

## Current limits

- Provider adapters are previews, including YouTube. Generic control and selector
  hooks do not establish real-site compatibility.
- Controls run in the top frame. Cross-origin embedded players need additional work.
- Subtitle menu selectors may differ by localization and provider redesign.
- Remote repeat tuning, long-press actions, per-service key overrides, groups,
  hosted configuration defaults, and automatic inactive-tab unloading are still pending.
- No universal 4K, HDR, surround sound, or Linux provider compatibility is claimed.

See [the acceptance checklist](acceptance.md) for remaining release gates.
