import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "@tuxtelly/core";
import { installControls, playerAction, seek } from "./index";
describe("YouTube fullscreen", () => {
  const service = { ...defaultConfig.services[0], adapter: "youtube" as const };
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  function fixture() {
    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    video.style.width = "560px";
    const button = document.createElement("button");
    button.className = "ytp-fullscreen-button";
    button.setAttribute("aria-label", "Fullscreen");
    button.textContent = "Fullscreen";
    wrapper.append(video, button);
    document.body.append(wrapper);
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      width: 560,
      height: 315,
    } as DOMRect);
    const enter = vi.fn().mockResolvedValue(undefined);
    video.requestFullscreen = enter;
    const click = vi.spyOn(button, "click");
    return { video, button, enter, click };
  }
  it("uses the provider's available fullscreen control", async () => {
    const { button, enter, click } = fixture();
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      width: 40,
      height: 40,
    } as DOMRect);
    expect(await playerAction("fullscreen", service, defaultConfig)).toEqual({
      ok: true,
    });
    expect(click).toHaveBeenCalledOnce();
    expect(enter).not.toHaveBeenCalled();
  });
  it.each(["missing", "hidden", "disabled"])(
    "fullscreens the video when the provider control is %s",
    async (state) => {
      const { button, enter, click } = fixture();
      if (state === "missing") button.remove();
      if (state === "disabled") {
        button.disabled = true;
        vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
          width: 40,
          height: 40,
        } as DOMRect);
      }
      expect(await playerAction("fullscreen", service, defaultConfig)).toEqual({
        ok: true,
      });
      expect(enter).toHaveBeenCalledOnce();
      expect(click).not.toHaveBeenCalled();
    },
  );
  it("exits native fullscreen even if a provider control appears later", async () => {
    const { video, button, click } = fixture();
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      width: 40,
      height: 40,
    } as DOMRect);
    const exit = vi.fn().mockResolvedValue(undefined);
    // jsdom does not implement the Fullscreen API.
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => video,
    });
    document.exitFullscreen = exit;
    try {
      expect(await playerAction("fullscreen", service, defaultConfig)).toEqual({
        ok: true,
      });
      expect(exit).toHaveBeenCalledOnce();
      expect(click).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(document, "fullscreenElement");
      Reflect.deleteProperty(document, "exitFullscreen");
    }
  });
});
describe("provider arrow keys", () => {
  it("leaves arrow keys untouched on service pages", () => {
    const button = document.createElement("button");
    Object.defineProperty(button, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 40 }),
    });
    document.body.append(button);
    document.body.tabIndex = -1;
    document.body.focus();
    const controls = installControls(
      defaultConfig.services[0],
      defaultConfig,
      async () => {},
    );
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(document.body);
    controls.dispose();
    button.remove();
    document.body.removeAttribute("tabindex");
  });
});
describe("Peacock fullscreen", () => {
  const service = {
    ...defaultConfig.services.find((s) => s.id === "peacock")!,
    adapter: "peacock" as const,
  };
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  function fixture() {
    const wrapper = document.createElement("div");
    wrapper.className = "peacock-player-container";
    const video = document.createElement("video");
    video.style.width = "560px";
    const captionsBtn = document.createElement("button");
    captionsBtn.setAttribute("aria-label", "Captions");
    captionsBtn.className = "player-captions-button";
    captionsBtn.textContent = "CC";
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.setAttribute("aria-label", "Fullscreen");
    fullscreenBtn.className = "player-fullscreen-button";
    fullscreenBtn.setAttribute("data-testid", "fullscreen-button");
    fullscreenBtn.textContent = "Fullscreen";
    wrapper.append(video, captionsBtn, fullscreenBtn);
    document.body.append(wrapper);
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      width: 560,
      height: 315,
    } as DOMRect);
    vi.spyOn(captionsBtn, "getBoundingClientRect").mockReturnValue({
      width: 36,
      height: 36,
    } as DOMRect);
    const enter = vi.fn().mockResolvedValue(undefined);
    video.requestFullscreen = enter;
    const clickCaptions = vi.spyOn(captionsBtn, "click");
    const clickFullscreen = vi.spyOn(fullscreenBtn, "click");
    return {
      video,
      captionsBtn,
      fullscreenBtn,
      enter,
      clickCaptions,
      clickFullscreen,
    };
  }
  it("uses the Peacock fullscreen button", async () => {
    const { fullscreenBtn, enter, clickFullscreen } = fixture();
    Object.defineProperty(fullscreenBtn, "getBoundingClientRect", {
      value: () => ({ width: 36, height: 36 }),
    });
    expect(await playerAction("fullscreen", service, defaultConfig)).toEqual({
      ok: true,
    });
    expect(clickFullscreen).toHaveBeenCalledOnce();
    expect(enter).not.toHaveBeenCalled();
  });
  it("falls back to video.requestFullscreen when no button is found", async () => {
    const { video, enter } = fixture();
    const btn = document.querySelector(".player-fullscreen-button");
    btn?.remove();
    Object.defineProperty(video, "getBoundingClientRect", {
      value: () => ({ width: 560, height: 315 }),
    });
    expect(await playerAction("fullscreen", service, defaultConfig)).toEqual({
      ok: true,
    });
    expect(enter).toHaveBeenCalledOnce();
  });
});
describe("Peacock captions", () => {
  const service = {
    ...defaultConfig.services.find((s) => s.id === "peacock")!,
    adapter: "peacock" as const,
  };
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  function fixture() {
    const wrapper = document.createElement("div");
    wrapper.className = "peacock-player-container";
    const video = document.createElement("video");
    video.style.width = "560px";
    const captionsBtn = document.createElement("button");
    captionsBtn.setAttribute("aria-label", "Captions");
    captionsBtn.className = "player-captions-button";
    captionsBtn.setAttribute("data-testid", "captions-button");
    captionsBtn.textContent = "CC";
    const track = document.createElement("track");
    track.kind = "captions";
    track.srclang = "en";
    video.append(track);
    wrapper.append(video, captionsBtn);
    document.body.append(wrapper);
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      width: 560,
      height: 315,
    } as DOMRect);
    const clickCaptions = vi.spyOn(captionsBtn, "click");
    return { video, captionsBtn, clickCaptions };
  }
  it("uses the Peacock captions button", async () => {
    const { captionsBtn, clickCaptions } = fixture();
    Object.defineProperty(captionsBtn, "getBoundingClientRect", {
      value: () => ({ width: 36, height: 36 }),
    });
    expect(await playerAction("captions", service, defaultConfig)).toEqual({
      ok: true,
    });
    expect(clickCaptions).toHaveBeenCalledOnce();
  });
});
describe("seeking", () => {
  function video(position: number, pairs: [number, number][]) {
    return {
      currentTime: position,
      seekable: {
        length: pairs.length,
        start: (i: number) => pairs[i][0],
        end: (i: number) => pairs[i][1],
      },
    } as HTMLVideoElement;
  }
  it("clamps to a live DVR window", () => {
    const v = video(105, [[100, 180]]);
    expect(seek(v, -10).ok).toBe(true);
    expect(v.currentTime).toBe(100);
    seek(v, 1000);
    expect(v.currentTime).toBe(180);
  });
  it("skips gaps in the direction of travel", () => {
    const v = video(9, [
      [0, 10],
      [20, 30],
    ]);
    seek(v, 5);
    expect(v.currentTime).toBe(20);
    seek(v, -5);
    expect(v.currentTime).toBe(10);
  });
  it("reports nonseekable media", () => {
    const v = video(0, []);
    expect(seek(v, 10).ok).toBe(false);
    expect(v.currentTime).toBe(0);
  });
});
