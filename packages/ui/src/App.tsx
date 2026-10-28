import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  configSchema,
  createDiagnosticReport,
  defaultConfig,
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
import { wallpaperPresets } from "./wallpapers";
import { Logo } from "./components/Logo";
import { LibraryView } from "./views/LibraryView";
import { SearchView, type SearchResult } from "./views/SearchView";
import { SettingsView } from "./views/SettingsView";
import { RemoteView } from "./views/RemoteView";
import { AboutView } from "./views/AboutView";

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

export function App({ client }: { client: Client }) {
  const [config, setConfig] = useState<Config>(structuredClone(defaultConfig));
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<
    "library" | "search" | "settings" | "remote" | "about"
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const aboutTitle = useRef<HTMLHeadingElement>(null);
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
    else if (view === "about")
      requestAnimationFrame(() => aboutTitle.current?.focus());
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
      setSearchResults(reply.data as SearchResult[]);
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
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
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
  function dismissSetupGuide() {
    localStorage.setItem("tuxtelly.dismissedSetupGuide", "true");
    setShowSetupGuide(false);
  }
  function grantSiteAccess(service: Service) {
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
  }
  function removeService(serviceId: string) {
    setConfig({
      ...config,
      services: config.services.filter((s) => s.id !== serviceId),
    });
  }
  function addService() {
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
    });
  }
  function loadDefaults() {
    setConfig(structuredClone(defaultConfig));
    setMessage(
      "Defaults loaded into the editor. Save to apply, or reload to discard.",
    );
  }
  async function importConfig(file?: File) {
    try {
      if (!file) return;
      if (file.size > 128_000) throw new Error("Configuration is too large.");
      setConfig(parseConfig(await file.text()));
      setMessage("Import validated. Review the settings and save to apply.");
    } catch (error) {
      setMessage(String(error));
    }
  }
  const lastUsed = config.services.find(
    (service) => service.id === state?.lastUsedServiceId && service.enabled,
  );
  const wallpaper =
    wallpaperPresets.find(
      (preset) => preset.id === config.preferences.wallpaper,
    ) ?? wallpaperPresets[0];
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
            data-search-nav="true"
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
        <LibraryView
          clientKind={client.kind}
          config={config}
          state={state}
          connected={connected}
          busy={busy}
          lastUsed={lastUsed}
          hasServiceAccess={hasServiceAccess}
          launchService={launchService}
          showSetupGuide={showSetupGuide}
          onDismissSetupGuide={dismissSetupGuide}
          onOpenSettings={settings}
        />
      )}
      {view === "search" && (
        <SearchView
          config={config}
          tmdbConfigured={tmdbConfigured}
          searchRegion={searchRegion}
          searchServices={searchServices}
          includePaidOffers={includePaidOffers}
          onSearchServicesChange={setSearchServices}
          onIncludePaidOffersChange={setIncludePaidOffers}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          onSearch={runSearch}
          searchStatus={searchStatus}
          searchBusy={searchBusy}
          searchInputRef={searchInput}
          launchService={launchService}
        />
      )}
      {view === "settings" && (
        <SettingsView
          client={client}
          config={config}
          busy={busy}
          onMessageChange={setMessage}
          refresh={refresh}
          save={save}
          onOpenRemote={() => setView("remote")}
          tmdbKey={tmdbKey}
          onTmdbKeyChange={setTmdbKey}
          tmdbConfigured={tmdbConfigured}
          onTestTmdb={() => void testTmdb()}
          onSaveTmdbSettings={() => void saveTmdbSettings()}
          onRemoveTmdbKey={() => void removeTmdbKey()}
          searchRegion={searchRegion}
          onSearchRegionChange={setSearchRegion}
          searchServices={searchServices}
          onSearchServicesChange={setSearchServices}
          setConfig={setConfig}
          updateService={updateService}
          hasServiceAccess={hasServiceAccess}
          onGrantSiteAccess={grantSiteAccess}
          onRemoveService={removeService}
          onAddService={addService}
          onLoadDefaults={loadDefaults}
          exportConfig={exportConfig}
          exportDiagnostics={exportDiagnostics}
          fileInputRef={fileInput}
          onImportConfig={importConfig}
        />
      )}
      {view === "remote" && (
        <RemoteView
          config={config}
          onChange={setConfig}
          onSave={save}
          editable={client.kind === "extension"}
        />
      )}
      {view === "about" && (
        <AboutView
          version={state?.version ?? VERSION}
          headingRef={aboutTitle}
          onBack={() => setView("library")}
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
        <button
          className="nav"
          data-view="about"
          onClick={() => setView("about")}
        >
          About & credits
        </button>
        <span>
          TuxTelly{" "}
          <span className="quiet">{state?.version ?? VERSION} · preview</span>
        </span>
      </footer>
    </div>
  );
}
