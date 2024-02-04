/* eslint-disable deprecation/deprecation */
import type { MediaPlayerInstance } from "@vidstack/react";
import type { Editor, MarkdownFileInfo, App, Command, TFile } from "obsidian";
import { MarkdownView, Notice, debounce } from "obsidian";
import { PlaybackSpeedPrompt } from "@/media-view/menu/prompt";
import { speedOptions } from "@/media-view/menu/speed";
import type { MediaView } from "@/media-view/view-type";
import type MxPlugin from "@/mx-main";
import { MediaSwitcherModal } from "@/switcher";
import { isMediaLeaf } from "./leaf-open";
import type { MediaInfo } from "./note-index";
import { saveScreenshot } from "./timestamp/screenshot";
import { takeTimestamp } from "./timestamp/timestamp";
import { openOrCreateMediaNote } from "./timestamp/utils";

const commands: Controls[] = [
  {
    id: "toggle-play",
    label: "Play/pause",
    icon: "play",
    action: (media) => {
      media.paused = !media.paused;
    },
  },
  ...[5, 30].flatMap((sec): Controls[] => [
    {
      id: `forward-${sec}s`,
      label: `Forward ${sec}s`,
      icon: "forward",
      action: (media) => {
        media.currentTime += sec;
      },
      repeat: true,
    },
    {
      id: `rewind-${sec}s`,
      label: `Rewind ${sec}s`,
      icon: "rewind",
      action: (media) => {
        media.currentTime -= sec;
      },
      repeat: true,
    },
  ]),
  {
    id: "toggle-mute",
    label: "Mute/unmute",
    icon: "volume-x",
    action: (media) => {
      media.muted = !media.muted;
    },
  },
  {
    id: "toggle-fullscreen",
    label: "Enter/exit fullscreen",
    icon: "expand",
    check: (media) => media.state.canFullscreen,
    action: (media) => {
      if (media.state.fullscreen) {
        media.exitFullscreen();
      } else {
        media.enterFullscreen();
      }
    },
  },
  ...speed(),
];

function speed(): Controls[] {
  // reuse notice if user is spamming speed change
  let notice: Notice | null = null;
  const hide = debounce(() => notice?.hide(), 2e3, true);
  function notify(message: string) {
    if (!notice || notice.noticeEl.isConnected === false) {
      notice = new Notice(message, 0);
    } else {
      notice.setMessage(message);
    }
    hide();
  }
  function notifyAllowDup(message: string) {
    new Notice(message, 2e3);
  }
  return [
    {
      id: "reset-speed",
      label: "Reset playback speed",
      icon: "reset",
      check: (media) => media.state.playbackRate !== 1,
      action: (media) => {
        media.playbackRate = 1;
        notifyAllowDup("Speed reset to 1x");
      },
    },
    {
      id: "increase-speed",
      label: "Increase playback speed",
      icon: "arrow-up",
      action: (media) => {
        const curr = media.playbackRate;
        if (curr >= speedOptions.last()!) {
          notifyAllowDup("Cannot increase speed further");
          return;
        }
        // find nearest speed option greater than current speed
        const next = speedOptions.find((speed) => speed > curr)!;
        media.playbackRate = next;
        notify(`Speed increased to ${next}x`);
      },
    },
    {
      id: "decrease-speed",
      label: "Decrease playback speed",
      icon: "arrow-down",
      action: (media) => {
        const curr = media.playbackRate;
        if (curr <= speedOptions.first()!) {
          notifyAllowDup("Cannot decrease speed further");
          return;
        }
        // find nearest speed option less than current speed
        const prev = speedOptions
          .slice()
          .reverse()
          .find((speed) => speed < curr)!;
        media.playbackRate = prev;
        notify(`Speed decreased to ${prev}x`);
      },
    },
    {
      id: "set-speed",
      label: "Set playback speed",
      icon: "gauge",
      action: async (media) => {
        const newSpeed = await PlaybackSpeedPrompt.run();
        if (!newSpeed) return;
        media.playbackRate = newSpeed;
        notify(`Speed set to ${newSpeed}x`);
      },
    },
  ];
}

