import type { Config } from "@tuxtelly/core";

export type ThemeId = Config["preferences"]["theme"];
export const themes: {
  id: ThemeId;
  name: string;
  description: string;
  swatch: string;
}[] = [
  {
    id: "retro-vhs",
    name: "VHS living room",
    description: "Warm CRT glow, video-store colors, and a cozy DVD shelf.",
    swatch:
      "linear-gradient(135deg, #241b19 0 48%, #c79747 49% 54%, #163c38 55%)",
  },
  {
    id: "windows-95",
    name: "Windows 95",
    description: "Raised gray panels, blue title bars, and desktop teal.",
    swatch:
      "linear-gradient(180deg, #102a7c 0 30%, #c0c0c0 31% 76%, #087e80 77%)",
  },
  {
    id: "midnight",
    name: "Midnight modern",
    description: "The original dark glass look with quiet green accents.",
    swatch: "linear-gradient(135deg, #101716, #193027 55%, #253e35)",
  },
];
