import { type Dispatch, type SetStateAction, type RefObject } from "react";
import {
  type Client,
  type Config,
  type Service,
  originPattern,
} from "@tuxtelly/core";
import { wallpaperGroups } from "../wallpapers";
import { themes } from "../themes";

export type SettingsViewProps = {
  client: Client;
  config: Config;
  busy: boolean;
  onMessageChange: (message: string) => void;
  refresh: () => Promise<void>;
  save: () => Promise<void>;
  onOpenRemote: () => void;
  tmdbKey: string;
  onTmdbKeyChange: (key: string) => void;
  tmdbConfigured: boolean;
  onTestTmdb: () => void;
  onSaveTmdbSettings: () => void;
  onRemoveTmdbKey: () => void;
  searchRegion: string;
  onSearchRegionChange: (region: string) => void;
  searchServices: string[];
  onSearchServicesChange: (serviceIds: string[]) => void;
  setConfig: Dispatch<SetStateAction<Config>>;
  updateService: (index: number, patch: Partial<Service>) => void;
  hasServiceAccess: (service: Service) => boolean;
  onGrantSiteAccess: (service: Service) => void;
  onRemoveService: (serviceId: string) => void;
  onAddService: () => void;
  onLoadDefaults: () => void;
  exportConfig: () => void;
  exportDiagnostics: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportConfig: (file?: File) => Promise<void>;
};

