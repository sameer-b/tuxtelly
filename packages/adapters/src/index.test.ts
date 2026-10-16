import { describe, expect, it } from "vitest";
import { isPlaybackSurface, seek } from "./index";
describe("playback focus", () => {
  it("recognizes YouTube's focused player wrapper without stealing arrows from its buttons", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "html5-video-player";
    const video = document.createElement("video");
    const button = document.createElement("button");
    wrapper.append(video, button);
    expect(isPlaybackSurface(video, wrapper, "youtube")).toBe(true);
    expect(isPlaybackSurface(video, button, "youtube")).toBe(false);
    expect(isPlaybackSurface(video, wrapper, "generic")).toBe(false);
    expect(
      isPlaybackSurface(video, document.createElement("div"), "youtube"),
    ).toBe(false);
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
