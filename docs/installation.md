# Install the preview

This is a development preview. The local Firefox extension is the primary app;
live streaming-provider support and physical Fedora hardware acceptance remain
to be verified.

## Build from source

Use Node.js 24 LTS and pnpm 12.11.2. Install dependencies and build:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm check
pnpm package
```

The local Firefox extension is `apps/extension/.output/firefox-mv3/`. Load its
`manifest.json` in Firefox through `about:debugging#/runtime/this-firefox` and
**Load Temporary Add-on**. Open TuxTelly from the Extensions menu. Its Home screen
is part of the extension, so normal single-TV use needs no local or remote server.

## Fedora TV preview

After building from source on the Fedora machine, stage the extension in a
dedicated preview directory. Run these commands from the repository in a KDE
terminal:

```sh
preview_dir="${XDG_DATA_HOME:-$HOME/.local/share}/tuxtelly-preview/source"
mkdir -p "$preview_dir/extension"
cp -R apps/extension/.output/firefox-mv3/. "$preview_dir/extension/"
bash integrations/fedora/preview.sh "$preview_dir"
```

The script prints the full path to `extension/manifest.json`. In Firefox’s
debugging tab, choose **Load Temporary Add-on** and select that file.

Open TuxTelly from Firefox's Extensions menu to reach its bundled Home screen.
In Settings, grant access to the streaming sites you want TuxTelly to control.
Return to Home, launch a service, and sign in directly on the provider's page.
Use **Remote** to see the keys sent by your remote and adjust bindings.
In **Settings → Home & display**, choose the cozy VHS living-room theme,
Windows 95, or Midnight Modern. The same page offers solid colors, gradients,
soft blur, and bundled 4K photo wallpapers. Choices preview immediately and are
stored with the profile settings when you save.

The script uses a dedicated Firefox profile at
`~/.local/share/tuxtelly-preview/profile`; it does not modify your normal Firefox
profile or desktop startup. Settings and any provider logins stay in this profile.
The preview extension is temporary and must be loaded again after Firefox restarts.
The profiles and credentials remain local to the laptop.

Home and service navigation use the configured remote keys. Defaults are `Home`
to return to TuxTelly, `F8` to open the service switcher, and Firefox's
`Alt+Shift+H` extension shortcut as a browser-wide Home fallback. Firefox or KDE
may reserve some remote keys; use TuxTelly's **Remote** page to inspect captured
keys and Firefox's **Manage Extension Shortcuts** page to change the Home command.

Home automatically places the most recently opened service first. Use
**Settings → Services** to hide, rename, or remove services. **Resume** reopens
the last used enabled service.
Settings explain why site access is requested, while sign-in always happens on
the provider's own page. **Download private diagnostics** exports app/browser
versions and counts, not service URLs, credentials, cookies, viewing history, or
typed input. Review the file before sharing it.

## Persistent Firefox setup

A normal Firefox installation requires a Mozilla-signed extension. The package
created by `pnpm package` is explicitly unsigned and intended for development.
Once you have a signed build from the signing procedure below, run
`integrations/fedora/setup-tv-profile.sh` from KDE. It creates a named Firefox
profile and installs a KDE autostart entry without changing the regular profile.
The script leaves an existing autostart file untouched. Start the new profile
once with `firefox --no-remote -P TuxTelly`, let the signed extension install,
then enable **Open TuxTelly Home when this Firefox profile starts** in TuxTelly
settings and save. This setting is opt-in and stored per profile. The included
`integrations/fedora/remove-tv-autostart.sh` disables automatic launch while
keeping the profile and provider logins. Configure browser fullscreen and laptop
lid or sleep behavior through KDE, then verify suspend/resume on the TV.

For self-distribution, create a Mozilla Add-ons developer account and generate
unlisted signing API credentials at
<https://addons.mozilla.org/developers/addon/api/key/>. Copy the example into a
local credentials file, restrict its permissions, and add the credentials there:

```sh
cp .env.local.example .env.local
chmod 600 .env.local
# Edit .env.local and set WEB_EXT_API_KEY and WEB_EXT_API_SECRET.
pnpm build
pnpm sign:extension
```

`.env.local` is ignored by Git. Do not commit it or paste the key or secret into
chat. The signing command passes credentials to `web-ext` through environment
variables rather than command-line arguments.

The signed XPI is written to `artifacts/signed/`. Copy it to the Fedora laptop and
run `integrations/fedora/install-signed-extension.sh /path/to/tuxtelly.xpi`.
That script uses Firefox's enterprise extension policy and `sudo`; it installs a
Mozilla-signed XPI and does not disable signature checks. The policy is system
wide and installs TuxTelly as a normal, user-removable add-on in Firefox profiles.
To remove it, run `integrations/fedora/remove-signed-extension.sh`. Restart Firefox
after install or removal. Site permissions remain separately controlled by the
user in TuxTelly settings.

Signing credentials belong to the maintainer’s local environment and are not
included in the repository or build artifacts. Each distributor needs a Mozilla
developer account and signing credentials. Review can take time; only install the
signed XPI returned by Mozilla. Provider site permissions remain a per-user choice.
There is no automatic update feed yet; install a newer signed XPI to update.

## Fedora app package

The initial desktop package wraps the same Firefox extension; it does not embed
a browser engine or run a server. Build it on Fedora with `rpm-build` installed
and a Mozilla-signed XPI available:

```sh
sudo dnf install rpm-build
scripts/build-rpm.sh artifacts/signed/tuxtelly.xpi
sudo dnf install artifacts/tuxtelly-*.rpm
```

The RPM installs `/usr/bin/tuxtelly`, a KDE application-menu entry, the signed
XPI, and a Firefox enterprise policy that installs TuxTelly as a normal,
user-removable extension. The policy helper preserves other policy entries and
restores any prior TuxTelly policy if the RPM is removed. The launcher reuses
`~/.local/share/tuxtelly/firefox-profile`, so provider logins
and extension settings survive app and browser restarts. If it finds the
earlier preview profile at `~/.local/share/tuxtelly-preview/profile` and no new
profile yet, it adopts that profile automatically. It requires the distribution's
native Firefox package; playback remains in Firefox.

Run `tuxtelly` from the app menu or terminal. Use `tuxtelly --enable-autostart`
to add a per-user KDE login entry, `tuxtelly --disable-autostart` to remove it,
and `tuxtelly --profile-path` to print the profile path. The first time, open
TuxTelly settings and enable **Open TuxTelly Home when this Firefox profile
starts**. The launcher opens a standard Firefox window; use your existing KDE
or Firefox fullscreen setup, or pass `tuxtelly --kiosk` to request Firefox
kiosk mode. Removing the RPM removes its Firefox policy entry and package files
but deliberately leaves the profile and credentials intact.

This first package targets Fedora. The launcher and extension remain portable;
Debian/Ubuntu packaging can be added separately once the Fedora install and
upgrade flow has been exercised on the TV laptop.

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
