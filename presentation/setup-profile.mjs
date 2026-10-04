// Prepares the demo Brave profile (presentation/.brave-profile) from your main Brave
// profile, where Phantom with the test accounts already works.
//
// Why a copy: Chromium ≥ 136 refuses automation (remote debugging) on the default
// profile directory, so Playwright can't drive your main Brave. The copy takes only
// what the demo needs – extensions with their storage (Phantom's encrypted wallet)
// and Brave settings – and skips history, cookies, passwords, autofill, bookmarks,
// open tabs and caches, so none of that can show up in the recording.
//
//   node setup-profile.mjs [--from="<Brave user data dir>"] [--profile=Default]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PHANTOM_DIR, launchBrave } from "./lib/browser.mjs";
import { A } from "./lib/env.mjs";
import { PHANTOM_ID, connectApp } from "./lib/phantom.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const SRC_ROOT = arg("from", path.join(os.homedir(), "Library/Application Support/BraveSoftware/Brave-Browser"));
const SRC = path.join(SRC_ROOT, arg("profile", "Default"));
const DST_ROOT = new URL(".brave-profile", import.meta.url).pathname;
const DST = path.join(DST_ROOT, "Default");

if (!fs.existsSync(path.join(SRC, "Extensions", PHANTOM_ID))) {
  console.error(`✖ W ${SRC} nie ma Phantoma (${PHANTOM_ID}).`);
  process.exit(1);
}

// Only these – everything else in the profile (history, cookies, logins, caches…) stays behind.
const KEEP = ["Extensions", "Local Extension Settings", "Sync Extension Settings", "Extension State", "Extension Rules", "Extension Scripts", "Preferences", "Secure Preferences"];

fs.rmSync(DST_ROOT, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });
fs.copyFileSync(path.join(SRC_ROOT, "Local State"), path.join(DST_ROOT, "Local State"));
for (const name of KEEP) {
  const from = path.join(SRC, name);
  if (!fs.existsSync(from)) continue;
  execFileSync("cp", ["-R", from, path.join(DST, name)]);
}

// Preferences are copied untouched: Brave signs tracked settings (MACs in Secure
// Preferences) and resets them – unregistering extensions, Phantom included – if any is
// edited. Open tabs won't come back anyway, because session files aren't copied.

// Phantom itself, outside the profile (Brave garbage-collects unregistered extension folders).
const versions = fs.readdirSync(path.join(SRC, "Extensions", PHANTOM_ID)).filter((v) => !v.startsWith(".")).sort();
fs.rmSync(PHANTOM_DIR, { recursive: true, force: true });
execFileSync("cp", ["-R", path.join(SRC, "Extensions", PHANTOM_ID, versions.at(-1)), PHANTOM_DIR]);
console.log(`✔ Phantom ${versions.at(-1)} → ${PHANTOM_DIR}`);

const size = execFileSync("du", ["-sh", DST_ROOT], { encoding: "utf8" }).split("\t")[0];
console.log(`✔ Profil demo skopiowany (${size}): ${DST_ROOT}`);

// Verify: Phantom loads in the copy.
const context = await launchBrave();
const page = context.pages()[0] ?? (await context.newPage());
const loaded = await page
  .goto(`chrome-extension://${PHANTOM_ID}/popup.html`, { timeout: 15_000 })
  .then(() => true)
  .catch(() => false);
let state = "nie wczytał się";
if (loaded) {
  await page.waitForTimeout(3000);
  state = (await page.locator('input[type="password"]').first().isVisible().catch(() => false))
    ? "działa (zablokowany – przy nagraniu podaj PHANTOM_PASSWORD albo odblokuj ręcznie)"
    : "działa i jest odblokowany";
}
console.log(`${loaded ? "✔" : "✖"} Phantom w profilu demo: ${state}`);

// Connect the app once so the recording never shows the "Connect" step.
const APP = process.env.APP ?? "http://localhost:5173";
try {
  const label = await connectApp(context, page, APP);
  const isA = label.startsWith(A.slice(0, 4));
  console.log(`${isA ? "✔" : "⚠"} Aplikacja połączona z Phantomem jako ${label}${isA ? " (konto A)" : ` – to nie konto A (${A.slice(0, 4)}…): w Phantomie wybierz konto A i uruchom ponownie`}`);
} catch (e) {
  console.log(`✖ Nie udało się połączyć aplikacji z Phantomem: ${e.message.split("\n")[0]}`);
}
await page.waitForTimeout(1500);
await context.close();
