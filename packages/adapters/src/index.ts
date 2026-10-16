import {
  bindingId,
  eventBinding,
  isEditing,
  matchAction,
  nearest,
  type Action,
  type Config,
  type Service,
} from "@tuxtelly/core";

export type Result = { ok: boolean; message?: string };
export function activeVideo(
  root: ParentNode = document,
): HTMLVideoElement | undefined {
  return [...root.querySelectorAll("video")]
    .filter((v) => v.getBoundingClientRect().width > 0)
    .sort(
      (a, b) =>
        Number(b.paused === false) - Number(a.paused === false) ||
        b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
    )[0];
}
export function seek(video: HTMLVideoElement, delta: number): Result {
  if (!Number.isFinite(video.currentTime))
    return { ok: false, message: "Playback position is unavailable." };
  const ranges = video.seekable;
  if (!ranges.length)
    return { ok: false, message: "This stream cannot be seeked right now." };
  const wanted = video.currentTime + delta;
  let target = Math.max(
    ranges.start(0),
    Math.min(ranges.end(ranges.length - 1), wanted),
  );
  for (let i = 0; i < ranges.length - 1; i++) {
    if (target > ranges.end(i) && target < ranges.start(i + 1))
      target = delta > 0 ? ranges.start(i + 1) : ranges.end(i);
  }
  video.currentTime = target;
  return { ok: true };
}
export function isPlaybackSurface(
  video: HTMLVideoElement,
  selected: Element | null,
  adapter: Service["adapter"],
): boolean {
  return (
    selected === document.body ||
    selected === video ||
    (adapter === "youtube" &&
      selected?.matches(".html5-video-player") === true &&
      selected.contains(video))
  );
}
const selectors: Record<
  Service["adapter"],
  { captions: string; fullscreen: string }
