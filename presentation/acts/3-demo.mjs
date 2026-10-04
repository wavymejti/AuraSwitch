// Act III – live demo: Brave + Phantom (screen track), presentation mode + real agent + phone (page track).
import { agent } from "../lib/agent.mjs";
import { B } from "../lib/env.mjs";
import { overlay } from "../lib/overlay.mjs";
import { approveInPhantom, connectApp } from "../lib/phantom.mjs";
import { waitStableText } from "../lib/wait.mjs";

// 30 s leaves the agent time to discover the new fund and ping it; III.3 is sped up anyway.
const TIMEOUT_SECS = process.env.DEMO_TIMEOUT ?? "30";
/** Deposit (and therefore the amount handed over to B) – the app shows it as "0,5 SOL". */
export const DEMO_AMOUNT = Number(process.env.DEMO_AMOUNT ?? "0.5");
const AMOUNT_PL = DEMO_AMOUNT.toLocaleString("pl-PL");

export default async ({ context, wallet, stage, mark, cue, APP, state, focusBrave }) => {
  if (!wallet) throw new Error("Akt III wymaga Brave z Phantomem (bez --headless)");

  // The phone must be broadcasting before the fund exists – otherwise its short timeout
  // runs out and the agent releases it before the presentation view is even open.
  if (!(await agent.status()).phone?.present) {
    await cue("WŁĄCZ NADAWANIE W LIGHTBLUE");
    await agent.waitFor((s) => s.phone?.present, 120_000, "phone present before creating the fund");
  }

  // III.1 – the caregiver creates the fund in Brave and signs in Phantom ("screen" track)
  await focusBrave();
  await wallet.bringToFront();
  await connectApp(context, wallet, APP); // reloads /app and reconnects Phantom if needed (off camera)
  // A has funds from earlier takes and /app opens the newest one – start a new fund off camera.
  const fresh = wallet.getByText("Stwórz aurę dla bliskiej osoby");
  const newFund = wallet.getByRole("button", { name: /nowy fundusz/ });
  await fresh.or(newFund).first().waitFor({ timeout: 30_000 });
  if (await newFund.isVisible()) await newFund.click();
  await fresh.waitFor();
  await wallet.waitForTimeout(600);
  mark("III.1:in");

  const bInput = wallet.getByLabel(/Opiekun zastępczy/);
  await overlay.cursorTo(wallet, bInput);
  await bInput.click();
  await bInput.pressSequentially(B, { delay: 15 });
  const timeInput = wallet.getByLabel(/Czas bez/);
  await overlay.cursorTo(wallet, timeInput);
  await timeInput.fill(TIMEOUT_SECS);

  const create = wallet.getByRole("button", { name: /Załóż fundusz/ });
  await overlay.cursorTo(wallet, create);
  await approveInPhantom(context, () => create.click(), { mark });
  await wallet.locator(".status-card").waitFor({ timeout: 45_000 });

  const amount = wallet.getByLabel("Kwota wpłaty w SOL");
  await overlay.cursorTo(wallet, amount);
  await amount.fill(AMOUNT_PL);
  const deposit = wallet.getByRole("button", { name: "Wpłać" });
  await overlay.cursorTo(wallet, deposit);
  await approveInPhantom(context, () => deposit.click(), { mark });
  await wallet.locator(".balance-value", { hasText: new RegExp(`^${AMOUNT_PL.replace(",", "[,.]")}\\s*SOL`) }).waitFor({ timeout: 45_000 });
  await wallet.waitForTimeout(1200);
  mark("III.1:out");
  await overlay.clear(wallet);

  const q = new URL(wallet.url()).search; // ?owner=…&id=… – written by the app
  const fundId = new URLSearchParams(q).get("id");
  if (!fundId) throw new Error(`Brak id funduszu w adresie: ${wallet.url()}`);
  const s0 = await agent.status();
  if (s0.vault?.id === fundId && s0.vault.released) {
    throw new Error("Fundusz został przekazany, zanim zaczęła się scena III.2 – telefon nie nadawał (LightBlue musi być na ekranie). Odeślij SOL z B do A i powtórz.");
  }

  // III.2 – phone nearby ("page" track + phone PiP)
  await stage.bringToFront(); // must stay in front until III.4 – hidden tabs stop polling
  await stage.goto(`${APP}/pokaz${q}`, { waitUntil: "domcontentloaded" });
  await agent.waitFor((s) => s.vault?.id === fundId && s.vault.active && s.phone.present, 60_000, "agent watching the new fund, phone present");
  await stage.getByText("Telefon w pobliżu").waitFor({ timeout: 20_000 });
  mark("III.2:in");
  const before = (await agent.status()).lastPing?.sig;
  const releaseBefore = (await agent.status()).lastRelease?.sig; // the agent remembers releases from earlier takes
  await agent.waitFor((s) => s.lastPing && s.lastPing.sig !== before, 30_000, "a fresh heartbeat");
  await stage.waitForTimeout(2500); // the ripple from the orb
  mark("III.2:out");

  // III.3 – the signal disappears (sped up in the montage, with a badge)
  mark("III.3:cue");
  await cue("WYŁĄCZ NADAWANIE W LIGHTBLUE");
  await agent.waitFor((s) => !s.phone.present, 45_000, "phone gone");
  mark("III.3:in");
  await overlay.badge(stage, "⏩ przyspieszone");
  await agent.waitFor(
    (s) => s.vault?.id === fundId && s.lastRelease && s.lastRelease.sig !== releaseBefore,
    120_000,
    "release sent by the agent",
  );
  await overlay.clear(stage, "badge");
  await stage.locator(".celebrate").waitFor({ timeout: 15_000 });
  mark("III.3:out");

  // III.4 – the release: celebration, then B's balance settles
  mark("III.4:in");
  await stage.locator(".celebrate").waitFor({ state: "detached", timeout: 20_000 });
  await waitStableText(stage.locator(".person-balance"), 2000);
  mark("III.4:out");
  state.releaseSig = (await agent.status()).lastRelease.sig;
  state.beneficiary = B;

  // III.5 – the caregiver returns: "Jestem" in Phantom ("screen" track)
  await cue("WŁĄCZ NADAWANIE W LIGHTBLUE");
  await focusBrave();
  await wallet.bringToFront();
  await wallet.getByText("Przekazany zastępcy").first().waitFor({ timeout: 20_000 });
  mark("III.5:in");
  const ping = wallet.getByRole("button", { name: "Jestem" });
  await overlay.cursorTo(wallet, ping);
  await approveInPhantom(context, () => ping.click(), { mark });
  await wallet.getByText("Aktywny", { exact: true }).first().waitFor({ timeout: 45_000 });
  await wallet.waitForTimeout(2000);
  mark("III.5:out");
  await overlay.clear(wallet);
};
