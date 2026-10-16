import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import {
  allowedServiceUrl,
  configSchema,
  defaultConfig,
  defaultSearchServiceIds,
  allOfferTypes,
  isLauncher,
  migrateHulu,
  migratePeacock,
  migrateSearchServiceIds,
  migratePrimeVideo,
  originPattern,
  requestSchema,
  matchServiceOffers,
  ServiceTabs,
  streamingOfferTypes,
  VERSION,
  type Config,
  type ManagedTab,
  type Reply,
} from "@tuxtelly/core";

type Sessions = {
  getTabValue(id: number, key: string): Promise<unknown>;
  setTabValue(id: number, key: string, value: unknown): Promise<void>;
  getWindowValue(id: number, key: string): Promise<unknown>;
  setWindowValue(id: number, key: string, value: unknown): Promise<void>;
};
const sessions = browser.sessions as unknown as Sessions;
const tag = "tuxtelly.service";
export default defineBackground(() => {
  let config: Config = structuredClone(defaultConfig);
  let recovery: string | undefined;
  let lastUsedServiceId: string | undefined;
  const tmdbBase = "https://api.themoviedb.org/3";
  const searchCache = new Map<string, { at: number; results: unknown[] }>();
  const fetchTmdb = async <T>(path: string, apiKey: string): Promise<T> => {
    const url = new URL(`${tmdbBase}${path}`);
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error(
          "TMDB rejected this API key. Check the key in Settings.",
        );
      if (response.status === 429)
        throw new Error(
          "TMDB rate limit reached. Wait a moment and try again.",
        );
      throw new Error(`TMDB request failed (${response.status}).`);
    }
    return (await response.json()) as T;
  };
  async function tmdbSearch(
    query: string,
    region: string,
    serviceIds: string[],
    includePaidOffers: boolean,
  ) {
    const stored = await browser.storage.local.get("tmdbApiKey");
    const apiKey =
      typeof stored.tmdbApiKey === "string" ? stored.tmdbApiKey.trim() : "";
    if (!apiKey)
      throw new Error("Add your TMDB API key in Settings to search.");
    const key = `${query.trim().toLowerCase()}|${region}|${includePaidOffers}|${[...serviceIds].sort().join(",")}`;
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.at < 300_000) return cached.results;
    const selectedServices = serviceIds.flatMap((serviceId) => {
      const service = config.services.find((entry) => entry.id === serviceId);
      return service ? [service] : [];
    });
    const found = await fetchTmdb<{ results?: Array<Record<string, unknown>> }>(
      `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&region=${region}`,
      apiKey,
    );
    const candidates = (found.results ?? [])
      .filter(
        (item) =>
          (item.media_type === "movie" || item.media_type === "tv") &&
          typeof item.id === "number",
      )
      .slice(0, 12);
    const matched: unknown[] = [];
    for (let i = 0; i < candidates.length; i += 4) {
      await Promise.all(
        candidates.slice(i, i + 4).map(async (item) => {
          const media = item.media_type as "movie" | "tv";
          const availability = await fetchTmdb<{
            results?: Record<
              string,
              {
                flatrate?: { provider_id: number; provider_name: string }[];
                free?: { provider_id: number; provider_name: string }[];
                ads?: { provider_id: number; provider_name: string }[];
                rent?: { provider_id: number; provider_name: string }[];
                buy?: { provider_id: number; provider_name: string }[];
              }
            >;
          }>(`/${media}/${item.id}/watch/providers`, apiKey);
          const offers = availability.results?.[region];
          if (!offers) return;
          const categories = includePaidOffers
            ? allOfferTypes
            : streamingOfferTypes;
          const matchedServices = matchServiceOffers(
            selectedServices,
            offers,
            categories,
          );
          if (!matchedServices.length) return;
          matched.push({
            tmdbId: item.id,
            mediaType: media,
            title: String(item.title ?? item.name ?? "Untitled"),
            year:
              String(item.release_date ?? item.first_air_date ?? "").slice(
                0,
                4,
              ) || null,
            overview: String(item.overview ?? ""),
            posterUrl:
              typeof item.poster_path === "string"
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : null,
            matchedServices,
          });
        }),
      );
    }
    const results = candidates.flatMap((candidate) =>
      matched.filter(
        (item) => (item as { tmdbId: number }).tmdbId === candidate.id,
      ),
    );
    searchCache.set(key, { at: Date.now(), results });
    return results;
  }
  const ready = browser.storage.local
    .get([
      "config",
      "lastValidConfig",
      "lastUsedServiceId",
      "primeServiceMigration",
      "huluServiceMigration",
      "peacockServiceMigration",
    ])
    .then(async (stored) => {
      if (typeof stored.lastUsedServiceId === "string")
        lastUsedServiceId = stored.lastUsedServiceId;
      if (stored.config === undefined) return;
      const parsed = configSchema.safeParse(stored.config);
      let canMigrate = parsed.success;
      if (parsed.success) config = parsed.data;
      else {
        const backup = configSchema.safeParse(stored.lastValidConfig);
        if (backup.success) config = backup.data;
        canMigrate = backup.success;
        recovery =
          "Your saved configuration could not be loaded. A valid backup or defaults are in use; review settings before saving.";
      }
      if (canMigrate && stored.primeServiceMigration !== true) {
        config = migratePrimeVideo(config);
        await browser.storage.local.set({
          config,
          lastValidConfig: config,
          primeServiceMigration: true,
        });
      }
      if (canMigrate && stored.huluServiceMigration !== true) {
        config = migrateHulu(config);
        await browser.storage.local.set({
          config,
          lastValidConfig: config,
          huluServiceMigration: true,
        });
      }
      if (canMigrate && stored.peacockServiceMigration !== true) {
        config = migratePeacock(config);
        await browser.storage.local.set({
          config,
          lastValidConfig: config,
          peacockServiceMigration: true,
        });
      }
    });
  const serviceFor = async (tabId: number, url?: string) => {
    const id = await sessions.getTabValue(tabId, tag).catch(() => undefined);
    return config.services.find(
      (service) =>
        service.enabled && service.id === id && allowedServiceUrl(service, url),
    );
  };
  const port = new ServiceTabs({
    list: async (windowId) =>
      (await browser.tabs.query({ windowId })).filter(
        (tab) => tab.id !== undefined,
      ) as ManagedTab[],
    serviceId: async (tabId) =>
      (await sessions.getTabValue(tabId, tag).catch(() => undefined)) as
        string | undefined,
    create: async (url, windowId) =>
      (await browser.tabs.create({
        url,
        windowId,
        active: false,
      })) as ManagedTab,
    tag: (tabId, id) => sessions.setTabValue(tabId, tag, id),
    activate: async (tabId) => {
      await browser.tabs.update(tabId, { active: true });
    },
  });
  async function managedWindow(hint?: number): Promise<number> {
    for (const window of await browser.windows.getAll({
      windowTypes: ["normal"],
    })) {
      if (
        window.id !== undefined &&
        (await sessions
          .getWindowValue(window.id, "tuxtelly.window")
          .catch(() => false))
      )
        return window.id;
    }
    const id = hint ?? (await browser.windows.getLastFocused()).id;
    if (id === undefined) throw new Error("Open a Firefox window first.");
    await sessions.setWindowValue(id, "tuxtelly.window", true);
    return id;
  }
  async function pause(tabId: number): Promise<boolean> {
    const result = await Promise.race([
      browser.tabs.sendMessage(tabId, { control: "pause" }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    return result?.ok === true;
  }
  async function pauseOthers(windowId: number, targetService?: string) {
    for (const tab of await browser.tabs.query({ windowId })) {
      if (tab.id === undefined) continue;
      const service = await serviceFor(tab.id, tab.url);
      if (!service || service.id === targetService || service.backgroundAudio)
        continue;
      if (!(await pause(tab.id)) && !tab.mutedInfo?.muted) {
        await sessions.setTabValue(tab.id, "tuxtelly.muted", true);
        await browser.tabs.update(tab.id, { muted: true });
      }
    }
  }
  async function inject(tabId: number) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!isLauncher(config, tab.url) && !(await serviceFor(tabId, tab.url)))
        return;
      if (
        !tab.url ||
        !(await browser.permissions.contains({
          origins: [originPattern(tab.url)],
        }))
      )
        return;
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/controller.js"],
      });
    } catch {
      /* Navigating, unpermitted, or closed tabs are retried on the next completion. */
    }
  }
  let transition: Promise<unknown> = Promise.resolve();
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const task = transition.then(operation);
    transition = task.catch(() => undefined);
    return task;
  }
  async function openService(id: string, hint?: number) {
    return serialized(async () => {
      const service = config.services.find(
        (item) => item.id === id && item.enabled,
      );
      if (!service) throw new Error("This service is disabled or was removed.");
      const windowId = await managedWindow(hint);
      await pauseOthers(windowId, service.id);
      const tab = await port.open(service, windowId);
      lastUsedServiceId = service.id;
      if (config.services[0]?.id !== service.id) {
        config = {
          ...config,
          services: [
            service,
            ...config.services.filter((item) => item.id !== service.id),
          ],
        };
      }
      await browser.storage.local.set({
        config,
        lastValidConfig: config,
        lastUsedServiceId,
      });
      await inject(tab.id);
      if (
        await sessions.getTabValue(tab.id, "tuxtelly.muted").catch(() => false)
      ) {
        await pause(tab.id);
        await browser.tabs.update(tab.id, { muted: false });
        await sessions.setTabValue(tab.id, "tuxtelly.muted", false);
      }
      await browser.windows.update(windowId, {
        focused: true,
        ...(config.preferences.fullscreenWindow
          ? { state: "fullscreen" as const }
          : {}),
      });
      return { tabId: tab.id };
    });
  }
  async function home(hint?: number) {
    return serialized(async () => {
      const windowId = await managedWindow(hint);
      await pauseOthers(windowId);
      let url = browser.runtime.getURL("/home.html");
      if (
        config.launcherUrl &&
        (await browser.permissions.contains({
          origins: [originPattern(config.launcherUrl)],
        }))
      ) {
        try {
          const response = await fetch(config.launcherUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(1500),
            credentials: "omit",
          });
          if (response.ok) url = config.launcherUrl;
        } catch {
          /* The bundled launcher is the offline fallback. */
        }
      }
      const tabs = await browser.tabs.query({ windowId });
      const existing = tabs.find((tab) =>
        url.startsWith("moz-extension:")
          ? tab.url?.split("?")[0] === url
          : isLauncher(config, tab.url),
      );
      if (existing?.id !== undefined)
        await browser.tabs.update(existing.id, { active: true });
      else
        await browser.tabs.create({
          url,
          windowId,
          active: true,
          pinned: true,
        });
      if (config.preferences.fullscreenWindow)
        await browser.windows.update(windowId, { state: "fullscreen" });
    });
  }
  async function cycle(direction: 1 | -1, hint?: number) {
    const windowId = await managedWindow(hint);
    const [tab] = await browser.tabs.query({ windowId, active: true });
    const active =
      tab?.id === undefined
        ? undefined
        : await sessions.getTabValue(tab.id, tag).catch(() => undefined);
    const services = config.services.filter((service) => service.enabled);
    if (!services.length) return;
    const index = services.findIndex((service) => service.id === active);
    const next =
      index < 0
        ? direction === 1
          ? 0
          : services.length - 1
        : (index + direction + services.length) % services.length;
    return openService(services[next].id, windowId);
  }
  let registration: Promise<unknown> = Promise.resolve();
  function registerScripts() {
    const task = registration.then(async () => {
      await ready;
      const patterns = [
        ...new Set(
          [
            ...config.services
              .filter((s) => s.enabled)
              .flatMap((s) => s.origins),
            ...(config.launcherUrl ? [config.launcherUrl] : []),
          ].map(originPattern),
        ),
      ];
      const permitted: string[] = [];
      for (const pattern of patterns)
        if (await browser.permissions.contains({ origins: [pattern] }))
          permitted.push(pattern);
      const existing = await browser.scripting.getRegisteredContentScripts({
        ids: ["tuxtelly-controller"],
      });
      if (existing.length)
        await browser.scripting.unregisterContentScripts({
          ids: ["tuxtelly-controller"],
        });
      if (permitted.length)
        await browser.scripting.registerContentScripts([
          {
            id: "tuxtelly-controller",
            matches: permitted,
            js: ["content-scripts/controller.js"],
            runAt: "document_idle",
            allFrames: false,
          },
        ]);
      for (const tab of await browser.tabs.query({}))
        if (tab.id !== undefined) await inject(tab.id);
    });
    registration = task.catch(() => undefined);
    return task;
  }
  async function handle(
    raw: unknown,
    sender: Browser.runtime.MessageSender,
  ): Promise<Reply> {
    try {
      await ready;
      if (
        sender.id !== browser.runtime.id ||
        (sender.frameId !== undefined && sender.frameId !== 0)
      )
        throw new Error("Untrusted message sender.");
      const own = sender.url?.startsWith(browser.runtime.getURL("/")) === true;
      if (
        !own &&
        (!sender.url ||
          !(await browser.permissions.contains({
            origins: [originPattern(sender.url)],
          })))
      )
        throw new Error("Site permission is required.");
      const launcher = isLauncher(config, sender.url);
      const service =
        sender.tab?.id === undefined
          ? undefined
          : await serviceFor(sender.tab.id, sender.url);
      if (!own && !launcher && !service)
        throw new Error("This page is not managed by TuxTelly.");
      const message = requestSchema.parse(raw);
      if (message.type === "context")
        return {
          ok: true,
          data: launcher
            ? { role: "launcher" }
            : service
              ? { role: "service", service, config }
              : { role: "extension" },
        };
      if (message.type === "searchSettings") {
        if (!own && !launcher)
          throw new Error("Only TuxTelly can access search settings.");
        const stored = await browser.storage.local.get([
          "tmdbApiKey",
          "tmdbSearchSettings",
          "tmdbHuluSearchMigration",
          "tmdbPeacockSearchMigration",
        ]);
        const saved = stored.tmdbSearchSettings as
          { region?: string; serviceIds?: string[] } | undefined;
        const huluServices = config.services.filter((service) =>
          `${service.id} ${service.name} ${service.url}`
            .toLowerCase()
            .includes("hulu"),
        );
        const peacockServices = config.services.filter((service) =>
          `${service.id} ${service.name} ${service.url}`
            .toLowerCase()
            .includes("peacock"),
        );
        const serviceIds = [
          ...(saved?.serviceIds ?? defaultSearchServiceIds(config.services)),
        ];
        if (
          stored.tmdbHuluSearchMigration !== true &&
          huluServices.some((service) => service.enabled)
        ) {
          serviceIds.splice(
            0,
            serviceIds.length,
            ...migrateSearchServiceIds(serviceIds, config.services, ["hulu"]),
          );
          await browser.storage.local.set({
            tmdbHuluSearchMigration: true,
            tmdbSearchSettings: {
              region: saved?.region ?? "US",
              serviceIds,
            },
          });
        }
        if (
          stored.tmdbPeacockSearchMigration !== true &&
          peacockServices.some((service) => service.enabled)
        ) {
          serviceIds.splice(
            0,
            serviceIds.length,
            ...migrateSearchServiceIds(serviceIds, config.services, [
              "peacock",
            ]),
          );
          await browser.storage.local.set({
            tmdbPeacockSearchMigration: true,
            tmdbSearchSettings: {
              region: saved?.region ?? "US",
              serviceIds,
            },
          });
        }
        return {
          ok: true,
          data: {
            configured:
              typeof stored.tmdbApiKey === "string" &&
              stored.tmdbApiKey.length > 0,
            region: saved?.region ?? "US",
            serviceIds,
          },
        };
      }
      if (message.type === "saveSearchSettings") {
        if (!own && (!launcher || message.apiKey.trim()))
          throw new Error("Edit the TMDB key in the extension settings page.");
        if (message.apiKey.trim())
          await browser.storage.local.set({
            tmdbApiKey: message.apiKey.trim(),
          });
        await browser.storage.local.set({
          tmdbSearchSettings: {
            region: message.region,
            serviceIds: message.serviceIds,
          },
        });
        searchCache.clear();
        return { ok: true };
      }
      if (message.type === "removeTmdbKey") {
        if (!own)
          throw new Error(
            "Remove the TMDB key in the extension settings page.",
          );
        await browser.storage.local.remove("tmdbApiKey");
        searchCache.clear();
        return { ok: true };
      }
      if (message.type === "testTmdb") {
        if (!own && !launcher)
          throw new Error("Only TuxTelly can test TMDB settings.");
        if (!message.apiKey.trim())
          throw new Error("Enter a TMDB API key first.");
        await fetchTmdb<{ results?: unknown[] }>(
          `/search/multi?query=star%20wars&page=1`,
          message.apiKey.trim(),
        );
        return { ok: true, data: { message: "TMDB connection succeeded." } };
      }
      if (message.type === "search") {
        if (!own && !launcher)
          throw new Error("Only TuxTelly can search titles.");
        return {
          ok: true,
          data: await tmdbSearch(
            message.query,
            message.region,
            message.serviceIds,
            message.includePaidOffers,
          ),
        };
      }
      if (message.type === "state") {
        if (!own && !launcher)
          throw new Error("Only the launcher can request settings.");
        const openServices: string[] = [];
        for (const tab of await browser.tabs.query({}))
          if (tab.id !== undefined) {
            const found = await serviceFor(tab.id, tab.url);
            if (found) openServices.push(found.id);
          }
        return {
          ok: true,
          data: {
            config,
            grantedOrigins: (await browser.permissions.getAll()).origins ?? [],
            openServices,
            lastUsedServiceId,
            version: VERSION,
            recovery,
          },
        };
      }
      if (message.type === "save") {
        if (!own)
          throw new Error("Edit settings in the extension settings page.");
        const nextConfig = message.config;
        await browser.storage.local.set({
          lastValidConfig: config,
          config: nextConfig,
        });
        config = nextConfig;
        recovery = undefined;
        await registerScripts();
        for (const tab of await browser.tabs.query({})) {
          if (tab.id === undefined) continue;
          const serviceId = await sessions
            .getTabValue(tab.id, tag)
            .catch(() => undefined);
          const service = nextConfig.services.find(
            (item) => item.id === serviceId && item.enabled,
          );
          const extensionMuted = await sessions
            .getTabValue(tab.id, "tuxtelly.muted")
            .catch(() => false);
          if (!service && extensionMuted) {
            await browser.tabs
              .update(tab.id, { muted: false })
              .catch(() => undefined);
            await sessions
              .setTabValue(tab.id, "tuxtelly.muted", false)
              .catch(() => undefined);
          }
        }
        for (const tab of await browser.tabs.query({}))
          if (tab.id !== undefined)
            void browser.tabs
              .sendMessage(tab.id, { control: "refresh" })
              .catch(() => undefined);
        return { ok: true };
      }
      if (message.type === "settings") {
        await browser.runtime.openOptionsPage();
        return { ok: true };
      }
      if (message.type === "open")
        return {
          ok: true,
          data: await openService(message.serviceId, sender.tab?.windowId),
        };
      if (message.type === "home") await home(sender.tab?.windowId);
      if (message.type === "cycle")
        await cycle(message.direction, sender.tab?.windowId);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The action could not be completed.",
      };
    }
  }
  browser.runtime.onMessage.addListener(handle);
  browser.action.onClicked.addListener(() => {
    void ready
      .then(() => home())
      .catch(() => browser.runtime.openOptionsPage());
  });
  browser.runtime.onStartup.addListener(() => {
    void ready
      .then(() =>
        config.preferences.openHomeAtStartup ? home() : Promise.resolve(),
      )
      .catch(() => undefined);
  });
  browser.commands.onCommand.addListener((command) => {
    void ready
      .then(async () => {
        if (command === "home") await home();
        else await cycle(command === "next" ? 1 : -1);
      })
      .catch(() => browser.runtime.openOptionsPage());
  });
  browser.tabs.onUpdated.addListener((id, change) => {
    if (change.status === "complete") void ready.then(() => inject(id));
  });
  browser.permissions.onAdded.addListener(() => {
    void registerScripts();
  });
  browser.permissions.onRemoved.addListener(() => {
    void registerScripts().then(async () => {
      for (const tab of await browser.tabs.query({}))
        if (tab.id !== undefined)
          void browser.tabs
            .sendMessage(tab.id, { control: "refresh" })
            .catch(() => undefined);
    });
  });
  void registerScripts();
});
