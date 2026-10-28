import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "TuxTelly",
    description: "Your streaming services, one Linux TV remote.",
    permissions: ["storage", "tabs", "scripting", "sessions"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    browser_specific_settings: {
      gecko: {
        id: "tuxtelly@sameer-b.github.io",
        strict_min_version: "142.0",
        update_url:
          "https://github.com/sameer-b/tuxtelly/releases/latest/download/updates.json",
        data_collection_permissions: { required: ["none"] },
      },
    },
    action: { default_title: "TuxTelly home" },
    commands: {
      home: {
        description: "Return to TuxTelly home",
        suggested_key: { default: "Alt+Shift+H" },
      },
      next: { description: "Next streaming service" },
      previous: { description: "Previous streaming service" },
    },
    options_ui: { page: "home.html?settings=1", open_in_tab: true },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; img-src 'self' data: https://image.tmdb.org",
    },
  },
});
