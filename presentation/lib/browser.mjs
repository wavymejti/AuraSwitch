// Brave (with the Phantom extension) for the real recording, or headless Chrome
// for testing slides/screencast without opening windows (`--headless`).
import { chromium } from "playwright-core";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Window rectangle (logical px) – the same rectangle frames the "screen" track. */
export const WINDOW = { x: 0, y: 25, width: 1440, height: 875 };
export const STAGE = { width: 1920, height: 1080 };

const profile = (name) => new URL(`../${name}`, import.meta.url).pathname;

/**
 * Phantom loaded from a folder (setup-profile.mjs copies it from your Brave). Its manifest
 * carries the store key, so it gets the same extension ID and finds the copied wallet storage.
 * (A copied *registration* doesn't survive: Brave signs extension prefs per profile.)
 */
export const PHANTOM_DIR = profile(".phantom-extension");

/**
 * Forgets the previous session so leftover tabs from earlier takes don't clutter the
 * tab strip in the "screen" track. (Settings stay untouched – Brave signs them.)
 */
const clearSessions = async () => {
  const fs = await import("node:fs");
  const dir = `${profile(".brave-profile")}/Default`;
  for (const name of ["Sessions", "Current Session", "Current Tabs", "Last Session", "Last Tabs"]) {
    fs.rmSync(`${dir}/${name}`, { recursive: true, force: true });
  }
  // Per-site zoom copied from your Brave (e.g. localhost at 80%) would shrink/shift the frame.
  // Zoom prefs aren't MAC-signed, so removing them doesn't disturb anything else.
  const prefsFile = `${dir}/Preferences`;
  if (fs.existsSync(prefsFile)) {
    const prefs = JSON.parse(fs.readFileSync(prefsFile, "utf8"));
    if (prefs.partition) {
      delete prefs.partition.per_host_zoom_levels;
      delete prefs.partition.default_zoom_level;
      fs.writeFileSync(prefsFile, JSON.stringify(prefs));
    }
  }
};

export const launchBrave = async () => {
  await clearSessions();
  return chromium.launchPersistentContext(profile(".brave-profile"), {
    executablePath: BRAVE,
    headless: false,
    chromiumSandbox: true, // no "--no-sandbox" warning bar in the recorded window
    viewport: null, // the `wallet` tab keeps the real window size
    ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"],
    args: [
      `--load-extension=${PHANTOM_DIR}`,
      `--disable-extensions-except=${PHANTOM_DIR}`,
      `--window-position=${WINDOW.x},${WINDOW.y}`,
      `--window-size=${WINDOW.width},${WINDOW.height}`,
      "--hide-crash-restore-bubble",
      "--force-color-profile=srgb",
    ],
    locale: "pl-PL",
    colorScheme: "dark",
    reducedMotion: "no-preference", // otherwise ReleaseCelebration skips its animation
  });
};

/** Headless Chrome, no extensions – enough for slides, /pokaz and Explorer. */
export const launchTestBrowser = () =>
  chromium.launchPersistentContext(profile(".chrome-test-profile"), {
    executablePath: CHROME,
    headless: true,
    viewport: STAGE,
    args: ["--use-angle=metal", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--force-color-profile=srgb"],
    locale: "pl-PL",
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });

/**
 * The `stage` tab in Brave: a 16:9 viewport that fits inside the window, rendered at a
 * device scale factor that makes it exactly 1920×1080 physical pixels. The live window
 * shows the whole frame and the screencast is still full 1080p.
 */
const STAGE_CSS = { width: 1400, height: 788 };
const keepAlive = [];
const fitStage = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  keepAlive.push(cdp); // the override lives as long as this session
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...STAGE_CSS,
    deviceScaleFactor: (STAGE.width + 0.5) / STAGE_CSS.width, // +0.5: avoid 1919 px from rounding
    mobile: false,
  });
};

/** Two tabs: `stage` (1920×1080 frames, "page" track) and `wallet` (real window, "screen" track). */
export const openTabs = async (context, { headless }) => {
  const [first] = context.pages();
  const stage = first ?? (await context.newPage());
  if (headless) await stage.setViewportSize(STAGE);
  else await fitStage(stage);
  const wallet = headless ? null : await context.newPage();
  await stage.bringToFront();
  return { stage, wallet };
};

/**
 * Brings the automated Brave window to the front of macOS (Playwright only switches tabs
 * inside the browser; the "screen" track needs the window itself on top of the terminal).
 * Targets this Brave instance by PID, not your everyday Brave.
 */
export const focusBrave = async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = profile(".brave-profile");
  const pid = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" })
    .split("\n")
    .find((l) => l.includes(`--user-data-dir=${dir}`) && !l.includes("--type="))
    ?.trim()
    .split(/\s+/)[0];
  if (!pid) return false;
  try {
    execFileSync("osascript", ["-e", `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`]);
    await new Promise((r) => setTimeout(r, 600));
    return true;
  } catch (e) {
    console.warn(`  ! Nie udało się wyciągnąć Brave na wierzch (${e.message.split("\n")[0]}). Kliknij okno Brave ręcznie.`);
    return false;
  }
};
