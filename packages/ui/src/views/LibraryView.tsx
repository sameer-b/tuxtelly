import { type CSSProperties } from "react";
import {
  type Client,
  type Config,
  type Service,
  type State,
} from "@tuxtelly/core";

export type LibraryViewProps = {
  clientKind: Client["kind"];
  config: Config;
  state: State | null;
  connected: boolean;
  busy: boolean;
  lastUsed: Service | undefined;
  hasServiceAccess: (service: Service) => boolean;
  launchService: (service: Service) => Promise<void>;
  showSetupGuide: boolean;
  onDismissSetupGuide: () => void;
  onOpenSettings: () => void;
};

export function LibraryView({
  clientKind,
  config,
  state,
  connected,
  busy,
  lastUsed,
  hasServiceAccess,
  launchService,
  showSetupGuide,
  onDismissSetupGuide,
  onOpenSettings,
}: LibraryViewProps) {
  const visibleServices = config.services.filter((service) => service.enabled);
  const isRetroTheme = config.preferences.theme === "retro-vhs";
  return (
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
            onClick={onDismissSetupGuide}
          >
            ×
          </button>
          <div>
            <p className="eyebrow">FIRST TIME HERE?</p>
            <h2 id="setup-title">Three steps to your shows</h2>
            <p>
              Choose a service, allow TuxTelly to control that site, then sign
              in on the service’s own page.
            </p>
          </div>
          <ol>
            <li>
              <span className="step-done">1</span> Choose a service below or add
              one in Settings.
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
            <button onClick={onOpenSettings}>Set up services</button>
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
      {clientKind === "extension" && (
        <p className="home-shortcuts">
          <kbd>Home</kbd> Return here · <kbd>F8</kbd> Open the service switcher
          · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> Firefox-wide Home
        </p>
      )}
      <div className="under-library">
        <span className="quiet">
          {connected
            ? "Your accounts stay with your streaming services."
            : "Connect the Firefox extension to launch and control your services."}
        </span>
        <button className="text-button" onClick={onOpenSettings}>
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
  );
}
