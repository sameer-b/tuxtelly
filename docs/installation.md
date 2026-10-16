# Install the preview

This is a development preview. The launcher and extension are implemented; live
streaming-provider support and Fedora hardware acceptance remain to be verified.

## Build locally

Use Node.js 24 LTS and pnpm 12.11.2. If pnpm is not installed, prefix the commands
below with `npx --yes pnpm@12.11.2` instead of `pnpm`.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

The development launcher is at `http://127.0.0.1:5173/`. Build with `pnpm build`;
static files are in `apps/launcher/dist/` and the Firefox extension is in
`apps/extension/.output/firefox-mv3/`. Run `pnpm package` after building to create
archives and SHA-256 checksums under `artifacts/`.

## Load the Firefox extension for development

1. Use Firefox 142 or newer and a dedicated profile created through `about:profiles`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose the built `manifest.json`.
4. Click the TuxTelly toolbar button to open its bundled launcher.
5. Open Settings, set the hosted launcher address, and save.
6. Click **Trust launcher address** and approve its origin permission.
7. Expand each service and grant its site access for controls inside that service.
8. Open the hosted launcher and check that it reports Connected.
9. Launch a provider and log in directly on its website.

Temporary add-ons disappear when Firefox restarts. Persistent installation in
normal Firefox needs a Mozilla-signed extension. The generated ZIP is explicitly
unsigned; signing and public distribution are not performed by the build.

Use Firefox's extension-shortcut settings to configure a reliable Home command.
The initial browser-wide Home binding is Alt+Shift+H. It may need adjustment for
your desktop. F8 opens the switcher inside permitted, managed service pages.

All site access is optional. Adding a URL enables launching; it does not by itself
grant the extension permission to inspect that site. Permission patterns cover a
host across ports, but TuxTelly additionally checks exact configured origins and
the hosted launcher's exact path before accepting commands.

## Host in a PVE LXC

Create an unprivileged Debian container with 1 vCPU, 512 MB RAM, and 4 GB disk as an
initial allocation. Install Caddy using its documented Debian installation path.
Copy the contents of the launcher archive to a versioned directory such as
`/srv/tuxtelly/releases/0.1.0/`, and point `/srv/tuxtelly/current` at that directory.
Use `deploy/caddy/Caddyfile` with `TUXTELLY_HOST` set to your chosen hostname.

Set up a trusted certificate through Caddy or your existing reverse proxy. A
locally issued certificate must be trusted by the TV's Firefox profile. No Node
runtime, database, GPU access, or USB forwarding is required in the container.

Validate Caddy configuration before reloading it. To roll back, repoint `current`
to the previous release. Settings live in the TV's extension storage: use its JSON
export/import separately from server backups. Preserve the Firefox profile for
provider login sessions; exports do not contain those sessions.

## Fedora desktop setup

Run `bash integrations/fedora/diagnose.sh` from a KDE terminal for a read-only
preflight. Verify playback before assuming an adapter can control a provider.

Create a Firefox profile named `TuxTelly`. Edit a copy of
`integrations/fedora/tuxtelly.desktop.example` with your launcher URL, then save it
as `~/.config/autostart/tuxtelly.desktop`. Enable the fullscreen-window preference
in TuxTelly Settings. Keep the profile persistent so valid service logins survive.
For the current unsigned preview, temporary extension loading is still required
after a restart, so unattended boot is not yet release-qualified.

Use KDE's existing volume/mute shortcuts and choose the HDMI audio sink in KDE.
The extension's +/- controls affect the player volume, separately from system
volume. Configure laptop lid/sleep behavior through KDE and test suspend/resume.

Remove the autostart file to undo startup changes. Uninstalling the extension
removes its local settings, so export them first if you want to retain them.

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

### Unpacked Fedora preview

Arrange built files in `launcher/` and `extension/` under one preview directory.
Copy `integrations/fedora/preview.sh` beside those folders and run it from the KDE
terminal with `bash /path/to/preview/preview.sh`. It starts a loopback-only static
server and a separate Firefox profile. Load `extension/manifest.json` as a temporary
add-on, then save and trust `http://127.0.0.1:8734/` in TuxTelly Settings.

The server exits when that Firefox process closes. The script does not change
system startup or the regular Firefox profile. Its dedicated profile persists at
`~/.local/share/tuxtelly-preview/profile` (or under `XDG_DATA_HOME`); remove that
folder only when you intend to delete its settings and provider logins.

## Current limits

- Provider adapters are previews, including YouTube. Generic control and selector
  hooks do not establish real-site compatibility.
- Controls run in the top frame. Cross-origin embedded players need additional work.
- Subtitle menu selectors may differ by localization and provider redesign.
- Remote repeat tuning, long-press actions, per-service key overrides, groups,
  hosted configuration defaults, and automatic inactive-tab unloading are still pending.
- No universal 4K, HDR, surround sound, or Linux provider compatibility is claimed.

See [the acceptance checklist](acceptance.md) for remaining release gates.
