import { useEffect, useState } from "react";
import { actions, eventBinding, type Config } from "@tuxtelly/core";

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

export type RemoteViewProps = {
  config: Config;
  onChange: (config: Config) => void;
  onSave: () => Promise<void>;
  editable: boolean;
};

export function RemoteView({
  config,
  onChange,
  onSave,
  editable,
}: RemoteViewProps) {
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
