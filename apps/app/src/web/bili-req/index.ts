/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
import preloadScript from "inline:./scripts/preload";
import preloadLoader from "inline:./scripts/preload-patch";
import userScript from "inline:./scripts/userscript";
import { Component, Platform } from "obsidian";
import type MxPlugin from "@/mx-main";
import { evalInMainPs, getUserDataPath } from "../session/utils";
import { channelId } from "./channel";
import { BILI_REQ_STORE, replaceEnv } from "./const";

const preloadLoaderCode = replaceEnv(preloadLoader);
const userScriptCode = replaceEnv(userScript);
const preloadScriptCode = replaceEnv(preloadScript).replace(
  "__USERSCRIPT__",
  JSON.stringify(userScriptCode),
);
const channel = channelId(BILI_REQ_STORE);

declare module "obsidian" {
  interface MetadataCache {
    on(name: "mx-preload-ready", callback: () => any, ctx?: any): EventRef;
    on(
      name: "mx-preload-err",
      callback: (err: unknown) => any,
      ctx?: any,
    ): EventRef;
    trigger(name: "mx-preload-ready"): void;
    trigger(name: "mx-preload-err", err: unknown): void;
  }
}

export class BilibiliRequestHacker extends Component {
  get app() {
    return this.plugin.app;
  }
  constructor(public plugin: MxPlugin) {
    super();
  }

  /**
   * null if load failed
   */
  ready: boolean | null = false;

  private onReady(): void {
    this.ready = true;
    this.app.metadataCache.trigger("mx-preload-ready");
  }
  private onError(err: unknown): void {
    console.error("Failed to load preload", err);
    this.ready = null;
    this.app.metadataCache.trigger("mx-preload-err", err);
  }

  untilReady(timeout = 5e3): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ready) return resolve();
      if (this.ready === null) return reject(new Error("Cannot load"));
      const onReady = () => {
        this.app.metadataCache.off("mx-preload-ready", onReady);
        this.app.metadataCache.off("mx-preload-err", onError);
        resolve();
      };
      const onError = (err: unknown) => {
        this.app.metadataCache.off("mx-preload-ready", onReady);
        this.app.metadataCache.off("mx-preload-err", onError);
        reject(err);
      };
      this.app.metadataCache.on("mx-preload-ready", onReady);
      this.app.metadataCache.on("mx-preload-err", onError);
      setTimeout(() => {
        onError(new Error("Timeout"));
      }, timeout);
    });
  }

  onload(): void {
    if (!Platform.isDesktopApp) {
      this.onReady();
      return;
    }
    const path = require("path") as typeof import("node:path");
    const fs = require("fs/promises") as typeof import("node:fs/promises");

    const userDataDir = getUserDataPath();
    const preloadLoaderPath = path.join(
      userDataDir,
      `mx-player-hack.${Date.now()}.js`,
    );
    const preloadScriptPath = path.join(
      userDataDir,
      `mx-preload.${Date.now()}.js`,
    );

    (async () => {
      await Promise.all([
        fs.writeFile(preloadLoaderPath, preloadLoaderCode, "utf-8"),
        fs.writeFile(preloadScriptPath, preloadScriptCode, "utf-8"),
      ]);
      // console.log(preloadLoaderPath, preloadScriptPath);
      this.register(() => {
        fs.rm(preloadScriptPath, { force: true, maxRetries: 5 }).catch((e) =>
          console.warn("Failed to remove preload script", preloadScriptPath, e),
        );
      });
      try {
        await evalInMainPs(preloadLoaderPath);
        console.debug("preload patch loaded");
      } finally {
        await fs
          .rm(preloadLoaderPath, { force: true, maxRetries: 5 })
          .catch((e) =>
            console.warn("Failed to remove hack script", preloadLoaderPath, e),
          );
      }
      const { ipcRenderer } = require("electron");
      console.log(channel.enable);
      await ipcRenderer.invoke(channel.enable, preloadScriptPath);
      this.register(() => {
        ipcRenderer.invoke(channel.disable);
      });
      console.log("mx-player-hack loaded");
      this.onReady();
    })().catch((e) => this.onError(e));
  }
}
