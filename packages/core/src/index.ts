import { z } from "zod";

export const VERSION = "0.2.8";
export const PROTOCOL = 1;
export function webUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hostname.includes("*")
  ) {
    throw new Error("Use an HTTP(S) address without embedded credentials.");
  }
  return url;
}
const urlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      webUrl(value);
      return true;
    } catch {
      return false;
    }
  }, "Use an HTTP(S) address without credentials.");
export const actions = [
  "home",
  "switcher",
  "next",
  "previous",
  "back",
  "playPause",
  "seekBackward",
  "seekForward",
  "captions",
  "fullscreen",
  "mute",
  "volumeUp",
  "volumeDown",
] as const;
export type Action = (typeof actions)[number];
export const bindingSchema = z
  .object({
    key: z.string().min(1).max(40),
    alt: z.boolean().default(false),
    ctrl: z.boolean().default(false),
    shift: z.boolean().default(false),
    meta: z.boolean().default(false),
    action: z.enum(actions),
  })
  .strict();
export type Binding = z.infer<typeof bindingSchema>;
export const serviceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    name: z.string().trim().min(1).max(60),
    url: urlSchema,
    origins: z
      .array(
        urlSchema.refine((value) => {
          try {
            return webUrl(value).origin === value;
          } catch {
            return false;
          }
        }, "Use an exact origin, without a path."),
      )
      .min(1)
      .max(12),
    adapter: z
      .enum(["generic", "youtube", "netflix", "disney", "hbo", "prime"])
      .default("generic"),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#5be5bc"),
    enabled: z.boolean().default(true),
    favorite: z.boolean().optional(),
    backgroundAudio: z.boolean().default(false),
  })
  .strict()
  .refine((service) => {
    try {
      return service.origins.includes(webUrl(service.url).origin);
    } catch {
      return false;
    }
  }, "The start address must be included in the service origins.")
  .transform(({ favorite: _favorite, ...service }) => service);
export type Service = z.infer<typeof serviceSchema>;
export const configSchema = z
  .object({
    version: z.literal(1),
    launcherUrl: z.union([z.literal(""), urlSchema]).default(""),
    services: z.array(serviceSchema).max(40),
    preferences: z
      .object({
        seekSeconds: z.number().int().min(1).max(120).default(10),
        volumeStep: z.number().min(0.01).max(0.25).default(0.05),
        scale: z.number().min(0.8).max(1.5).default(1),
        overscan: z.number().int().min(0).max(8).default(3),
        wrap: z.boolean().default(true),
        fullscreenWindow: z.boolean().default(false),
        openHomeAtStartup: z.boolean().default(false),
        wallpaper: z
          .enum([
            "solid-obsidian",
            "solid-blue-hour",
            "solid-pine",
            "solid-plum",
            "gradient-aurora",
            "gradient-dusk",
            "gradient-ember",
            "gradient-synthwave",
            "gradient-ocean",
            "blur-aurora",
            "blur-twilight",
            "blur-forest",
            "blur-ember",
            "image-stars",
            "image-cabin",
            "image-mist",
            "image-forest",
          ])
          .default("gradient-synthwave"),
        theme: z
          .enum(["retro-vhs", "windows-95", "midnight"])
          .default("retro-vhs"),
      })
      .strict(),
    bindings: z.array(bindingSchema).max(40),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (
      new Set(config.services.map((s) => s.id)).size !== config.services.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Service IDs must be unique.",
        path: ["services"],
      });
    if (new Set(config.bindings.map(bindingId)).size !== config.bindings.length)
      ctx.addIssue({
        code: "custom",
        message: "Each shortcut can have only one action.",
        path: ["bindings"],
      });
  });
