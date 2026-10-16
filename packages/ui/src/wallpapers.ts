import stars from "./assets/wallpapers/starlit-dolomites.jpg";
import cabin from "./assets/wallpapers/snow-cabin.jpg";
import mist from "./assets/wallpapers/misty-evergreens.jpg";
import forest from "./assets/wallpapers/dark-forest.jpg";
import type { Config } from "@tuxtelly/core";

export type WallpaperId = Config["preferences"]["wallpaper"];
export type WallpaperPreset = {
  id: WallpaperId;
  name: string;
  background: string;
  filter?: string;
};

export const wallpaperGroups: {
  name: string;
  options: WallpaperPreset[];
}[] = [
  {
    name: "Solid colors",
    options: [
      { id: "solid-obsidian", name: "Obsidian", background: "#101716" },
      { id: "solid-blue-hour", name: "Blue hour", background: "#101827" },
      { id: "solid-pine", name: "Deep pine", background: "#101c18" },
      { id: "solid-plum", name: "Night plum", background: "#1a1420" },
    ],
  },
  {
    name: "Gradients",
    options: [
      {
        id: "gradient-aurora",
        name: "Northern lights",
        background:
          "radial-gradient(ellipse at 12% 12%, #173b35 0, transparent 50%), radial-gradient(ellipse at 88% 78%, #1c2a43 0, transparent 56%), #101716",
      },
      {
        id: "gradient-dusk",
        name: "Blue dusk",
        background:
          "linear-gradient(135deg, #101725 0%, #20243a 48%, #172b35 100%)",
      },
      {
        id: "gradient-ember",
        name: "Ember glow",
        background:
          "radial-gradient(ellipse at 82% 14%, #493020 0, transparent 49%), linear-gradient(145deg, #171516, #1e2024 65%, #17221d)",
      },
      {
        id: "gradient-ocean",
        name: "Deep ocean",
        background: "linear-gradient(155deg, #0c1823, #12343a 54%, #111923)",
      },
    ],
  },
  {
    name: "Soft blur",
    options: [
      {
        id: "blur-aurora",
        name: "Aurora haze",
        background:
          "radial-gradient(ellipse at 18% 24%, #287464 0, transparent 45%), radial-gradient(ellipse at 78% 76%, #485b8a 0, transparent 52%), #101716",
        filter: "blur(34px) saturate(1.3)",
      },
      {
        id: "blur-twilight",
        name: "Twilight haze",
        background:
          "radial-gradient(ellipse at 72% 25%, #694571 0, transparent 48%), radial-gradient(ellipse at 25% 78%, #1d5670 0, transparent 52%), #11151e",
        filter: "blur(38px) saturate(1.25)",
      },
      {
        id: "blur-forest",
        name: "Forest haze",
        background:
          "radial-gradient(ellipse at 20% 20%, #37664d 0, transparent 48%), radial-gradient(ellipse at 82% 72%, #445c3b 0, transparent 50%), #101716",
        filter: "blur(40px) saturate(1.2)",
      },
      {
        id: "blur-ember",
        name: "Hearth glow",
        background:
          "radial-gradient(ellipse at 75% 30%, #844b30 0, transparent 46%), radial-gradient(ellipse at 22% 75%, #5c343e 0, transparent 50%), #151516",
        filter: "blur(38px) saturate(1.2)",
      },
    ],
  },
  {
    name: "4K photos",
    options: [
      {
        id: "image-stars",
        name: "Starlit Dolomites",
        background: `linear-gradient(180deg, #080c12aa, #080c12aa), url("${stars}") center / cover`,
      },
      {
        id: "image-cabin",
        name: "Snow cabin",
        background: `linear-gradient(180deg, #080c12aa, #080c12aa), url("${cabin}") center / cover`,
      },
      {
        id: "image-mist",
        name: "Misty evergreens",
        background: `linear-gradient(180deg, #080c12aa, #080c12aa), url("${mist}") center / cover`,
      },
      {
        id: "image-forest",
        name: "Midnight forest",
        background: `linear-gradient(180deg, #080c12aa, #080c12aa), url("${forest}") center / cover`,
      },
    ],
  },
];

export const wallpaperPresets = wallpaperGroups.flatMap(
  (group) => group.options,
);
