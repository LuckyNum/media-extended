import { enumerate } from "@ipc/must-include";
import type { TFile } from "obsidian";

type HTML5PlayerType = "unknown" | "audio" | "video";
export const HTML5PlayerTypes = enumerate<HTML5PlayerType>()(
  "unknown",
  "audio",
  "video",
);

export type Providers = "youtube" | "bilibili" | "vimeo";

type WebViewType = "webview";
interface SourceBase {
  playerType: HTML5PlayerType | WebViewType | "youtube" | "vimeo" | null;
  src: string;
  title: string | null;
  linkTitle?: string;
}
export interface ObsidianMedia extends SourceBase {
  from: "obsidian";
  playerType: HTML5PlayerType;
  /** in-vault absolute path for media file */
  title: string;
  path: string;
  basename: string;
  extension: string;
}
export interface DirectLinkMedia extends SourceBase {
  from: "direct";
  /** raw url without process (e.g. file://) */
  url: string;
  allowCORS: boolean;
  playerType: HTML5PlayerType;
}
interface VideoHostMediaBase extends SourceBase {
  from: Providers | "general";
  playerType: "youtube" | "vimeo" | WebViewType;
  id: string;
  title: string | null;
}
export interface BilibiliMedia extends VideoHostMediaBase {
  from: "bilibili";
  playerType: WebViewType;
}
interface GeneralHostMedia extends VideoHostMediaBase {
  from: "bilibili";
  playerType: WebViewType;
}
export interface YouTubeMedia extends VideoHostMediaBase {
  from: "youtube";
  playerType: "youtube";
}
interface VimeoMedia extends VideoHostMediaBase {
  from: "vimeo";
  playerType: "vimeo";
}
export type Source =
  | ObsidianMedia
  | DirectLinkMedia
  | BilibiliMedia
  | YouTubeMedia;
interface Subtitle {
  src: string;
  kind: "subtitles";
  // must be a valid BCP 47 language tag
  srcLang?: string;
  label?: string;
  default?: boolean;
}
interface Caption {
  src: string;
  kind: "captions";
  default: boolean;
}

export type Track = Caption | Subtitle;

export type SerializableTFile = Pick<
  TFile,
  "path" | "name" | "basename" | "extension"
>;
