// "Page" track: CDP screencast of the `stage` tab. Frames carry wall-clock timestamps
// (seconds since epoch) – the same clock as markers.mjs, so cuts line up exactly.
import fs from "node:fs";
import path from "node:path";

export const startScreencast = async (page, dir, { width = 1920, height = 1080, quality = 92 } = {}) => {
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `${String(++n).padStart(6, "0")}.jpg`);
    fs.writeFile(file, Buffer.from(data, "base64"), () => {});
    frames.push({ file: path.basename(file), t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  return {
    frames,
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => {});
      fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify(frames));
      return frames;
    },
  };
};

/** Three white frames over the whole page – the montage finds them in the "screen" track to sync both tracks. */
export const flash = async (page, mark) => {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.createElement("div");
        el.dataset.overlay = "flash";
        el.style.cssText = "position:fixed;inset:0;background:#fff;z-index:2147483647";
        document.body.appendChild(el);
        let frames = 0;
        const tick = () => (++frames < 3 ? requestAnimationFrame(tick) : (el.remove(), resolve()));
        requestAnimationFrame(tick);
      }),
  );
  mark("sync:flash");
};
