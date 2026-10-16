import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  actions,
  configSchema,
  createDiagnosticReport,
  defaultConfig,
  eventBinding,
  isEditing,
  nearest,
  originPattern,
  parseConfig,
  VERSION,
  type Client,
  type Config,
  type Service,
  type State,
} from "@tuxtelly/core";
import "./styles.css";
import { wallpaperGroups, wallpaperPresets } from "./wallpapers";
import { themes } from "./themes";
import { navigateSearch } from "./search-navigation";

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect x="2" y="7" width="30" height="22" rx="7" fill="currentColor" />
      <path
        d="m11 2 6 5 6-5M12 33h10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="m14 13 8 5-8 5z" fill="#101716" />
    </svg>
  );
}
function navigate(event: ReactKeyboardEvent<HTMLElement>) {
  if (isEditing(event.target) || event.altKey || event.ctrlKey || event.metaKey)
    return;
  const direction = (
    {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    } as const
  )[event.key as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"];
  if (!direction) return;
  const elements = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href], input, select, textarea",
    ),
  ].filter((el) => el.getBoundingClientRect().width > 0);
  const current = document.activeElement as HTMLElement;
  if (!current || !elements.includes(current)) return;
  const index = nearest(
    current.getBoundingClientRect(),
    elements.map((el) => el.getBoundingClientRect()),
    direction,
  );
  if (index >= 0) {
    event.preventDefault();
    elements[index].focus();
    elements[index].scrollIntoView({ block: "nearest" });
  }
}
function offerLabel(availability: string) {
  return (
    {
      flatrate: "Subscription",
      free: "Free",
      ads: "With ads",
      rent: "Rent",
      buy: "Buy",
    }[availability] ?? availability
  );
}
export function App({ client }: { client: Client }) {
  const [config, setConfig] = useState<Config>(structuredClone(defaultConfig));
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<
    "library" | "search" | "settings" | "remote"
  >(
    client.kind === "extension" &&
      new URLSearchParams(location.search).has("settings")
      ? "settings"
      : "library",
  );
  const [message, setMessage] = useState("");
  const [showSetupGuide, setShowSetupGuide] = useState(
    () => localStorage.getItem("tuxtelly.dismissedSetupGuide") !== "true",
  );
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tmdbKey, setTmdbKey] = useState("");
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [searchRegion, setSearchRegion] = useState("US");
  const [searchServices, setSearchServices] = useState<string[]>([]);
  const [includePaidOffers, setIncludePaidOffers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      tmdbId: number;
      mediaType: string;
      title: string;
      year: string | null;
      overview: string;
      posterUrl: string | null;
      matchedServices: Array<{ serviceId: string; availability: string }>;
    }>
  >([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  async function refresh() {
    try {
      const reply = await client.request({ type: "state" });
      if (!reply.ok) throw new Error(reply.error);
      const next = reply.data as State;
      setConfig(configSchema.parse(next.config));
      setState(next);
      setConnected(true);
      const searchSettings = await client.request({ type: "searchSettings" });
      if (searchSettings.ok && searchSettings.data) {
        const saved = searchSettings.data as {
          configured: boolean;
          region: string;
          serviceIds: string[];
        };
        setTmdbConfigured(saved.configured);
        setSearchRegion(saved.region);
        setSearchServices(saved.serviceIds);
      }
      if (next.recovery) setMessage(next.recovery);
    } catch {
      setConnected(false);
    }
  }
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (view !== "library") return;
    const focusSelectedService = () => {
      if (document.visibilityState === "hidden") return;
      const selected = sessionStorage.getItem("tuxtelly.selection");
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>("[data-service]"),
      ];
      (
        buttons.find((button) => button.dataset.service === selected) ??
        buttons[0]
      )?.focus();
    };
    const onFocus = () => {
      void refresh();
      requestAnimationFrame(focusSelectedService);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        requestAnimationFrame(focusSelectedService);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = setTimeout(focusSelectedService, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [view, connected]);
  useEffect(() => {
    if (view === "search")
      requestAnimationFrame(() => searchInput.current?.focus());
  }, [view]);
  async function request(message: Parameters<Client["request"]>[0]) {
    setBusy(true);
    try {
      const reply = await client.request(message);
      if (!reply.ok) throw new Error(reply.error);
      return reply;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function settings() {
    if (client.kind === "extension") setView("settings");
    else if (connected) void request({ type: "settings" });
    else
      setMessage(
        "Install the Firefox companion extension, open its settings, and trust this launcher address. See the installation guide in the repository.",
      );
  }
  async function save() {
    try {
      const validated = configSchema.parse(config);
      if (await request({ type: "save", config: validated })) {
        setMessage("Settings saved.");
        await refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Check your settings.",
      );
    }
  }
  async function saveTmdbSettings() {
    try {
      if (
        client.kind === "extension" &&
        !(await client.grant?.([
          "https://api.themoviedb.org/*",
          "https://image.tmdb.org/*",
        ]))
      )
        throw new Error("Allow TuxTelly to connect to TMDB, then try again.");
      if (client.kind === "hosted" && tmdbKey)
        throw new Error("Manage the TMDB key in Firefox extension Settings.");
      const reply = await client.request({
        type: "saveSearchSettings",
        apiKey: tmdbKey,
        region: searchRegion,
        serviceIds: searchServices,
      });
      if (!reply.ok) throw new Error(reply.error);
      setTmdbConfigured(Boolean(tmdbKey) || tmdbConfigured);
      setTmdbKey("");
      setMessage("TMDB search settings saved in this Firefox profile.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save TMDB settings.",
      );
    }
  }
  async function testTmdb() {
    if (client.kind !== "extension") {
      setMessage("Test the TMDB key in Firefox extension Settings.");
      return;
    }
    if (!tmdbKey.trim()) {
      setMessage("Enter the TMDB API key you want to test.");
      return;
    }
    try {
      if (
        !(await client.grant?.([
          "https://api.themoviedb.org/*",
          "https://image.tmdb.org/*",
        ]))
      )
        throw new Error("Allow TuxTelly to connect to TMDB, then try again.");
      const reply = await client.request({
        type: "testTmdb",
        apiKey: tmdbKey.trim(),
      });
      if (!reply.ok) throw new Error(reply.error);
      setMessage("TMDB connection succeeded. Save the key to enable search.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "TMDB connection failed.",
      );
    }
  }
  async function removeTmdbKey() {
    const reply = await client.request({ type: "removeTmdbKey" });
    if (!reply.ok) {
      setMessage(reply.error);
      return;
    }
    setTmdbConfigured(false);
    setMessage("TMDB key removed from this Firefox profile.");
  }
  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    if (searchQuery.trim().length < 2) {
      setSearchStatus("Enter at least two characters.");
      return;
    }
    if (!searchServices.length) {
      setSearchStatus("Include at least one service in Settings.");
      return;
    }
    setSearchBusy(true);
    setSearchStatus("Searching TMDB…");
    try {
      const reply = await client.request({
        type: "search",
        query: searchQuery.trim(),
        region: searchRegion,
        serviceIds: searchServices,
        includePaidOffers,
      });
      if (!reply.ok) throw new Error(reply.error);
      setSearchResults(reply.data as typeof searchResults);
      setSearchStatus("");
    } catch (error) {
      setSearchResults([]);
      setSearchStatus(
        error instanceof Error ? error.message : "Search failed.",
      );
    } finally {
      setSearchBusy(false);
    }
  }
  function updateService(index: number, patch: Partial<Service>) {
    setConfig((old) => ({
      ...old,
      services: old.services.map((service, i) =>
        i === index ? { ...service, ...patch } : service,
      ),
    }));
  }
  function exportConfig() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tuxtelly-config.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportDiagnostics() {
    const report = createDiagnosticReport(
      config,
      {
        version: state?.version ?? VERSION,
        grantedOrigins: state?.grantedOrigins ?? [],
      },
      navigator.userAgent,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tuxtelly-diagnostics.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function hasServiceAccess(service: Service) {
    const granted = new Set(state?.grantedOrigins ?? []);
    return service.origins.every((origin) =>
      granted.has(originPattern(origin)),
    );
  }
  async function launchService(service: Service) {
    if (!connected) {
      settings();
      return;
    }
    if (!hasServiceAccess(service) && client.grant) {
      try {
        const granted = await client.grant(service.origins.map(originPattern));
        if (!granted) {
          setMessage(
            `Allow TuxTelly to access ${service.name} so keyboard navigation and player controls can work.`,
          );
          return;
        }
        await refresh();
      } catch {
        setMessage(
          `Could not request access for ${service.name}. Open Settings and grant site access.`,
        );
        return;
      }
    }
    await request({ type: "open", serviceId: service.id });
  }
  const visibleServices = config.services.filter((service) => service.enabled);
  const lastUsed = config.services.find(
    (service) => service.id === state?.lastUsedServiceId && service.enabled,
  );
  const wallpaper =
    wallpaperPresets.find(
      (preset) => preset.id === config.preferences.wallpaper,
    ) ?? wallpaperPresets[0];
  const isRetroTheme = config.preferences.theme === "retro-vhs";
  return (
    <div
      className="app"
      data-theme={config.preferences.theme}
      style={
        {
          "--scale": config.preferences.scale,
          "--overscan": `${config.preferences.overscan}vw`,
          "--wallpaper-background": wallpaper.background,
          "--wallpaper-filter": wallpaper.filter ?? "none",
        } as CSSProperties
      }
      onKeyDown={navigate}
    >
      <header className="topbar">
        <a
          className="wordmark"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("library");
          }}
        >
          <Logo />
          <span>TuxTelly</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "library" ? "nav active" : "nav"}
            onClick={() => setView("library")}
          >
            Library
          </button>
          <button
            className={view === "search" ? "nav active" : "nav"}
            onClick={() => setView("search")}
          >
            Search
          </button>
          <button
            className={view === "settings" ? "nav active" : "nav"}
            onClick={settings}
          >
            Settings
          </button>
          <button
            className={view === "remote" ? "nav active" : "nav"}
            onClick={() => setView("remote")}
          >
            Remote
          </button>
        </nav>
        <div className="connection">
          <span className={connected ? "dot" : "dot offline"} />
          <span>{connected ? "Connected" : "Preview"}</span>
          <time>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
      </header>
      {message && (
        <div className="notice" role="status">
          <span>{message}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {view === "library" && (
        <main>
          <div className="intro">
            <p className="eyebrow">
              {isRetroTheme
                ? "TUXTELLY HOME VIDEO · CHANNEL 01"
                : "THE BEST SEAT IN THE HOUSE"}
            </p>
            <h1>
              {isRetroTheme ? "Tonight’s" : "Your TV."}
              <br />
              <span>{isRetroTheme ? "feature." : "Your rules."}</span>
            </h1>
            <p className="subtitle">
              {isRetroTheme
                ? "Pick a case, settle in, and enjoy the show."
                : "Your shows. One remote. Make yourself at home."}
            </p>
          </div>
          {showSetupGuide && (
            <section className="setup-guide" aria-labelledby="setup-title">
              <button
                className="dismiss-setup"
                aria-label="Dismiss getting started guide"
                title="Dismiss getting started guide"
                onClick={() => {
                  localStorage.setItem("tuxtelly.dismissedSetupGuide", "true");
                  setShowSetupGuide(false);
                }}
              >
                ×
              </button>
              <div>
                <p className="eyebrow">FIRST TIME HERE?</p>
                <h2 id="setup-title">Three steps to your shows</h2>
                <p>
                  Choose a service, allow TuxTelly to control that site, then
                  sign in on the service’s own page.
                </p>
              </div>
              <ol>
                <li>
                  <span className="step-done">1</span> Choose a service below or
                  add one in Settings.
                </li>
                <li>
                  <span className="step-done">2</span> Grant site access in
                  Settings. This enables navigation and player controls.
                </li>
                <li>
                  <span className="step-done">3</span> Sign in directly with the
                  provider. TuxTelly never asks for your password.
                </li>
              </ol>
              <div className="button-row setup-actions">
                <button onClick={settings}>Set up services</button>
                {lastUsed && (
                  <button
                    className="primary"
                    onClick={() => void launchService(lastUsed)}
                  >
                    Resume {lastUsed.name}
                  </button>
                )}
              </div>
            </section>
          )}
          <div className="section-label">
            <h2>{isRetroTheme ? "On the shelf" : "Your services"}</h2>
            <span>
              {visibleServices.length}{" "}
              {isRetroTheme ? "titles" : "in your collection"}
            </span>
          </div>
          <div className="services">
            {visibleServices.map((service, index) => (
              <div className="service-entry" key={service.id}>
                <button
                  data-service={service.id}
                  className="service-card"
                  style={{ "--service-color": service.color } as CSSProperties}
                  disabled={busy}
                  onFocus={() =>
                    sessionStorage.setItem("tuxtelly.selection", service.id)
                  }
                  onClick={() => void launchService(service)}
                >
                  <div className="card-top">
                    <span className="service-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {state?.openServices.includes(service.id) && (
                      <span className="open-tag">OPEN</span>
                    )}
                    {hasServiceAccess(service) && (
                      <span className="access-tag">READY</span>
                    )}
                    {state && !hasServiceAccess(service) && (
                      <span className="access-needed">ALLOW ACCESS</span>
                    )}
                  </div>
                  <div className={`service-symbol ${service.adapter}`}>
                    {service.adapter === "youtube"
                      ? "▶"
                      : service.adapter === "disney"
                        ? "D+"
                        : service.adapter === "hbo"
                          ? "HBO"
                          : service.adapter === "prime"
                            ? "prime"
                            : service.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="card-bottom">
                    <span>{service.name}</span>
                    <span>
                      {isRetroTheme ? "Play title" : "Open"}{" "}
                      <span aria-hidden="true">{isRetroTheme ? "▶" : "↗"}</span>
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>
          {client.kind === "extension" && (
            <p className="home-shortcuts">
              <kbd>Home</kbd> Return here · <kbd>F8</kbd> Open the service
              switcher · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd>{" "}
              Firefox-wide Home
            </p>
          )}
          <div className="under-library">
            <span className="quiet">
              {connected
                ? "Your accounts stay with your streaming services."
                : "Connect the Firefox extension to launch and control your services."}
            </span>
            <button className="text-button" onClick={settings}>
              Manage services <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="living-room">
            <span className="retro-tv" aria-hidden="true">
              <svg viewBox="0 0 64 52" fill="none">
                <path d="m20 8 10 8M44 8l-10 8" />
                <rect x="5" y="15" width="54" height="31" rx="6" />
                <rect x="11" y="20" width="34" height="21" rx="3" />
                <path d="M16 37V25h24v12M50 24h3m-3 6h3m-3 6h3M23 47v3m18-3v3M17 50h30" />
              </svg>
              <span>PLAY</span>
            </span>
            <div>
              <h3>A little more living room.</h3>
              <p>
                {isRetroTheme
                  ? "The lights are low. Your favorites are ready."
                  : "Powered by Linux. Ready for the sofa."}
              </p>
            </div>
            <span className="living-room-stamp">HOME VIDEO</span>
          </div>
        </main>
      )}
      {view === "search" && (
        <main
          className="settings search-page"
          onKeyDown={(event) => {
            if (navigateSearch(event.currentTarget, event.nativeEvent))
              event.stopPropagation();
          }}
        >
          <p className="eyebrow">FIND SOMETHING TO WATCH</p>
          <h1>
            Search <span>everywhere.</span>
          </h1>
          <p className="subtitle">
            Search titles and see which selected services list them in{" "}
            {searchRegion}. Listings do not confirm access through your
            subscription.
          </p>
          <form
            className="global-search"
            onSubmit={(event) => void runSearch(event)}
          >
            <input
              ref={searchInput}
              type="search"
              aria-label="Search movies and shows"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Movie or show title"
            />
            <button
              className="primary"
              disabled={searchBusy || !tmdbConfigured}
            >
              Search
            </button>
          </form>
          <p className="hint search-keyboard-hint">
            Use ↑ ↓ to move through filters and results · Enter to open · ← →
            move the query cursor
          </p>
          {!tmdbConfigured && (
            <p className="hint">
              Add a TMDB API key in Settings to enable search.
            </p>
          )}
          <div className="search-filters">
            <span>Included services</span>
            {config.services
              .filter((service) => service.enabled)
              .map((service) => (
                <label className="search-service" key={service.id}>
                  <input
                    type="checkbox"
                    checked={searchServices.includes(service.id)}
                    onChange={(event) =>
                      setSearchServices((old) =>
                        event.target.checked
                          ? [...old, service.id]
                          : old.filter((id) => id !== service.id),
                      )
                    }
                  />
                  {service.name}
                </label>
              ))}
          </div>
          <label className="search-paid-filter">
            <input
              type="checkbox"
              checked={includePaidOffers}
              onChange={(event) => setIncludePaidOffers(event.target.checked)}
            />
            Also show rent and buy offers
          </label>
          {searchStatus && (
            <p className="search-status" role="status">
              {searchStatus}
            </p>
          )}
          <div className="search-results">
            {searchResults.map((result) => (
              <article
                className="result-card"
                key={`${result.mediaType}-${result.tmdbId}`}
              >
                {result.posterUrl ? (
                  <img src={result.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="poster-placeholder">TUXTELLY</div>
                )}
                <div className="result-copy">
                  <span className="eyebrow">
                    {result.mediaType === "tv" ? "SERIES" : "MOVIE"}
                    {result.year ? ` · ${result.year}` : ""}
                  </span>
                  <h2>{result.title}</h2>
                  <p>{result.overview || "No description available."}</p>
                  <div className="result-services">
                    {result.matchedServices.map((match) => {
                      const service = config.services.find(
                        (entry) => entry.id === match.serviceId,
                      );
                      return service ? (
                        <button
                          key={`${match.serviceId}-${match.availability}`}
                          onClick={() => void launchService(service)}
                        >
                          Open {service.name} · {offerLabel(match.availability)}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {searchResults.length > 0 && (
            <p className="attribution">
              Movie and TV data provided by TMDB. Streaming availability powered
              by JustWatch.
            </p>
          )}
          {searchResults.length === 0 && !searchStatus && searchQuery && (
            <p className="hint">
              No matching titles found for the included services.
            </p>
          )}
        </main>
      )}
      {view === "settings" && (
        <main className="settings">
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>Your setup.</h1>
          <p className="subtitle">
            Changes stay on this Firefox profile. Save when you’re ready.
          </p>
          <section className="panel">
            <h2>Global search</h2>
            <p className="hint">
              Your TMDB key is stored only in this Firefox profile and used by
              the extension background. It is not included in settings exports
              or diagnostics. Anyone with access to this Firefox profile can
              inspect it.
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
                    onChange={(event) => setTmdbKey(event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button onClick={() => void testTmdb()}>Test key</button>
                  <button
                    className="primary"
                    onClick={() => void saveTmdbSettings()}
                  >
                    {tmdbKey
                      ? "Save key and search settings"
                      : "Save search settings"}
                  </button>
                  {tmdbConfigured && (
                    <button
                      className="danger"
                      onClick={() => void removeTmdbKey()}
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
                  onClick={() => void saveTmdbSettings()}
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
                    setSearchRegion(
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
                        setSearchServices((old) =>
                          event.target.checked
                            ? [...old, service.id]
                            : old.filter((id) => id !== service.id),
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
                Themes restyle the home screen and controls. Your selection
                previews immediately and saves with your settings.
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
                Choose a color, gradient, soft blur, or 4K photo. Save settings
                to keep your choice.
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
                        aria-pressed={
                          config.preferences.wallpaper === option.id
                        }
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
              Enable this in the dedicated TV profile to open TuxTelly after
              login. The setting is saved per Firefox profile.
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
                This is only useful when serving the launcher to multiple TVs.
                Leave it empty for local use.
              </p>
              {config.launcherUrl && (
                <button
                  onClick={() => {
                    try {
                      void client
                        .grant?.([originPattern(config.launcherUrl)])
                        .then((granted) => {
                          setMessage(
                            granted
                              ? "Launcher access granted. Save settings, then reload the launcher."
                              : "Access was not granted.",
                          );
                        })
                        .catch(() =>
                          setMessage(
                            "Could not grant launcher access. Try again from extension settings.",
                          ),
                        );
                    } catch {
                      setMessage("Enter a valid launcher address.");
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
              New services can launch immediately. Grant site access for
              navigation and player controls.
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
                <label>
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
                      updateService(index, {
                        backgroundAudio: e.target.checked,
                      })
                    }
                  />
                  Allow background audio
                </label>
                <div className="button-row">
                  <button
                    onClick={() => {
                      try {
                        void client
                          .grant?.(service.origins.map(originPattern))
                          .then((granted) => {
                            setMessage(
                              granted
                                ? `Access granted for ${service.name}.`
                                : "Access was not granted.",
                            );
                            if (granted) void refresh();
                          })
                          .catch(() =>
                            setMessage(
                              "Could not grant site access. Try again from extension settings.",
                            ),
                          );
                      } catch {
                        setMessage("Check the allowed origins.");
                      }
                    }}
                  >
                    Grant site access
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      setConfig({
                        ...config,
                        services: config.services.filter(
                          (s) => s.id !== service.id,
                        ),
                      })
                    }
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
            <button
              onClick={() =>
                setConfig({
                  ...config,
                  services: [
                    ...config.services,
                    {
                      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
                      name: "New service",
                      url: "https://example.com/",
                      origins: ["https://example.com"],
                      adapter: "generic",
                      color: "#5be5bc",
                      enabled: true,
                      backgroundAudio: false,
                    },
                  ],
                })
              }
            >
              + Add service
            </button>
          </section>
          <section className="panel">
            <h2>Configuration</h2>
            <div className="button-row">
              <button onClick={exportConfig}>Export JSON</button>
              <button onClick={() => fileInput.current?.click()}>
                Import JSON
              </button>
              <button
                onClick={() => {
                  setConfig(structuredClone(defaultConfig));
                  setMessage(
                    "Defaults loaded into the editor. Save to apply, or reload to discard.",
                  );
                }}
              >
                Load defaults
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 128_000)
                    throw new Error("Configuration is too large.");
                  setConfig(parseConfig(await file.text()));
                  setMessage(
                    "Import validated. Review the settings and save to apply.",
                  );
                } catch (error) {
                  setMessage(String(error));
                }
              }}
            />
          </section>
          <section className="panel">
            <h2>Privacy & troubleshooting</h2>
            <p className="hint">
              Settings exports contain your service addresses and layout, but
              never provider passwords or cookies. Diagnostics include basic
              app/browser versions and counts only; review the downloaded file
              before sharing it.
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
            <button
              className="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              Save settings
            </button>
            <button onClick={() => void refresh()}>Discard changes</button>
            <button onClick={() => setView("remote")}>
              Configure remote →
            </button>
          </div>
        </main>
      )}
      {view === "remote" && (
        <Remote
          config={config}
          onChange={setConfig}
          onSave={save}
          editable={client.kind === "extension"}
        />
      )}
      <footer>
        <div className="key-hints">
          <span>
            <kbd>↑ ↓ ← →</kbd> Navigate
          </span>
          <span>
            <kbd>Enter</kbd> Select
          </span>
          <span>
            <kbd>F8</kbd> Switch services
          </span>
        </div>
        <span>
          TuxTelly{" "}
          <span className="quiet">{state?.version ?? VERSION} · preview</span>
        </span>
      </footer>
    </div>
  );
}
function Remote({
  config,
  onChange,
  onSave,
  editable,
}: {
  config: Config;
  onChange: (config: Config) => void;
  onSave: () => Promise<void>;
  editable: boolean;
}) {
  const actionNames: Record<(typeof actions)[number], string> = {
    home: "Return to TuxTelly Home",
    switcher: "Open service switcher",
    next: "Next service tab",
    previous: "Previous service tab",
    back: "Back or close fullscreen",
    playPause: "Play / pause",
    seekBackward: "Seek backward",
    seekForward: "Seek forward",
    captions: "Toggle captions",
    fullscreen: "Toggle player fullscreen",
    mute: "Mute player",
    volumeUp: "Increase player volume",
    volumeDown: "Decrease player volume",
  };
  const [recording, setRecording] = useState(false);
  const [key, setKey] = useState<ReturnType<typeof eventBinding> | null>(null);
  const [code, setCode] = useState("");
  const [action, setAction] = useState<(typeof actions)[number]>("home");
  useEffect(() => {
    if (!recording) return;
    const listener = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setKey(eventBinding(event));
      setCode(
        `${event.code || "(no code)"}${event.repeat ? " · repeating" : ""}`,
      );
    };
    document.addEventListener("keydown", listener, true);
    return () => document.removeEventListener("keydown", listener, true);
  }, [recording]);
  return (
    <main className="settings">
      <p className="eyebrow">GET COMFORTABLE</p>
      <h1>
        A remote that
        <br />
        works your way.
      </h1>
      <section className="panel">
        <h2>Button tester</h2>
        <p>
          Start listening, then press a remote button. Only this screen records
          keys while listening.
        </p>
        <div className="key-capture" aria-live="polite">
          {key ? (
            <>
              <strong>
                {[
                  key.ctrl && "Ctrl",
                  key.alt && "Alt",
                  key.shift && "Shift",
                  key.meta && "Meta",
                  key.key === " " ? "Space" : key.key,
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </strong>
              <span>{code}</span>
            </>
          ) : (
            <span>{recording ? "Press a button…" : "Ready when you are."}</span>
          )}
        </div>
        <button className="primary" onClick={() => setRecording(!recording)}>
          {recording ? "Stop listening" : "Start listening"}
        </button>
        <p className="hint">
          Use the pointer to stop listening. Buttons handled by KDE, Firefox, or
          infrared may not appear here.
        </p>
        {editable && key && !recording && (
          <div className="button-row">
            <label>
              Action
              <select
                value={action}
                onChange={(e) =>
                  setAction(e.target.value as (typeof actions)[number])
                }
              >
                {actions.map((value) => (
                  <option key={value} value={value}>
                    {actionNames[value]}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                onChange({
                  ...config,
                  bindings: [
                    ...config.bindings.filter(
                      (binding) =>
                        !(
                          binding.key.toLowerCase() === key.key.toLowerCase() &&
                          binding.alt === key.alt &&
                          binding.ctrl === key.ctrl &&
                          binding.shift === key.shift &&
                          binding.meta === key.meta
                        ),
                    ),
                    { ...key, action },
                  ],
                })
              }
            >
              Assign button
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Your shortcuts</h2>
        <div className="bindings">
          {config.bindings.map((binding, i) => (
            <div key={i}>
              <kbd>
                {[
                  binding.ctrl && "Ctrl",
                  binding.alt && "Alt",
                  binding.shift && "Shift",
                  binding.meta && "Meta",
                  binding.key === " " ? "Space" : binding.key,
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </kbd>
              <span>{actionNames[binding.action]}</span>
              {editable && (
                <button
                  aria-label={`Remove ${binding.key} shortcut`}
                  onClick={() =>
                    onChange({
                      ...config,
                      bindings: config.bindings.filter(
                        (_, index) => i !== index,
                      ),
                    })
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {editable && (
        <button className="primary" onClick={() => void onSave()}>
          Save shortcuts
        </button>
      )}
      <p className="hint">
        Home returns to TuxTelly. F8 opens the service switcher. Alt+Shift+H is
        Firefox’s browser-wide Home shortcut; change it in Firefox → Add-ons →
        Manage Extension Shortcuts if another program uses that key. Left/right
        Arrow keys remain available to the streaming service. Use the remote’s
        gyro mouse for its menus and controls. System volume belongs to KDE;
        these volume keys adjust the active HTML video only.
      </p>
    </main>
  );
}
