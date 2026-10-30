import { describe, expect, it } from "vitest";
import {
  allowedServiceUrl,
  bindingId,
  configSchema,
  createDiagnosticReport,
  defaultConfig,
  defaultSearchServiceIds,
  allOfferTypes,
  isLauncher,
  matchServiceOffers,
  matchAction,
  migrateHulu,
  migratePeacock,
  migratePrimeVideo,
  migrateSearchServiceIds,
  nearest,
  originPattern,
  parseConfig,
  requestSchema,
  resolveProviderIds,
  ServiceTabs,
  streamingOfferTypes,
  type ManagedTab,
  type TabPort,
} from "./index";

describe("configuration boundaries", () => {
  it("round-trips defaults", () =>
    expect(parseConfig(JSON.stringify(defaultConfig))).toEqual(defaultConfig));
  it("drops legacy favorite flags when reading older configurations", () => {
    const oldConfig = structuredClone(defaultConfig);
    (oldConfig.services[0] as unknown as { favorite: boolean }).favorite = true;
    delete (oldConfig.preferences as { openHomeAtStartup?: boolean })
      .openHomeAtStartup;
    delete (oldConfig.preferences as { wallpaper?: string }).wallpaper;
    delete (oldConfig.preferences as { theme?: string }).theme;
    const migrated = parseConfig(JSON.stringify(oldConfig));
    expect(migrated.services.every((service) => !("favorite" in service))).toBe(
      true,
    );
    expect(migrated.preferences.openHomeAtStartup).toBe(false);
    expect(migrated.preferences.wallpaper).toBe("gradient-synthwave");
    expect(migrated.preferences.theme).toBe("retro-vhs");
  });
  it("offers a cozy retro default and recognized alternate themes", () => {
    expect(defaultConfig.preferences.theme).toBe("retro-vhs");
    expect(defaultConfig.preferences.wallpaper).toBe("gradient-synthwave");
    for (const theme of ["windows-95", "midnight"] as const) {
      const config = structuredClone(defaultConfig);
      config.preferences.theme = theme;
      expect(configSchema.parse(config).preferences.theme).toBe(theme);
    }
    const config = structuredClone(defaultConfig);
    (config.preferences as { theme: string }).theme = "unknown";
    expect(configSchema.safeParse(config).success).toBe(false);
  });
  it("adds Hulu by default and migrates existing configurations idempotently", () => {
    expect(
      defaultConfig.services.some((service) => service.id === "hulu"),
    ).toBe(true);
    const existing = structuredClone(defaultConfig);
    existing.services = existing.services.filter(
      (service) => service.id !== "hulu",
    );
    const upgraded = migrateHulu(existing);
    expect(upgraded.services.some((service) => service.id === "hulu")).toBe(
      true,
    );
    expect(migrateHulu(upgraded)).toBe(upgraded);
  });
  it("adds Peacock to the home service list and migrates older configs once", () => {
    const peacock = defaultConfig.services.find(
      (service) => service.id === "peacock",
    );
    expect(peacock).toMatchObject({
      name: "Peacock",
      url: "https://www.peacocktv.com/",
      origins: ["https://www.peacocktv.com"],
      adapter: "peacock",
      enabled: true,
    });
    expect(
      allowedServiceUrl(peacock!, "https://www.peacocktv.com/watch/asset"),
    ).toBe(true);
    const existing = structuredClone(defaultConfig);
    existing.services = existing.services.filter(
      (service) => service.id !== "peacock",
    );
    const upgraded = migratePeacock(existing);
    expect(upgraded.services.at(-1)?.id).toBe("peacock");
    expect(migratePeacock(upgraded)).toBe(upgraded);
    expect(existing.services.some((service) => service.id === "peacock")).toBe(
      false,
    );
    const defaultSearchIds = defaultSearchServiceIds(defaultConfig.services);
    expect(defaultSearchIds).toContain("peacock");
    expect(defaultSearchIds).toContain("hulu");
    const customGeneric = {
      ...defaultConfig.services[0],
      id: "custom-example",
      adapter: "generic" as const,
    };
    expect(
      defaultSearchServiceIds([...defaultConfig.services, customGeneric]),
    ).not.toContain("custom-example");
    expect(
      migrateSearchServiceIds(["netflix"], defaultConfig.services, ["peacock"]),
    ).toEqual(["netflix", "peacock"]);
    expect(
      migrateSearchServiceIds(["netflix", "peacock"], defaultConfig.services, [
        "peacock",
      ]),
    ).toEqual(["netflix", "peacock"]);
  });
  it("keeps service URLs and activity out of diagnostic reports", () => {
    const report = createDiagnosticReport(
      defaultConfig,
      {
        grantedOrigins: ["https://www.youtube.com/*"],
        version: "0.1.0",
      },
      "Firefox test",
      "2026-10-16T00:00:00.000Z",
    );
    expect(report.configuredServices).toBe(7);
    expect(JSON.stringify(report)).not.toContain("youtube.com");
    expect(JSON.stringify(report)).not.toContain("lastUsedServiceId");
  });
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
  it("includes Prime Video with an exact first-party origin and adapter", () => {
    const prime = defaultConfig.services.find(
      (service) => service.id === "prime",
    );
    expect(prime).toMatchObject({
      name: "Prime Video",
      url: "https://www.primevideo.com/",
      origins: ["https://www.primevideo.com"],
      adapter: "prime",
    });
    expect(
      allowedServiceUrl(prime!, "https://www.primevideo.com/detail/x"),
    ).toBe(true);
    expect(allowedServiceUrl(prime!, "https://primevideo.com/")).toBe(false);
  });
  it("adds Prime Video once when upgrading an existing saved config", () => {
    const existing = structuredClone(defaultConfig);
    existing.services = existing.services.filter(
      (service) => service.id !== "prime",
    );
    const upgraded = migratePrimeVideo(existing);
    expect(upgraded.services.at(-1)?.id).toBe("prime");
    expect(migratePrimeVideo(upgraded).services).toEqual(upgraded.services);
    expect(existing.services.some((service) => service.id === "prime")).toBe(
      false,
    );
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

describe("global search request boundary", () => {
  it("keeps rental and purchase categories opt-in", () => {
    expect(streamingOfferTypes).toEqual(["flatrate", "free", "ads"]);
    expect(allOfferTypes).toEqual(["flatrate", "free", "ads", "rent", "buy"]);
  });
  it("matches typography variants without crossing into similarly named providers", () => {
    const mappings = resolveProviderIds(
      [
        {
          id: "disney",
          adapter: "disney",
          name: "Disney+",
          url: "https://www.disneyplus.com/",
        },
        {
          id: "youtube",
          adapter: "youtube",
          name: "YouTube",
          url: "https://www.youtube.com/",
        },
      ],
      [
        { provider_id: 337, provider_name: "Disney Plus" },
        { provider_id: 338, provider_name: "Disney +" },
        { provider_id: 2739, provider_name: "Disney Plus Basic with Ads" },
        { provider_id: 339, provider_name: "Disney Channel" },
        { provider_id: 192, provider_name: "YouTube" },
        { provider_id: 2528, provider_name: "YouTube TV" },
        { provider_id: 386, provider_name: "Peacock Premium" },
        { provider_id: 387, provider_name: "Peacock Premium Plus" },
        {
          provider_id: 388,
          provider_name: "Peacock Premium Plus Amazon Channel",
        },
      ],
    );
    expect(mappings.get("disney")).toEqual([337, 338, 2739]);
    expect(mappings.get("youtube")).toEqual([192]);
    const peacockMappings = resolveProviderIds(
      [
        {
          id: "peacock",
          adapter: "generic",
          name: "Peacock",
          url: "https://www.peacocktv.com/",
        },
      ],
      [
        { provider_id: 386, provider_name: "Peacock Premium" },
        { provider_id: 387, provider_name: "Peacock Premium Plus" },
        {
          provider_id: 388,
          provider_name: "Peacock Premium Plus Amazon Channel",
        },
      ],
    );
    expect(peacockMappings.get("peacock")).toEqual([386, 387]);
  });
  it("matches services against the providers on each title offer", () => {
    const services = [
      {
        id: "disney",
        adapter: "disney",
        name: "Disney+",
        url: "https://www.disneyplus.com/",
      },
      {
        id: "hulu",
        adapter: "generic",
        name: "Hulu",
        url: "https://www.hulu.com/",
      },
      {
        id: "prime",
        adapter: "prime",
        name: "Prime Video",
        url: "https://www.primevideo.com/",
      },
      {
        id: "peacock",
        adapter: "generic",
        name: "Peacock",
        url: "https://www.peacocktv.com/",
      },
    ];
    const offers = {
      flatrate: [
        { provider_id: 2739, provider_name: "Disney Plus Basic with Ads" },
        { provider_id: 15, provider_name: "Hulu with Ads" },
        { provider_id: 386, provider_name: "Peacock Premium" },
      ],
      buy: [{ provider_id: 10, provider_name: "Amazon Video" }],
    };
    expect(matchServiceOffers(services, offers, streamingOfferTypes)).toEqual([
      { serviceId: "disney", availability: "flatrate" },
      { serviceId: "hulu", availability: "flatrate" },
      { serviceId: "peacock", availability: "flatrate" },
    ]);
    expect(matchServiceOffers(services, offers, allOfferTypes)).toEqual([
      { serviceId: "disney", availability: "flatrate" },
      { serviceId: "hulu", availability: "flatrate" },
      { serviceId: "prime", availability: "buy" },
      { serviceId: "peacock", availability: "flatrate" },
    ]);
  });
  it("accepts a bounded search request with an ISO region", () => {
    expect(
      requestSchema.parse({
        type: "search",
        query: "Dune",
        region: "US",
        serviceIds: ["prime"],
        includePaidOffers: false,
      }),
    ).toEqual({
      type: "search",
      query: "Dune",
      region: "US",
      serviceIds: ["prime"],
      includePaidOffers: false,
    });
  });
  it("rejects short searches and malformed regions", () => {
    expect(
      requestSchema.safeParse({
        type: "search",
        query: "x",
        region: "USA",
        serviceIds: ["prime"],
        includePaidOffers: false,
      }).success,
    ).toBe(false);
  });
  it("limits TMDB credentials to dedicated messages rather than app config", () => {
    expect(
      requestSchema.safeParse({
        type: "saveSearchSettings",
        apiKey: "secret",
        region: "US",
        serviceIds: [],
      }).success,
    ).toBe(true);
    expect(JSON.stringify(defaultConfig)).not.toContain("apiKey");
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
