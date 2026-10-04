// Act 0 – checks that abort the take before anything is recorded.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { agent } from "../lib/agent.mjs";
import { A, DEVICE, appEnv, rpc } from "../lib/env.mjs";
import { connectApp } from "../lib/phantom.mjs";

const fail = (msg) => {
  throw new Error(`PREFLIGHT: ${msg}`);
};
const ok = (m) => console.log(`  ✔ ${m}`);

const freeGb = () => {
  const out = execFileSync("df", ["-g", new URL("..", import.meta.url).pathname], { encoding: "utf8" });
  return Number(out.trim().split("\n").pop().split(/\s+/)[3]);
};

export default async ({ context, stage, wallet, APP, headless, acts }) => {
  const res = await fetch(APP).catch(() => null);
  if (!res?.ok) fail(`${APP} nie odpowiada – uruchom aplikację (npm run build && npx vite preview --port 5173)`);
  ok(`aplikacja ${APP}`);

  await stage.goto(`${APP}/slajdy?s=V.2`, { waitUntil: "domcontentloaded" });
  await stage.waitForFunction(() => window.__slides);
  await stage.evaluate(() => window.__slides.ready);
  const env = await stage.evaluate(() => ({
    fonts: document.fonts.check('700 40px "Outfit"') && document.fonts.check('400 16px "Inter"'),
    webgl2: !!document.createElement("canvas").getContext("webgl2"),
  }));
  if (!env.fonts) fail("fonty Outfit/Inter nie są wczytane");
  if (!env.webgl2) fail("brak WebGL2 – tło topograficzne nie zadziała");
  ok("fonty Outfit + Inter, WebGL2");

  const url = appEnv("VITE_RPC") ?? "";
  if (!url || /api\.devnet\.solana\.com/.test(url)) fail("VITE_RPC to publiczny devnet – 429 w trakcie nagrania. Ustaw prywatny (Helius).");
  ok("prywatny RPC");

  const free = freeGb();
  if (free < 3) fail(`za mało miejsca na dysku (${free} GB, potrzeba ≥ 3 GB)`);
  ok(`wolne miejsce ${free} GB`);

  // Chain clock vs. local clock (the countdown and the agent both assume they agree).
  const clock = await rpc("getAccountInfo", ["SysvarC1ock11111111111111111111111111111111", { encoding: "jsonParsed" }]);
  const drift = Math.abs(clock.value.data.parsed.info.unixTimestamp - Date.now() / 1000);
  if (drift > 5) fail(`zegar sieci różni się od lokalnego o ${drift.toFixed(1)} s (> 5 s)`);
  ok(`różnica zegara ${drift.toFixed(1)} s`);

  if (!acts.includes(3) || headless) return;

  const sol = async (key) => (await rpc("getBalance", [key])).value / 1e9;
  const [a, d] = await Promise.all([sol(A), sol(DEVICE)]);
  const need = Number(process.env.DEMO_AMOUNT ?? "0.5") + 0.05; // deposit + fees and the fund's rent
  if (a < need) fail(`konto A ma ${a.toFixed(3)} SOL (potrzeba ≥ ${need.toLocaleString("pl-PL")}) – odeślij SOL z B do A`);
  if (d < 0.05) fail(`klucz urządzenia ma ${d.toFixed(3)} SOL (potrzeba ≥ 0,05)`);
  ok(`saldo A ${a.toFixed(3)} SOL, klucz urządzenia ${d.toFixed(3)} SOL`);

  const s = await agent.status().catch(() => fail("agent obecności nie działa (cd presence && PHONE=CareSwitch npm start)"));
  if (!s.phone?.present) fail("agent nie widzi telefonu – otwórz LightBlue i włącz nadawanie");
  if (s.phone.lastSeenSecsAgo > 3) fail("sygnał telefonu jest przerywany – LightBlue musi być na ekranie, telefon odblokowany");
  ok(`agent widzi telefon (${s.phone.rssi} dBm)`);

  // Phantom connected as A before recording starts – no "Connect" popup on camera.
  const label = await connectApp(context, wallet, APP).catch((e) => fail(`nie udało się połączyć aplikacji z Phantomem: ${e.message.split("\n")[0]}`));
  if (!label.startsWith(A.slice(0, 4))) {
    fail(`Phantom jest połączony jako ${label}, a nie A (${A.slice(0, 4)}…). W Phantomie wybierz konto A i spróbuj ponownie.`);
  }
  ok(`Phantom połączony jako ${label}`);
};
