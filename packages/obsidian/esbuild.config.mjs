import obPlugin from "@aidenlx/esbuild-plugin-obsidian";
import { htmlPlugin } from "@craftamap/esbuild-plugin-html";
import { build } from "esbuild";
import { lessLoader } from "esbuild-plugin-less";
import svgrPlugin from "esbuild-plugin-svgr";
import open from "open";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source visit the plugins github repository
*/
`;

const isProd = process.env.BUILD === "production";

const cmModules = [
  "@codemirror/autocomplete",
  "@codemirror/closebrackets",
  "@codemirror/collab",
  "@codemirror/commands",
  "@codemirror/comment",
  "@codemirror/fold",
  "@codemirror/gutter",
  "@codemirror/highlight",
  "@codemirror/history",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/matchbrackets",
  "@codemirror/panel",
  "@codemirror/rangeset",
  "@codemirror/rectangular-selection",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/stream-parser",
  "@codemirror/text",
  "@codemirror/tooltip",
  "@codemirror/view",
];

import { promises } from "fs";
import { join } from "path";

import inlineCodePlugin from "./scripts/inline-code.mjs";
import { INJECT_BILIBILI, MAIN_PS } from "./src/const.mjs";
/**
 * @type {import("esbuild").Plugin}
 */
const remoteRedux = {
  name: "enable-remote-redux-devtools",
  setup: (build) => {
    if (isProd) return;
    build.onLoad({ filter: /create-store\.ts$/ }, async (args) => ({
      contents: (
        `import devToolsEnhancer from "remote-redux-devtools";` +
        (await promises.readFile(args.path, "utf8"))
      ).replace(
        `enhancers: []`,
        `enhancers: [
          devToolsEnhancer({
            realtime: true,
            hostname: "localhost",
            port: 8000,
            name,
            trace: (action)=> { console.groupCollapsed(action.type, name); console.trace(action); console.groupEnd(); return new Error().stack; },
          })
        ]`,
      ),
      loader: "ts",
    }));
  },
};

/**
 * @type {import("esbuild").Plugin}
 */
const LessPathAlias = {
  name: "less-path-alias",
  setup: (build) => {
    build.onResolve(
      { filter: /^@styles.+\.less$/, namespace: "file" },
      async ({ path, namespace }) => {
        return {
          path: join(
            process.cwd(),
            "..",
            "player",
            "src",
            "component",
            "styles",
            path.match(/@styles\/(.+)/)[1],
          ),
          namespace,
        };
      },
    );
  },
};

const injectScriptConfig = {
  bundle: true,
  watch: !isProd,
  platform: "browser",
  target: "es2020",
  format: "iife",
  mainFields: ["browser", "module", "main"],
  banner: { js: banner },
  sourcemap: isProd ? false : "inline",
  minify: isProd,
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.BUILD),
  },
};

const windowTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
</head>
<body>
    <div id="root"></div>
</body>
</html>
`;

try {
  const main = build({
    entryPoints: ["src/mx-main.ts"],
    bundle: true,
    watch: !isProd,
    platform: "browser",
    external: [
      "obsidian",
      "https",
      "@electron/remote",
      "electron",
      ...cmModules,
    ],
    format: "cjs",
    mainFields: ["browser", "module", "main"],
    sourcemap: isProd ? false : "inline",
    minify: isProd,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.BUILD),
    },
    outfile: "build/main.js",
    plugins: [
      LessPathAlias,
      lessLoader(),
      obPlugin(),
      inlineCodePlugin(injectScriptConfig),
      svgrPlugin(),
    ],
    // metafile: true,
  });
  const preloadBili = build({
    entryPoints: ["../player/src/component/bilibili/inject/index.ts"],
    outfile: join("build", INJECT_BILIBILI),
    ...injectScriptConfig,
    // incremental: !isProd,
    // metafile: true,
  });
  const mainProcess = build({
    entryPoints: ["src/ipc/hack/main-ps/index.ts"],
    bundle: true,
    watch: !isProd,
    platform: "browser",
    external: ["electron"],
    target: "es2020",
    format: "cjs",
    mainFields: ["browser", "module", "main"],
    sourcemap: isProd ? false : "inline",
    minify: isProd,
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.BUILD),
    },
    outfile: join("build", MAIN_PS),
    // metafile: true,
  });
  // const window = build({
  //   entryPoints: ["src/index-win.tsx"],
  //   metafile: true,
  //   outdir: "build/window/",
  //   bundle: true,
  //   watch: !isProd,
  //   platform: "browser",
  //   external: ["electron"],
  //   format: "cjs",
  //   mainFields: ["browser", "module", "main"],
  //   sourcemap: isProd ? false : "inline",
  //   minify: isProd,
  //   define: {
  //     "process.env.NODE_ENV": JSON.stringify(process.env.BUILD),
  //   },
  //   plugins: [
  //     LessPathAlias,
  //     lessLoader(),
  //     inlineCodePlugin(injectScriptConfig),
  //     svgrPlugin(),
  //     htmlPlugin({
  //       files: [
  //         {
  //           entryPoints: ["src/index-win.tsx"],
  //           filename: "index.html",
  //           scriptLoading: "blocking",
  //           title: "Media Extended",
  //           htmlTemplate: windowTemplate,
  //         },
  //       ],
  //     }),
  //   ],
  //   // metafile: true,
  // });
  // await promises.writeFile(
  //   "meta.json",
  //   JSON.stringify((await main).metafile),
  //   "utf8",
  // );
  if (!isProd) open("obsidian://open?vault=mx-test");
} catch (err) {
  console.error(err);
  process.exit(1);
}
