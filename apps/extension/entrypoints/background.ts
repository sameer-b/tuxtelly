import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import {
  allowedServiceUrl,
  configSchema,
  defaultConfig,
  isLauncher,
  originPattern,
  requestSchema,
  ServiceTabs,
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
  const ready = browser.storage.local
    .get(["config", "lastValidConfig", "lastUsedServiceId"])
    .then((stored) => {
      if (typeof stored.lastUsedServiceId === "string")
        lastUsedServiceId = stored.lastUsedServiceId;
      if (stored.config === undefined) return;
      const parsed = configSchema.safeParse(stored.config);
      if (parsed.success) config = parsed.data;
      else {
        const backup = configSchema.safeParse(stored.lastValidConfig);
        if (backup.success) config = backup.data;
        recovery =
          "Your saved configuration could not be loaded. A valid backup or defaults are in use; review settings before saving.";
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
      await browser.storage.local.set({ lastUsedServiceId });
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
