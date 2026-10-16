import { describe, expect, it } from "vitest";
import { defaultConfig } from "@tuxtelly/core";
import { installControls, seek } from "./index";
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
