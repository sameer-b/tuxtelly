import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  actions,
  configSchema,
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
export function App({ client }: { client: Client }) {
  const [config, setConfig] = useState<Config>(structuredClone(defaultConfig));
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<"library" | "settings" | "remote">(
    client.kind === "extension" &&
      new URLSearchParams(location.search).has("settings")
      ? "settings"
      : "library",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  async function refresh() {
    try {
      const reply = await client.request({ type: "state" });
      if (!reply.ok) throw new Error(reply.error);
      const next = reply.data as State;
      setConfig(configSchema.parse(next.config));
      setState(next);
      setConnected(true);
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
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = setTimeout(() => {
      const selected = sessionStorage.getItem("tuxtelly.selection");
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>("[data-service]"),
      ];
      (
        buttons.find((button) => button.dataset.service === selected) ??
        buttons[0]
      )?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [view, connected]);
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
  return (
    <div
      className="app"
      style={
        {
          "--scale": config.preferences.scale,
          "--overscan": `${config.preferences.overscan}vw`,
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
            <p className="eyebrow">THE BEST SEAT IN THE HOUSE</p>
            <h1>
              Your TV.
              <br />
              <span>Your rules.</span>
            </h1>
            <p className="subtitle">
              All your favorites. One remote. Make yourself at home.
            </p>
          </div>
          <div className="section-label">
            <h2>Your services</h2>
            <span>
              {config.services.filter((service) => service.enabled).length} in
              your collection
            </span>
          </div>
          <div className="services">
            {config.services
              .filter((service) => service.enabled)
              .map((service, index) => (
                <button
                  key={service.id}
                  data-service={service.id}
                  className="service-card"
                  style={{ "--service-color": service.color } as CSSProperties}
                  disabled={busy}
                  onFocus={() =>
                    sessionStorage.setItem("tuxtelly.selection", service.id)
                  }
                  onClick={() =>
                    connected
                      ? void request({ type: "open", serviceId: service.id })
                      : settings()
                  }
                >
                  <div className="card-top">
                    <span className="service-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {state?.openServices.includes(service.id) && (
                      <span className="open-tag">OPEN</span>
                    )}
                  </div>
                  <div className={`service-symbol ${service.adapter}`}>
                    {service.adapter === "youtube"
                      ? "▶"
                      : service.adapter === "disney"
                        ? "D+"
                        : service.adapter === "hbo"
                          ? "HBO"
                          : service.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="card-bottom">
                    <span>{service.name}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                </button>
              ))}
          </div>
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
            <span className="orbit" aria-hidden="true">
              ◎
            </span>
            <div>
              <h3>A little more living room.</h3>
              <p>Powered by Linux. Hosted by you.</p>
            </div>
            <span className="pill">OPEN SOURCE</span>
          </div>
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
            <h2>Home & display</h2>
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
              Leave empty to use the bundled home screen. Trust the address
              below after saving.
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
                  <span>{service.enabled ? "Enabled" : "Hidden"}</span>
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
                      {["generic", "youtube", "netflix", "disney", "hbo"].map(
                        (adapter) => (
                          <option key={adapter}>{adapter}</option>
                        ),
                      )}
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
                    disabled={index === 0}
                    onClick={() => {
                      const services = [...config.services];
                      [services[index - 1], services[index]] = [
                        services[index],
                        services[index - 1],
                      ];
                      setConfig({ ...config, services });
                    }}
                  >
                    Move up
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
          TuxTelly <span className="quiet">{VERSION} · preview</span>
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
                  <option key={value}>{value}</option>
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
              <span>{binding.action}</span>
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
        System volume uses KDE. Configure a browser-wide Home shortcut in
        Firefox → Add-ons → Manage Extension Shortcuts.
      </p>
    </main>
  );
}