> = {
  youtube: {
    captions: '.ytp-subtitles-button:not([aria-label*="unavailable" i])',
    fullscreen: ".ytp-fullscreen-button",
  },
  netflix: {
    captions: '[data-uia="control-audio-subtitle"]',
    fullscreen:
      '[data-uia="control-fullscreen-enter"], [data-uia="control-fullscreen-exit"]',
  },
  disney: {
    captions: 'button[aria-label*="subtitle" i], button[aria-label*="audio" i]',
    fullscreen:
      'button[aria-label*="full screen" i], button[aria-label*="fullscreen" i]',
  },
  hbo: {
    captions: 'button[aria-label*="subtitle" i], button[aria-label*="audio" i]',
    fullscreen:
      'button[aria-label*="full screen" i], button[aria-label*="fullscreen" i]',
  },
  generic: {
    captions:
      'button[aria-label*="caption" i], button[aria-label*="subtitle" i]',
    fullscreen: 'button[aria-label*="fullscreen" i]',
  },
};
export async function playerAction(
  action: Action | "pause",
  service: Service,
  config: Config,
): Promise<Result> {
  const video = activeVideo();
  if (!video) return { ok: false, message: "No active video found." };
  try {
    if (action === "playPause") {
      if (video.paused) await video.play();
      else video.pause();
    } else if (action === "pause") {
      video.pause();
      return { ok: video.paused };
    } else if (action === "seekBackward" || action === "seekForward")
      return seek(
        video,
        config.preferences.seekSeconds * (action === "seekBackward" ? -1 : 1),
      );
    else if (action === "mute") video.muted = !video.muted;
    else if (action === "volumeUp" || action === "volumeDown")
      video.volume = Math.max(
        0,
        Math.min(
          1,
          video.volume +
            config.preferences.volumeStep * (action === "volumeUp" ? 1 : -1),
        ),
      );
    else if (action === "captions" || action === "fullscreen") {
      const button = [
        ...document.querySelectorAll<HTMLElement>(
          selectors[service.adapter][action],
        ),
      ].find(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          !el.matches(':disabled, [aria-disabled="true"]'),
      );
      if (button) button.click();
      else if (action === "fullscreen") {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await (video.parentElement ?? video).requestFullscreen();
      } else {
        const tracks = [...video.textTracks].filter((track) =>
          ["subtitles", "captions"].includes(track.kind),
        );
        if (!tracks.length)
          return {
            ok: false,
            message: "Open the provider’s subtitle menu to select captions.",
          };
        const showing = tracks.some((track) => track.mode === "showing");
        tracks.forEach((track, index) => {
          track.mode = !showing && index === 0 ? "showing" : "disabled";
        });
      }
    } else
      return { ok: false, message: "This action is not a player control." };
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "The provider could not perform this control. Try its player controls.",
    };
  }
}
function focusables(): HTMLElement[] {
  const dialog = [
    ...document.querySelectorAll<HTMLElement>(
      'dialog[open], [role="dialog"][aria-modal="true"]',
    ),
  ].find((el) => el.getBoundingClientRect().width > 0);
  return [
    ...(dialog ?? document).querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]',
    ),
  ].filter(
    (el) =>
      !el.closest('[inert],[hidden],[aria-hidden="true"]') &&
      !el.matches(':disabled,[aria-disabled="true"]') &&
      el.getBoundingClientRect().width > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
}
export function installControls(
  service: Service,
  initialConfig: Config,
  send: (action: "home" | "next" | "previous" | string) => Promise<void>,
) {
  let config = initialConfig;
  let overlay: HTMLElement | undefined;
  let oldOutline = "";
  let lastFocused: HTMLElement | undefined;
  function focus(el: HTMLElement) {
    if (lastFocused) lastFocused.style.outline = oldOutline;
    oldOutline = el.style.outline;
    lastFocused = el;
    if (
      !el.hasAttribute("tabindex") &&
      !el.matches("a,button,input,select,textarea")
    )
      el.tabIndex = -1;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.style.outline = "3px solid #91eeb9";
  }
  function toast(message: string) {
    const node = document.createElement("div");
    node.textContent = message;
    node.style.cssText =
      "position:fixed;bottom:5vh;left:5vw;z-index:2147483647;background:#14251c;color:#fff;padding:16px 24px;border:1px solid #91eeb9;border-radius:10px;font:18px system-ui;max-width:85vw";
    (document.fullscreenElement ?? document.body).append(node);
    setTimeout(() => node.remove(), 3500);
  }
  function closeSwitcher() {
    overlay?.remove();
    overlay = undefined;
    lastFocused?.focus();
  }
  async function switcher() {
    if (overlay) {
      closeSwitcher();
      return;
    }
    if (document.fullscreenElement instanceof HTMLVideoElement)
      await document.exitFullscreen();
    overlay = document.createElement("div");
    overlay.dataset.tuxtelly = "switcher";
    const root = overlay.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{all:initial;position:fixed;inset:0;z-index:2147483647;background:#07120cdd;display:grid;place-items:center;font:20px system-ui;color:#fff}.panel{background:#17251d;padding:32px;border:1px solid #789c80;border-radius:18px;max-width:90vw}h2{margin-top:0}.row{display:flex;gap:14px;flex-wrap:wrap}button{font:inherit;background:#293e30;color:#eef8f0;border:1px solid #779782;padding:18px;border-radius:10px;cursor:pointer}button:focus{outline:3px solid #a6f0bf;outline-offset:4px}p{color:#adbfaf;font-size:14px}";
    root.append(style);
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Switch service");
    panel.setAttribute("aria-modal", "true");
    const heading = document.createElement("h2");
    heading.textContent = "Where to next?";
    panel.append(heading);
    const row = document.createElement("div");
    row.className = "row";
    for (const item of [
      { id: "", name: "TuxTelly home" },
      ...config.services.filter((s) => s.enabled),
    ]) {
      const button = document.createElement("button");
      button.textContent = item.name;
      button.onclick = () => {
        closeSwitcher();
        void send(item.id ? `open:${item.id}` : "home").catch(() =>
          toast("Could not switch services. Use the extension Home button."),
        );
      };
      row.append(button);
    }
    panel.append(row);
    const close = document.createElement("button");
    close.textContent = "Close";
    close.onclick = closeSwitcher;
    panel.append(close);
    root.append(panel);
    (document.fullscreenElement ?? document.body).append(overlay);
    row.querySelector("button")?.focus();
    overlay.addEventListener("keydown", (event) => {
      event.stopPropagation();
      const buttons = [...root.querySelectorAll("button")];
      const current = buttons.indexOf(root.activeElement as HTMLButtonElement);
      if (
        ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Tab"].includes(
          event.key,
        )
      ) {
        event.preventDefault();
        const sign =
          ["ArrowLeft", "ArrowUp"].includes(event.key) || event.shiftKey
            ? -1
            : 1;
        buttons[(current + sign + buttons.length) % buttons.length]?.focus();
      }
      if (event.key === "Escape" || event.key === "F8") {
        event.preventDefault();
        closeSwitcher();
      }
    });
  }
  const onKey = (event: KeyboardEvent) => {
    if (
      overlay ||
      event.defaultPrevented ||
      event.isComposing ||
      isEditing(event.composedPath()[0] ?? event.target)
    )
      return;
    const action = matchAction(event, config);
    if (
      event.repeat &&
      !action &&
      config.bindings.some(
        (binding) => bindingId(binding) === bindingId(eventBinding(event)),
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action === "home" || action === "next" || action === "previous")
        void send(action).catch(() =>
          toast("Use the Firefox extension button to return home."),
        );
      else if (action === "switcher") void switcher();
      else if (action === "back") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else if (history.length > 1) history.back();
        else void send("home");
      } else
        void playerAction(action, service, config).then((result) => {
          if (!result.ok && result.message) toast(result.message);
        });
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
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
    const video = activeVideo();
    const selected = document.activeElement;
    if (
      video &&
      !video.paused &&
      isPlaybackSurface(video, selected, service.adapter) &&
      ["left", "right"].includes(direction)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void playerAction(
        direction === "left" ? "seekBackward" : "seekForward",
        service,
        config,
      );
      return;
    }
    const elements = focusables();
    if (!elements.length) return;
    const current = elements.indexOf(selected as HTMLElement);
    const index =
      current < 0
        ? 0
        : nearest(
            elements[current].getBoundingClientRect(),
            elements.map((el) => el.getBoundingClientRect()),
            direction,
          );
    event.preventDefault();
    event.stopImmediatePropagation();
    if (index >= 0) focus(elements[index]);
    else
      window.scrollBy({
        top:
          direction === "down"
            ? innerHeight * 0.65
            : direction === "up"
              ? -innerHeight * 0.65
              : 0,
        left:
          direction === "right"
            ? innerWidth * 0.5
            : direction === "left"
              ? -innerWidth * 0.5
              : 0,
        behavior: "instant",
      });
  };
  document.addEventListener("keydown", onKey, true);
  return {
    update(next: Config) {
      config = next;
    },
    dispose() {
      document.removeEventListener("keydown", onKey, true);
      closeSwitcher();
      if (lastFocused) lastFocused.style.outline = oldOutline;
    },
    pause: () => playerAction("pause", service, config),
    switcher,
  };
}
