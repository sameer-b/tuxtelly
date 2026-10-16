import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import {
  PROTOCOL,
  requestSchema,
  type Config,
  type Reply,
  type Service,
} from "@tuxtelly/core";
import { installControls } from "@tuxtelly/adapters";

export default defineContentScript({
  registration: "runtime",
  main() {
    const contextWindow = globalThis as typeof globalThis & {
      __tuxtellyRefresh?: () => Promise<void>;
    };
    if (contextWindow.__tuxtellyRefresh) {
      void contextWindow.__tuxtellyRefresh();
      return;
    }
    let controls: ReturnType<typeof installControls> | undefined;
    let role = "";
    async function initialize() {
      const response = (await browser.runtime.sendMessage({
        type: "context",
      })) as Reply;
      if (!response.ok) {
        role = "";
        controls?.dispose();
        controls = undefined;
        return;
      }
      const data = response.data as {
        role: string;
        config?: Config;
        service?: Service;
      };
      role = data.role;
      if (data.role === "service" && data.config && data.service) {
        controls?.dispose();
        controls = installControls(
          data.service,
          data.config,
          async (action) => {
            const result = await browser.runtime.sendMessage(
              action === "home"
                ? { type: "home" }
                : action === "next" || action === "previous"
                  ? { type: "cycle", direction: action === "next" ? 1 : -1 }
                  : { type: "open", serviceId: action.replace(/^open:/, "") },
            );
            if (!result.ok) throw new Error(result.error);
          },
        );
      } else {
        controls?.dispose();
        controls = undefined;
      }
    }
    window.addEventListener("message", (event) => {
      if (
        role !== "launcher" ||
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.channel !== "tuxtelly:request" ||
        event.data?.protocol !== PROTOCOL ||
        typeof event.data?.id !== "string" ||
        event.data.id.length > 100
      )
        return;
      const parsed = requestSchema.safeParse(event.data.message);
      if (
        !parsed.success ||
        !["state", "open", "home", "cycle", "settings"].includes(
          parsed.data.type,
        )
      )
        return;
      const id = event.data.id;
      void browser.runtime
        .sendMessage(parsed.data)
        .then((reply) =>
          window.postMessage(
            { channel: "tuxtelly:reply", protocol: PROTOCOL, id, reply },
            location.origin,
          ),
        );
    });
    browser.runtime.onMessage.addListener((message) => {
      if (message?.control === "pause")
        return controls?.pause() ?? Promise.resolve({ ok: false });
      if (message?.control === "refresh") return initialize();
      return undefined;
    });
    contextWindow.__tuxtellyRefresh = initialize;
    void initialize().catch(() => {
      delete contextWindow.__tuxtellyRefresh;
    });
  },
});
