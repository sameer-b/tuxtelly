import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { App } from "@tuxtelly/ui";
import type { Client } from "@tuxtelly/core";
const client: Client = {
  kind: "extension",
  request: (message) => browser.runtime.sendMessage(message),
  grant: (origins) => browser.permissions.request({ origins }),
};
createRoot(document.getElementById("root")!).render(<App client={client} />);
