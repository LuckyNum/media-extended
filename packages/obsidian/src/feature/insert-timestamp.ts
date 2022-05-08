import "obsidian";

import {
  getMostRecentViewOfType,
  insertToCursor,
  secondToDuration,
  secondToFragFormat,
  stripHash,
} from "@misc";
import { Source } from "@player/slice/provider/types";
import type MediaExtended from "@plugin";
import { MarkdownView, Notice, TFile } from "obsidian";

export const registerInsetTimestampHandler = (plugin: MediaExtended) => {
  plugin.registerEvent(
    plugin.app.workspace.on("mx:timestamp", (time, duration, source) => {
      const mdView = getMostRecentViewOfType(MarkdownView);
      if (!mdView) {
        new Notice("No opened markdown note available to insert timestamp");
        return;
      }
      const timestamp = getTimeStamp(time, duration, source);
      if (!timestamp) return;
      const { timestampTemplate: template } = plugin.settings;
      insertToCursor(template.replace(/{{TIMESTAMP}}/g, timestamp), mdView);
    }),
  );
  const getTimeStamp = (
    currentTime: number,
    duration: number,
    source: Source,
  ): string | null => {
    const { timestampOffset: offset } = plugin.settings;
    let offsetCurrentTime = currentTime - offset;
    if (currentTime - offset < 0) offsetCurrentTime = 0;
    else if (currentTime - offset > duration) offsetCurrentTime = duration;

    if (source.from === "obsidian") {
      const file = plugin.app.vault.getAbstractFileByPath(source.path);
      let linktext;
      if (
        file instanceof TFile &&
        (linktext = plugin.app.metadataCache.fileToLinktext(file, "", true))
      ) {
        const frag = secondToFragFormat(offsetCurrentTime);
        return `[[${linktext}#t=${frag}]]`;
      } else {
        new Notice("Could not find source file of timestamp: " + source.path);
        return null;
      }
    } else {
      const linktext = secondToDuration(offsetCurrentTime);
      const link = source.from === "direct" ? source.url : source.src,
        hash = `#t=${offsetCurrentTime}`;

      let url = link + hash;
      try {
        if (decodeURI(url) !== url) {
          url = `<${decodeURI(url)}>`;
        }
      } catch (error) {
        console.warn("malformed URI: " + url);
      }

      return `[${linktext}](${url})`;
    }
  };
};
