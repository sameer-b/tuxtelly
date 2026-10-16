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
    description: "A cozy VHS shelf lit by neon pink, violet, and cyan CRT glow.",
    swatch:
      "linear-gradient(135deg, #171022 0 34%, #ff4fd8 35% 43%, #8f4dff 44% 60%, #40eeff 61% 68%, #0b0916 69%)",
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
