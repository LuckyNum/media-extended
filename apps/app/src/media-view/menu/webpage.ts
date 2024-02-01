import type { Menu } from "obsidian";
import type { PlayerContext } from ".";
import { WebiviewMediaProvider } from "@/lib/remote-player/provider";

export function webpageMenu(
  menu: Menu,
  { controls = true, toggleControls, player }: PlayerContext,
  source:
    | "player-menu-view"
    | "player-menu-embed"
    | "sidebar-context-menu"
    | "tab-header"
    | "more-options",
) {
  if (
    !(
      player.provider instanceof WebiviewMediaProvider &&
      source === "more-options"
    )
  )
    menu.addItem((item) => {
      item
        .setTitle(
          controls ? "Show website native controls" : "Hide website controls",
        )
        .setSection("mx-player")
        .setIcon("sliders-horizontal")
        .onClick(() => {
          toggleControls(!controls);
        });
    });
}
