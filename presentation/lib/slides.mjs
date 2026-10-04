// Drives /slajdy through window.__slides. Each slide is held for its target length
// (or the narration length if audio/<id>.wav exists), split evenly across its steps.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { clip, SLIDE_STEPS } from "../timeline.mjs";

const audioSeconds = (id) => {
  const file = new URL(`../audio/${id}.wav`, import.meta.url).pathname;
  if (!fs.existsSync(file)) return null;
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(out) + 0.4;
};

export const slideDuration = (id) => audioSeconds(id) ?? clip(id).target;

export const createSlides = (stage, APP, mark) => {
  return async (id) => {
    // (Re)load /slajdy when the stage tab is elsewhere (first slide, or after Explorer / the demo).
    const loaded = stage.url().includes("/slajdy") && (await stage.evaluate(() => !!window.__slides).catch(() => false));
    if (!loaded) {
      // Warm-up on a different slide so fonts are cached and the real slide mounts fresh
      // (its entrance animation is part of the shot). Cut away by the :in marker.
      const warm = id === "V.2" ? "V.1" : "V.2";
      await stage.goto(`${APP}/slajdy?s=${warm}`, { waitUntil: "domcontentloaded" });
      await stage.waitForFunction(() => window.__slides);
      await stage.evaluate(() => window.__slides.ready);
    }
    mark(`${id}:in`);
    await stage.evaluate((id) => window.__slides.show(id, 0), id);
    const steps = SLIDE_STEPS[id];
    const total = slideDuration(id) + 0.6; // a little extra for the montage to trim
    const per = (total / steps) * 1000;
    const t0 = Date.now();
    for (let s = 1; s < steps; s++) {
      const wait = t0 + per * s - Date.now();
      if (wait > 0) await stage.waitForTimeout(wait);
      await stage.evaluate(() => window.__slides.next());
    }
    const rest = t0 + total * 1000 - Date.now();
    if (rest > 0) await stage.waitForTimeout(rest);
    mark(`${id}:out`);
  };
};