export function registerNoteCommands(plugin: MxPlugin) {
  plugin.addCommand({
    id: "open-media-url",
    name: "Open media from URL",
    icon: "link",
    callback: () => new MediaSwitcherModal(plugin).open(),
  });
  addMediaViewCommand(
    {
      id: "take-timestamp",
      name: "Take timstamp",
      icon: "star",
      ...logic(takeTimestamp),
    },
    plugin,
  );
  addMediaViewCommand(
    {
      id: "save-screenshot",
      name: "Save screenshot",
      icon: "camera",
      ...logic(saveScreenshot),
    },
    plugin,
  );

  function logic(
    action: (
      playerComponent: MediaView,
      ctx: {
        file: TFile;
        editor: Editor;
      },
    ) => any,
  ): MediaViewCallback {
    return {
      playerCheckCallback: (checking, view) => {
        const mediaInfo = view.getMediaInfo();
        if (!mediaInfo) return false;
        if (checking) return true;
        openOrCreateMediaNote(mediaInfo, view).then((ctx) => action(view, ctx));
      },
      noteCheckCallback: (checking, view, { isMediaNote, ...ctx }) => {
        let _view: Promise<MediaView>;
        if (!view) {
          if (!isMediaNote) return false;
          if (checking) return true;
          _view = plugin.leafOpener
            .openMedia(isMediaNote, "split")
            .then((l) => l.view);
        } else {
          if (checking) return true;
          plugin.app.workspace.revealLeaf(view.leaf);
          _view = Promise.resolve(view);
        }
        _view.then((v) => action(v, ctx));
      },
    };
  }
}

interface Controls {
  id: string;
  label: string;
  icon: string;
  repeat?: boolean;
  check?: (media: MediaPlayerInstance) => boolean;
  action: (media: MediaPlayerInstance) => void;
}

export function registerControlCommands(plugin: MxPlugin) {
  commands.forEach(({ id, label, icon, action, repeat, check }) => {
    addMediaViewCommand(
      {
        id,
        name: label,
        icon,
        repeatable: repeat,
        playerCheckCallback: (checking, view) => {
          if (!view) return false;
          const player = view.store.getState().player;
          if (!player) return false;
          if (check && !check(player)) return false;
          if (checking) return true;
          action(player);
        },
        noteCheckCallback(checking, view) {
          if (!view) return false;
          const player = view.store.getState().player;
          if (!player) return false;
          if (check && !check(player)) return false;
          if (checking) return true;
          action(player);
        },
      },
      plugin,
    );
  });
}

function checkCallbacks(
  onRegular: (checking: boolean) => boolean | void,
  onEditor: (
    checking: boolean,
    editor: Editor,
    ctx: MarkdownView | MarkdownFileInfo,
  ) => boolean | void,
  app: App,
) {
  return (checking: boolean): boolean | void => {
    const activeEditor = app.workspace.activeEditor;
    if (!activeEditor) return onRegular(checking);
    // from app.js
    if ((activeEditor as MarkdownView).getMode() !== "preview") {
      if (activeEditor instanceof MarkdownView) {
        if ((activeEditor as any).inlineTitleEl.isActiveElement()) return;
      }
      return onEditor(checking, activeEditor.editor!, activeEditor);
    }
  };
}

interface MediaViewCallback {
  playerCheckCallback: (checking: boolean, view: MediaView) => boolean | void;
  noteCheckCallback: (
    checking: boolean,
    view: MediaView | undefined,
    noteCtx: {
      file: TFile;
      editor: Editor;
      isMediaNote: MediaInfo | undefined;
    },
  ) => boolean | void;
}

function addMediaViewCommand(
  {
    playerCheckCallback,
    noteCheckCallback,
    ...command
  }: Omit<
    Command,
    "callback" | "checkCallback" | "editorCheckCallback" | "editorCallback"
  > &
    Partial<MediaViewCallback>,
  plugin: MxPlugin,
): Command {
  const { app } = plugin;
  return plugin.addCommand({
    ...command,
    checkCallback: checkCallbacks(
      (checking) => {
        if (!playerCheckCallback) return false;
        if (!isMediaLeaf(app.workspace.activeLeaf)) return false;
        if (checking) return true;
        return playerCheckCallback(checking, app.workspace.activeLeaf.view);
      },
      (checking, editor, ctx) => {
        if (!noteCheckCallback) return false;
        if (!ctx.file) return false;
        const mediaInfo = plugin.mediaNote.findMedia(ctx.file);
        const mediaLeaf = plugin.leafOpener.detectActiveMediaLeaf(
          app.workspace.activeLeaf,
        );
        return noteCheckCallback(checking, mediaLeaf?.view, {
          isMediaNote: mediaInfo,
          file: ctx.file,
          editor,
        });
      },
      app,
    ),
  });
}
