// Orchestrator: preflight → acts → out/<take>/ (frames/, screen.mp4, markers.json).
//   node record.mjs                      full take (Brave + Phantom + agent + phone)
//   node record.mjs --acts=1,2,4,5 --headless   slides/Explorer only, headless Chrome
import fs from "node:fs";
import path from "node:path";
import { focusBrave, launchBrave, launchTestBrowser, openTabs } from "./lib/browser.mjs";
import { cue } from "./lib/cue.mjs";
import { createMarkers } from "./lib/markers.mjs";
import { unlockPhantom } from "./lib/phantom.mjs";
import { flash, startScreencast } from "./lib/screencast.mjs";
import { startScreenRecording } from "./lib/screenrec.mjs";
import { createSlides } from "./lib/slides.mjs";
import preflight from "./acts/0-preflight.mjs";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
const headless = !!arg("headless");
const acts = (arg("acts")?.split("=")[1] ?? "1,2,3,4,5").split(",").map(Number);
const APP = process.env.APP ?? "http://localhost:5173";

// --take=<dir> appends acts to an existing take (e.g. redo act IV without redoing act III).
const OUT = new URL("out", import.meta.url).pathname;
const resume = arg("take")?.split("=")[1];
const take = resume ? path.resolve(OUT, resume) : path.join(OUT, new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(take, { recursive: true });
const nextFree = (base, ext = "") => {
  for (let i = 1; ; i++) {
    const p = path.join(take, i === 1 ? `${base}${ext}` : `${base}-${i}${ext}`);
    if (!fs.existsSync(p)) return p;
  }
};
const stateFile = path.join(take, "state.json");
const savedState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const { mark } = createMarkers(path.join(take, "markers.json"));
console.log(`Nagranie → ${take}\nAkty: ${acts.join(", ")}${headless ? " (headless)" : ""}`);

const context = headless ? await launchTestBrowser() : await launchBrave();
let screencast, screen, tabs;
try {
  if (!headless) await unlockPhantom(context);
  const { stage, wallet } = await openTabs(context, { headless });

  console.log("Preflight:");
  await preflight({ context, stage, wallet, APP, headless, acts });

  if (!headless) await focusBrave(); // the window must cover the terminal for the "screen" track
  await stage.bringToFront();
  screencast = await startScreencast(stage, nextFree("frames"));
  // The screen track is only needed for act III (Brave + Phantom).
  if (!headless && acts.includes(3)) screen = await startScreenRecording(nextFree("screen", ".mp4"), { mark });
  await flash(stage, mark); // syncs the "screen" track with the "page" track

  tabs = { stage, wallet };
  const ctx = { context, stage, wallet, mark, cue, APP, headless, state: { ...savedState }, slide: createSlides(stage, APP, mark), focusBrave };
  const files = { 1: "1-problem", 2: "2-solution", 3: "3-demo", 4: "4-proof", 5: "5-outro" };
  for (const n of acts) {
    console.log(`Akt ${n}:`);
    const { default: run } = await import(`./acts/${files[n]}.mjs`);
    await run(ctx);
    fs.writeFileSync(stateFile, JSON.stringify(ctx.state, null, 2)); // survives a later failure
  }
  console.log(`\n✔ Gotowe: ${take}`);
} catch (err) {
  console.error(`\n✖ Podejście przerwane: ${err.message}`);
  console.error(`  Dograj brakujące akty do tego podejścia: node record.mjs --take=${path.basename(take)} --acts=…`);
  // Evidence for debugging: what each tab showed when the take broke.
  for (const [name, page] of Object.entries(tabs ?? {})) {
    if (!page) continue;
    const file = path.join(take, `blad-${name}.png`);
    await page.screenshot({ path: file }).then(() => console.error(`  zrzut: ${file}`)).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await screencast?.stop();
  await screen?.stop();
  await context.close();
}