export type Config = z.infer<typeof configSchema>;
export const defaultConfig: Config = configSchema.parse({
  version: 1,
  launcherUrl: "",
  preferences: {},
  services: [
    {
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/",
      origins: ["https://www.youtube.com"],
      adapter: "youtube",
      color: "#ff6268",
    },
    {
      id: "netflix",
      name: "Netflix",
      url: "https://www.netflix.com/",
      origins: ["https://www.netflix.com"],
      adapter: "netflix",
      color: "#ed3e4f",
    },
    {
      id: "disney",
      name: "Disney+",
      url: "https://www.disneyplus.com/",
      origins: ["https://www.disneyplus.com"],
      adapter: "disney",
      color: "#6e9bff",
    },
    {
      id: "hbo",
      name: "HBO Max",
      url: "https://www.hbomax.com/",
      origins: ["https://www.hbomax.com", "https://play.hbomax.com"],
      adapter: "hbo",
      color: "#b38bff",
    },
    {
      id: "prime",
      name: "Prime Video",
      url: "https://www.primevideo.com/",
      origins: ["https://www.primevideo.com"],
      adapter: "prime",
      color: "#38b6e8",
    },
  ],
  bindings: [
    { key: "Home", action: "home" },
    { key: "F8", action: "switcher" },
    { key: "MediaTrackNext", action: "next" },
    { key: "MediaTrackPrevious", action: "previous" },
    { key: "BrowserBack", action: "back" },
    { key: "MediaPlayPause", action: "playPause" },
    { key: " ", action: "playPause" },
    { key: "k", action: "playPause" },
    { key: "c", action: "captions" },
    { key: "f", action: "fullscreen" },
    { key: "m", action: "mute" },
    { key: "+", action: "volumeUp" },
    { key: "-", action: "volumeDown" },
  ],
});
export function migratePrimeVideo(config: Config): Config {
  if (config.services.some((service) => service.id === "prime")) return config;
  const prime = defaultConfig.services.find(
    (service) => service.id === "prime",
  );
  if (!prime) return config;
  return { ...config, services: [...config.services, structuredClone(prime)] };
}
export function bindingId(
  key: Pick<Binding, "key" | "alt" | "ctrl" | "shift" | "meta">,
): string {
  return `${key.ctrl ? "C" : ""}${key.alt ? "A" : ""}${key.shift ? "S" : ""}${key.meta ? "M" : ""}:${key.key.toLowerCase()}`;
}
export function eventBinding(event: KeyboardEvent): Omit<Binding, "action"> {
  return {
    key: event.key,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}
export function isEditing(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    )
  );
}
export function matchAction(
  event: KeyboardEvent,
  config: Config,
): Action | undefined {
  if (event.isComposing || isEditing(event.composedPath()[0] ?? event.target))
    return undefined;
  const binding = config.bindings.find(
    (b) => bindingId(b) === bindingId(eventBinding(event)),
  );
  if (
    event.repeat &&
    binding &&
    !["seekForward", "seekBackward", "volumeUp", "volumeDown"].includes(
      binding.action,
    )
  )
    return undefined;
  return binding?.action;
}
export function originPattern(value: string): string {
  const url = webUrl(value);
  return `${url.protocol}//${url.hostname}/*`;
}
export function allowedServiceUrl(service: Service, value?: string): boolean {
  try {
    return !!value && service.origins.includes(webUrl(value).origin);
  } catch {
    return false;
  }
}
export function isLauncher(config: Config, value?: string): boolean {
  try {
    if (!value || !config.launcherUrl) return false;
    const expected = webUrl(config.launcherUrl);
    const actual = webUrl(value);
    return (
      expected.origin === actual.origin &&
      expected.pathname.replace(/\/$/, "") ===
        actual.pathname.replace(/\/$/, "")
    );
  } catch {
    return false;
  }
}
export const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state") }).strict(),
  z.object({ type: z.literal("open"), serviceId: z.string().max(64) }).strict(),
  z.object({ type: z.literal("home") }).strict(),
  z
    .object({
      type: z.literal("cycle"),
      direction: z.union([z.literal(1), z.literal(-1)]),
    })
    .strict(),
  z.object({ type: z.literal("settings") }).strict(),
  z.object({ type: z.literal("save"), config: configSchema }).strict(),
  z.object({ type: z.literal("context") }).strict(),
]);
export type Request = z.infer<typeof requestSchema>;
export type State = {
  config: Config;
  grantedOrigins: string[];
  openServices: string[];
  version: string;
  recovery?: string;
  lastUsedServiceId?: string;
};
export function createDiagnosticReport(
  config: Config,
  data: Pick<State, "grantedOrigins" | "version">,
  userAgent: string,
  generatedAt = new Date().toISOString(),
) {
  return {
    app: "TuxTelly",
    version: data.version,
    generatedAt,
    browser: userAgent,
    configuredServices: config.services.length,
    enabledServices: config.services.filter((service) => service.enabled)
      .length,
    grantedSiteOrigins: data.grantedOrigins.length,
    note: "No service URLs, account data, cookies, viewing history, or typed input are included.",
  };
}
export type Reply = { ok: true; data?: unknown } | { ok: false; error: string };
export type Client = {
  kind: "hosted" | "extension";
  request: (message: Request) => Promise<Reply>;
  grant?: (origins: string[]) => Promise<boolean>;
};
export function parseConfig(text: string): Config {
  if (text.length > 128_000) throw new Error("Configuration is too large.");
  return configSchema.parse(JSON.parse(text));
}

export type Direction = "left" | "right" | "up" | "down";
export type Rect = { left: number; top: number; width: number; height: number };
export function nearest(
  current: Rect,
  candidates: Rect[],
  direction: Direction,
): number {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const cx = current.left + current.width / 2;
  const cy = current.top + current.height / 2;
  let best = -1;
  let score = Infinity;
  candidates.forEach((rect, index) => {
    const dx = rect.left + rect.width / 2 - cx;
    const dy = rect.top + rect.height / 2 - cy;
    const primary = (horizontal ? dx : dy) * sign;
    const cross = Math.abs(horizontal ? dy : dx);
    if (primary <= 1) return;
    const overlap = horizontal
      ? rect.top < current.top + current.height &&
        rect.top + rect.height > current.top
      : rect.left < current.left + current.width &&
        rect.left + rect.width > current.left;
    const candidate = primary + cross * 2 + (overlap ? 0 : 1000);
    if (candidate < score) {
      best = index;
      score = candidate;
    }
  });
  return best;
}
export type ManagedTab = {
  id: number;
  windowId: number;
  url?: string;
  active?: boolean;
};
export interface TabPort {
  list(windowId: number): Promise<ManagedTab[]>;
  serviceId(tabId: number): Promise<string | undefined>;
  create(url: string, windowId: number): Promise<ManagedTab>;
  tag(tabId: number, serviceId: string): Promise<void>;
  activate(tabId: number): Promise<void>;
}
/** Serializes launches so remote key repeat cannot race two tab creations. */
export class ServiceTabs {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private port: TabPort) {}
  open(service: Service, windowId: number): Promise<ManagedTab> {
    const run = this.queue.then(async () => {
      for (const tab of await this.port.list(windowId)) {
        if (
          (await this.port.serviceId(tab.id)) === service.id &&
          allowedServiceUrl(service, tab.url)
        ) {
          await this.port.activate(tab.id);
          return tab;
        }
      }
      const tab = await this.port.create(service.url, windowId);
      await this.port.tag(tab.id, service.id);
      await this.port.activate(tab.id);
      return tab;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
