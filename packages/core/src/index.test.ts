import { describe, expect, it } from "vitest";
import {
  allowedServiceUrl,
  bindingId,
  configSchema,
  defaultConfig,
  isLauncher,
  matchAction,
  nearest,
  originPattern,
  parseConfig,
  ServiceTabs,
  type ManagedTab,
  type TabPort,
} from "./index";

describe("configuration boundaries", () => {
  it("round-trips defaults", () =>
    expect(parseConfig(JSON.stringify(defaultConfig))).toEqual(defaultConfig));
  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:secret@example.com/",
  ])("rejects unsafe address %s", (url) => {
    const config = structuredClone(defaultConfig);
    config.services[0].url = url;
    expect(configSchema.safeParse(config).success).toBe(false);
  });
  it("rejects duplicate service IDs and shortcut collisions", () => {
    const config = structuredClone(defaultConfig);
    config.services.push(config.services[0]);
    expect(configSchema.safeParse(config).success).toBe(false);
    config.services.pop();
    config.bindings.push(config.bindings[0]);
    expect(configSchema.safeParse(config).success).toBe(false);
  });
  it("rejects future schema versions without silently losing configuration", () =>
    expect(() =>
      parseConfig(JSON.stringify({ ...defaultConfig, version: 2 })),
    ).toThrow());
  it("rejects oversized imports", () =>
    expect(() => parseConfig(" ".repeat(128_001))).toThrow());
  it("requires exact service origins, including port and scheme", () => {
    const service = defaultConfig.services[0];
    expect(
      allowedServiceUrl(service, "https://www.youtube.com/watch?v=x"),
    ).toBe(true);
    for (const url of [
      "https://www.youtube.com.evil.test/",
      "http://www.youtube.com/",
      "https://www.youtube.com:444/",
      "https://youtube.com/",
    ])
      expect(allowedServiceUrl(service, url)).toBe(false);
  });
  it("does not trust sibling paths or other ports as the launcher", () => {
    const config = {
      ...defaultConfig,
      launcherUrl: "http://localhost:5173/tv/",
    };
    expect(isLauncher(config, "http://localhost:5173/tv/?x=1")).toBe(true);
    expect(isLauncher(config, "http://localhost:5173/other")).toBe(false);
    expect(isLauncher(config, "http://localhost:5174/tv/")).toBe(false);
    expect(originPattern(config.launcherUrl)).toBe("http://localhost/*");
  });
});
describe("input contexts", () => {
  it("protects text input and composition", () => {
    const input = document.createElement("input");
    document.body.append(input);
    let action: unknown = "unset";
    input.addEventListener("keydown", (event) => {
      action = matchAction(event, defaultConfig);
    });
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", bubbles: true }),
    );
    expect(action).toBeUndefined();
    input.remove();
    expect(
      matchAction(
        new KeyboardEvent("keydown", { key: "f", isComposing: true }),
        defaultConfig,
      ),
    ).toBeUndefined();
  });
  it("ignores toggle repeats and normalizes letter casing", () => {
    expect(
      matchAction(
        new KeyboardEvent("keydown", { key: "f", repeat: true }),
        defaultConfig,
      ),
    ).toBeUndefined();
    expect(
      matchAction(new KeyboardEvent("keydown", { key: "F" }), defaultConfig),
    ).toBe("fullscreen");
    expect(
      bindingId({
        key: "f",
        ctrl: true,
        alt: false,
        meta: false,
        shift: false,
      }),
    ).not.toBe(bindingId(defaultConfig.bindings.find((b) => b.key === "f")!));
  });
});
describe("spatial selection", () => {
  const current = { left: 100, top: 100, width: 40, height: 40 };
  const candidates = [
    { left: 50, top: 100, width: 40, height: 40 },
    { left: 150, top: 100, width: 40, height: 40 },
    { left: 100, top: 160, width: 40, height: 40 },
  ];
  it("moves in the requested direction and stays in aligned rows", () => {
    expect(nearest(current, candidates, "left")).toBe(0);
    expect(nearest(current, candidates, "right")).toBe(1);
    expect(nearest(current, candidates, "down")).toBe(2);
    expect(nearest(current, candidates, "up")).toBe(-1);
  });
  it("handles no candidates", () =>
    expect(nearest(current, [], "right")).toBe(-1));
});
describe("tab lifecycle", () => {
  function harness() {
    let nextId = 1;
    let tabs: ManagedTab[] = [];
    const tags = new Map<number, string>();
    const activated: number[] = [];
    const port: TabPort = {
      list: async (windowId) => tabs.filter((tab) => tab.windowId === windowId),
      serviceId: async (id) => tags.get(id),
      create: async (url, windowId) => {
        const tab = { id: nextId++, windowId, url };
        tabs.push(tab);
        return tab;
      },
      tag: async (id, service) => {
        tags.set(id, service);
      },
      activate: async (id) => {
        activated.push(id);
      },
    };
    return {
      manager: new ServiceTabs(port),
      tabs: () => tabs,
      close: () => {
        tabs = [];
      },
      activated,
      tags,
    };
  }
  it("deduplicates concurrent remote presses", async () => {
    const h = harness();
    await Promise.all(
      Array.from({ length: 20 }, () =>
        h.manager.open(defaultConfig.services[0], 1),
      ),
    );
    expect(h.tabs()).toHaveLength(1);
    expect(new Set(h.activated).size).toBe(1);
  });
  it("recreates a closed tab and separates windows", async () => {
    const h = harness();
    await h.manager.open(defaultConfig.services[0], 1);
    h.close();
    await h.manager.open(defaultConfig.services[0], 1);
    await h.manager.open(defaultConfig.services[0], 2);
    expect(h.tabs()).toHaveLength(2);
    expect(h.tabs()[0].id).toBe(2);
  });
  it("does not reuse a tagged tab that navigated to an unrelated origin", async () => {
    const h = harness();
    await h.manager.open(defaultConfig.services[0], 1);
    h.tabs()[0].url = "https://example.com/";
    await h.manager.open(defaultConfig.services[0], 1);
    expect(h.tabs()).toHaveLength(2);
  });
});
