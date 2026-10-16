import { createRoot } from "react-dom/client";
import { App } from "@tuxtelly/ui";
import { PROTOCOL, type Client, type Reply } from "@tuxtelly/core";

const client: Client = {
  kind: "hosted",
  request(message) {
    return new Promise<Reply>((resolve, reject) => {
      const id = Array.from(
        crypto.getRandomValues(new Uint8Array(16)),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const listener = (event: MessageEvent) => {
        if (
          event.source !== window ||
          event.origin !== location.origin ||
          event.data?.channel !== "tuxtelly:reply" ||
          event.data?.protocol !== PROTOCOL ||
          event.data?.id !== id
        )
          return;
        clearTimeout(timeout);
        clearInterval(retry);
        window.removeEventListener("message", listener);
        resolve(event.data.reply);
      };
      const payload = {
        channel: "tuxtelly:request",
        protocol: PROTOCOL,
        id,
        message,
      };
      const retry = setInterval(() => {
        if (message.type === "state")
          window.postMessage(payload, location.origin);
      }, 150);
      const timeout = setTimeout(() => {
        clearInterval(retry);
        window.removeEventListener("message", listener);
        reject(
          new Error(
            "Connect the Firefox extension and trust this launcher address in its settings.",
          ),
        );
      }, 3000);
      window.addEventListener("message", listener);
      window.postMessage(payload, location.origin);
    });
  },
};
createRoot(document.getElementById("root")!).render(<App client={client} />);