export function SettingsView({
  client,
  config,
  busy,
  onMessageChange,
  refresh,
  save,
  onOpenRemote,
  tmdbKey,
  onTmdbKeyChange,
  tmdbConfigured,
  onTestTmdb,
  onSaveTmdbSettings,
  onRemoveTmdbKey,
  searchRegion,
  onSearchRegionChange,
  searchServices,
  onSearchServicesChange,
  setConfig,
  updateService,
  hasServiceAccess,
  onGrantSiteAccess,
  onRemoveService,
  onAddService,
  onLoadDefaults,
  exportConfig,
  exportDiagnostics,
  fileInputRef,
  onImportConfig,
}: SettingsViewProps) {
  return (
    <main className="settings">
      <p className="eyebrow">MAKE IT YOURS</p>
      <h1>Your setup.</h1>
      <p className="subtitle">
        Changes stay on this Firefox profile. Save when you’re ready.
      </p>
      <section className="panel">
        <h2>Global search</h2>
        <p className="hint">
          Your TMDB key is stored only in this Firefox profile and used by the
          extension background. It is not included in settings exports or
          diagnostics. Anyone with access to this Firefox profile can inspect
          it.
        </p>
        {client.kind === "extension" ? (
          <>
            <label>
              TMDB API key
              <input
                type="password"
                autoComplete="off"
                value={tmdbKey}
                placeholder={
                  tmdbConfigured
                    ? "Key saved · enter a new key to replace it"
                    : "Enter TMDB API key"
                }
                onChange={(event) => onTmdbKeyChange(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button onClick={() => void onTestTmdb()}>Test key</button>
              <button
                className="primary"
                onClick={() => void onSaveTmdbSettings()}
              >
                {tmdbKey
                  ? "Save key and search settings"
                  : "Save search settings"}
              </button>
              {tmdbConfigured && (
                <button
                  className="danger"
                  onClick={() => void onRemoveTmdbKey()}
                >
                  Remove key
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="button-row">
            <button
              className="primary"
              onClick={() => void onSaveTmdbSettings()}
            >
              Save search services
            </button>
            <span className="hint">
              Manage the API key in Firefox extension Settings.
            </span>
          </div>
        )}
        <div className="form-row">
          <label>
            Availability region (country code)
            <input
              maxLength={2}
              value={searchRegion}
              onChange={(event) =>
                onSearchRegionChange(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 2),
                )
              }
            />
          </label>
        </div>
        <fieldset className="search-service-settings">
          <legend>Services to include in search</legend>
          {config.services
            .filter((service) => service.enabled)
            .map((service) => (
              <label className="check" key={service.id}>
                <input
                  type="checkbox"
                  checked={searchServices.includes(service.id)}
                  onChange={(event) =>
                    event.target.checked
                      ? onSearchServicesChange([...searchServices, service.id])
                      : onSearchServicesChange(
                          searchServices.filter((id) => id !== service.id),
                        )
                  }
                />
                {service.name}
              </label>
            ))}
        </fieldset>
        <p className="hint">
          TMDB reports catalog availability by region; it cannot verify your
          account plan. Results include TMDB and JustWatch attribution.
        </p>
      </section>
      <section className="panel">
        <h2>Home & display</h2>
        <p className="hint">
          TuxTelly runs from this Firefox profile. No web server is needed.
        </p>
        <div className="form-row">
          <label>
            Interface scale
            <input
              type="number"
              min="0.8"
              max="1.5"
              step="0.05"
              value={config.preferences.scale}
              onChange={(e) =>
                setConfig({
                  ...config,
                  preferences: {
                    ...config.preferences,
                    scale: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Screen margin (%)
            <input
              type="number"
              min="0"
              max="8"
              value={config.preferences.overscan}
              onChange={(e) =>
                setConfig({
                  ...config,
                  preferences: {
                    ...config.preferences,
                    overscan: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Seek seconds
            <input
              type="number"
              min="1"
              max="120"
              value={config.preferences.seekSeconds}
              onChange={(e) =>
                setConfig({
                  ...config,
                  preferences: {
                    ...config.preferences,
                    seekSeconds: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </div>
        <fieldset className="theme-picker">
          <legend>Look & feel</legend>
          <p className="hint">
            Themes restyle the home screen and controls. Your selection previews
            immediately and saves with your settings.
          </p>
          <div className="theme-options">
            {themes.map((theme) => (
              <button
                type="button"
                className={
                  config.preferences.theme === theme.id
                    ? "theme-choice selected"
                    : "theme-choice"
                }
                aria-pressed={config.preferences.theme === theme.id}
                key={theme.id}
                onClick={() =>
                  setConfig({
                    ...config,
                    preferences: {
                      ...config.preferences,
                      theme: theme.id,
                    },
                  })
                }
              >
                <span
                  className="theme-swatch"
                  style={{ background: theme.swatch }}
                  aria-hidden="true"
                />
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="wallpaper-picker">
          <legend>Home screen wallpaper</legend>
          <p className="hint">
            Choose a color, gradient, soft blur, or 4K photo. Save settings to
            keep your choice.
          </p>
          {wallpaperGroups.map((group) => (
            <div className="wallpaper-group" key={group.name}>
              <h3>{group.name}</h3>
              <div className="wallpaper-options">
                {group.options.map((option) => (
                  <button
                    type="button"
                    className={
                      config.preferences.wallpaper === option.id
                        ? "wallpaper-choice selected"
                        : "wallpaper-choice"
                    }
                    aria-pressed={config.preferences.wallpaper === option.id}
                    key={option.id}
                    onClick={() =>
                      setConfig({
                        ...config,
                        preferences: {
                          ...config.preferences,
                          wallpaper: option.id,
                        },
                      })
                    }
                  >
                    <span
                      className="wallpaper-swatch"
                      style={{
                        background: option.background,
                        filter: option.filter ?? "none",
                      }}
                      aria-hidden="true"
                    />
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            checked={config.preferences.openHomeAtStartup}
            onChange={(e) =>
              setConfig({
                ...config,
                preferences: {
                  ...config.preferences,
                  openHomeAtStartup: e.target.checked,
                },
              })
            }
          />
          Open TuxTelly Home when this Firefox profile starts
        </label>
        <p className="hint">
          Enable this in the dedicated TV profile to open TuxTelly after login.
          The setting is saved per Firefox profile.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={config.preferences.fullscreenWindow}
            onChange={(e) =>
              setConfig({
                ...config,
                preferences: {
                  ...config.preferences,
                  fullscreenWindow: e.target.checked,
                },
              })
            }
          />
          Keep the managed Firefox window fullscreen
        </label>
        <details className="service-settings">
          <summary>Optional: use a network-hosted launcher</summary>
          <label>
            Hosted launcher address
            <input
              value={config.launcherUrl}
              placeholder="https://tv.home.example/"
              onChange={(event) =>
                setConfig({ ...config, launcherUrl: event.target.value })
              }
            />
          </label>
          <p className="hint">
            This is only useful when serving the launcher to multiple TVs. Leave
            it empty for local use.
          </p>
          {config.launcherUrl && (
            <button
              onClick={() => {
                try {
                  void client
                    .grant?.([originPattern(config.launcherUrl)])
                    .then((granted) => {
                      onMessageChange(
                        granted
                          ? "Launcher access granted. Save settings, then reload the launcher."
                          : "Access was not granted.",
                      );
                    })
                    .catch(() =>
                      onMessageChange(
                        "Could not grant launcher access. Try again from extension settings.",
                      ),
                    );
                } catch {
                  onMessageChange("Enter a valid launcher address.");
                }
              }}
            >
              Trust launcher address
            </button>
          )}
        </details>
      </section>
      <section className="panel">
        <h2>Services</h2>
        <p className="hint">
          New services can launch immediately. Grant site access for navigation
          and player controls.
        </p>
        {config.services.map((service, index) => (
          <details key={service.id} className="service-settings">
            <summary>
              {service.name}
              <span>
                {service.enabled ? "Enabled" : "Hidden"} ·{" "}
                {hasServiceAccess(service)
                  ? "site access granted"
                  : "site access needed"}
              </span>
            </summary>
            <div className="form-row">
              <label>
                Name
                <input
                  value={service.name}
                  onChange={(e) =>
                    updateService(index, { name: e.target.value })
                  }
                />
              </label>
              <label>
                Address
                <input
                  value={service.url}
                  onChange={(e) => {
                    let origins = service.origins;
                    try {
                      const origin = new URL(e.target.value).origin;
                      if (!origins.includes(origin)) origins = [origin];
                    } catch {
                      /* Validate on save. */
                    }
                    updateService(index, { url: e.target.value, origins });
                  }}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Adapter
                <select
                  value={service.adapter}
                  onChange={(e) =>
                    updateService(index, {
                      adapter: e.target.value as Service["adapter"],
                    })
                  }
                >
                  {[
                    "generic",
                    "youtube",
                    "netflix",
                    "disney",
                    "hbo",
                    "prime",
                  ].map((adapter) => (
                    <option key={adapter}>{adapter}</option>
                  ))}
                </select>
              </label>
              <label>
                Accent
                <input
                  type="color"
                  value={service.color}
                  onChange={(e) =>
                    updateService(index, { color: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="check">
              Allowed origins (one per line)
              <textarea
                value={service.origins.join("\n")}
                onChange={(e) =>
                  updateService(index, {
                    origins: e.target.value.split("\n"),
                  })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={service.enabled}
                onChange={(e) =>
                  updateService(index, { enabled: e.target.checked })
                }
              />
              Show in library
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={service.backgroundAudio}
                onChange={(e) =>
                  updateService(index, { backgroundAudio: e.target.checked })
                }
              />
              Allow background audio
            </label>
            <div className="button-row">
              <button onClick={() => onGrantSiteAccess(service)}>
                Grant site access
              </button>
              <button
                className="danger"
                onClick={() => onRemoveService(service.id)}
              >
                Remove
              </button>
            </div>
            <p className="hint">
              {service.adapter === "generic"
                ? "Generic controls: compatibility depends on the website."
                : service.adapter === "prime"
                  ? "Prime Video controls use its browser keyboard shortcuts. Account, region, and title compatibility still need testing."
                  : "Adapter preview: live provider compatibility is still being verified."}
            </p>
          </details>
        ))}
        <button onClick={onAddService}>+ Add service</button>
      </section>
      <section className="panel">
        <h2>Configuration</h2>
        <div className="button-row">
          <button onClick={exportConfig}>Export JSON</button>
          <button onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <button onClick={onLoadDefaults}>Load defaults</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImportConfig(e.target.files?.[0]);
          }}
        />
      </section>
      <section className="panel">
        <h2>Privacy & troubleshooting</h2>
        <p className="hint">
          Settings exports contain your service addresses and layout, but never
          provider passwords or cookies. Diagnostics include basic app/browser
          versions and counts only; review the downloaded file before sharing
          it.
        </p>
        <div className="button-row">
          <button onClick={exportDiagnostics}>
            Download private diagnostics
          </button>
        </div>
        <p className="hint">
          TuxTelly cannot read your provider passwords. Firefox stores your
          sessions; site access lets the extension add playback shortcuts to
          selected sites. Arrow navigation remains with each site.
        </p>
      </section>
      <div className="save-bar">
        <button className="primary" disabled={busy} onClick={() => void save()}>
          Save settings
        </button>
        <button onClick={() => void refresh()}>Discard changes</button>
        <button onClick={onOpenRemote}>Configure remote →</button>
      </div>
    </main>
  );
}
