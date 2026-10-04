// A cue for the human operator (e.g. "turn LightBlue off"): spoken + a big terminal banner.
import { spawn } from "node:child_process";

export const cue = async (text) => {
  const line = "█".repeat(Math.min(80, text.length + 8));
  console.log(`\n\x1b[45m\x1b[1m${line}\n██  ${text}  ██\n${line}\x1b[0m\n`);
  process.stdout.write("\x07"); // terminal bell
  spawn("say", ["-v", process.env.CUE_VOICE ?? "Zosia", text.toLowerCase()], { stdio: "ignore" }).on("error", () => {});
};
