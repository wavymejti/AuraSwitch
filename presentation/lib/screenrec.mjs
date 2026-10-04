// "Screen" track: the whole display via ffmpeg/AVFoundation (real Brave chrome + Phantom popup).
// The montage crops the browser window using the logical→physical scale saved here.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const logicalScreen = () => {
  try {
    const out = execFileSync("osascript", ["-e", 'tell application "Finder" to get bounds of window of desktop'], { encoding: "utf8" });
    const [, , w, h] = out.trim().split(/,\s*/).map(Number);
    return { width: w, height: h };
  } catch {
    return null;
  }
};

export const startScreenRecording = async (file, { mark, device = "Capture screen 0" } = {}) => {
  const proc = spawn(
    "ffmpeg",
    [
      "-y", "-hide_banner",
      "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "30", "-pixel_format", "nv12",
      "-i", `${device}:none`,
      "-c:v", "libx264", "-crf", "16", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      file,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let log = "";
  const started = new Promise((resolve, reject) => {
    proc.stderr.on("data", (d) => {
      log += d;
      if (/frame=\s*\d+/.test(log)) resolve();
    });
    proc.on("exit", (code) => reject(new Error(`ffmpeg exited (${code}) before recording started:\n${log.slice(-800)}`)));
  });
  await Promise.race([started, new Promise((_, r) => setTimeout(() => r(new Error(`ffmpeg did not start:\n${log.slice(-800)}`)), 15_000))]);
  mark?.("screen:start");
  const meta = { file, logicalScreen: logicalScreen() };
  fs.writeFileSync(`${file}.json`, JSON.stringify(meta, null, 2));
  return {
    async stop() {
      mark?.("screen:stop");
      proc.stdin.write("q");
      await new Promise((r) => proc.on("exit", r));
      return meta;
    },
  };
};
