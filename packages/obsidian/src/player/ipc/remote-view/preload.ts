import { getWebViewPort } from "@ipc/comms";

const PreloadSetup = (injectCode: string, origin: string): any => {
  console.log("running preload script");
  const port = getWebViewPort().then((port) => {
    console.log(
      "browser view port ready, sending from isolated world to main world",
    );
    return port;
  });
  window.addEventListener("DOMContentLoaded", () => {
    const scriptEl = document.createElement("script");
    scriptEl.textContent = injectCode;
    document.head.append(scriptEl);
    port.then((port) => window.postMessage("port", origin, [port]));
  });
};
export default PreloadSetup;
