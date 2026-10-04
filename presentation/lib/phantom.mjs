// Phantom extension helpers. The popup is a separate window, so scenes with it
// are taken from the "screen" track.
import { WINDOW } from "./browser.mjs";
import { overlay } from "./overlay.mjs";

export const PHANTOM_ID = process.env.PHANTOM_ID ?? "bfnaelmomeimhlpmgjnjophhpkkoljpa";
const isPhantom = (url) => url.startsWith(`chrome-extension://${PHANTOM_ID}/`);

/**
 * Unlocks Phantom with PHANTOM_PASSWORD (env, never in the repo) if it asks for it.
 * Without the env var the operator unlocks it by hand in the opened tab (before recording starts).
 */
export const unlockPhantom = async (context) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${PHANTOM_ID}/popup.html`);
  await page.waitForTimeout(2500);
  const pass = page.locator('input[type="password"]').first();
  if (await pass.isVisible().catch(() => false)) {
    if (process.env.PHANTOM_PASSWORD) {
      await pass.fill(process.env.PHANTOM_PASSWORD);
      await page.keyboard.press("Enter");
    } else {
      await page.bringToFront();
      console.log("\n  🔒 Phantom jest zablokowany – odblokuj go w otwartej karcie Brave (czekam do 3 min)…");
      process.stdout.write("\x07");
    }
    await pass.waitFor({ state: "hidden", timeout: 180_000 });
    await page.waitForTimeout(1500);
  }
  await page.close();
};

/**
 * Phantom's popup inherits a full-screen state from the automated window. Put it back
 * as a normal small window at the right edge of the Brave window, where it appears in
 * everyday use, so the app stays visible behind it in the "screen" track.
 */
const placePopup = async (popup) => {
  try {
    const cdp = await popup.context().newCDPSession(popup);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await popup.waitForTimeout(400);
    const width = 380;
    const height = 640;
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { left: WINDOW.x + WINDOW.width - width - 24, top: WINDOW.y + 90, width, height },
    });
    await popup.waitForTimeout(300);
  } catch (e) {
    console.warn(`  ! Nie udało się ustawić okna Phantoma: ${e.message.split("\n")[0]}`);
  }
};

/** Clicks `trigger`, waits for the Phantom popup, shows it for `showMs`, then confirms. */
export const approveInPhantom = async (context, trigger, { mark, showMs = 1200, timeout = 20_000 } = {}) => {
  const popupP = context.waitForEvent("page", { predicate: (p) => isPhantom(p.url()), timeout });
  await trigger();
  const popup = await popupP;
  await popup.waitForLoadState("domcontentloaded");
  await placePopup(popup);
  mark?.("phantom:open");
  await popup.waitForTimeout(showMs); // the viewer has to see the window
  const confirm = popup.getByRole("button", { name: /^(confirm|approve|connect|zatwierdź|potwierdź|połącz)/i }).first();
  await confirm.waitFor({ timeout });
  await overlay.cursorTo(popup, confirm, { ms: 450 }).catch(() => {});
  await confirm.click();
  mark?.("phantom:confirm");
  await popup.waitForEvent("close", { timeout: 15_000 }).catch(() => {});
};

/**
 * Connects the app to Phantom once (wallet-adapter then remembers it in the demo
 * profile). Returns the label of the wallet button (shortened address).
 */
export const connectApp = async (context, page, APP) => {
  await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
  // No durable nonce on camera (Phantom warns about it); approvals take ~1 s anyway.
  await page.evaluate(() => localStorage.setItem("auraswitch.nonce", "off"));
  const button = page.locator(".topbar .wallet-adapter-button");
  await button.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(3000); // autoConnect, if already remembered
  if (!/select wallet/i.test(await button.innerText())) return (await button.innerText()).trim();

  await button.click();
  const phantom = page.locator(".wallet-adapter-modal-list .wallet-adapter-button", { hasText: "Phantom" });
  await phantom.waitFor({ timeout: 10_000 });
  const popupP = context
    .waitForEvent("page", { predicate: (p) => isPhantom(p.url()), timeout: 8000 })
    .catch(() => null); // a trusted site connects without a popup
  await phantom.click();
  const popup = await popupP;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded");
    const ok = popup.getByRole("button", { name: /^(connect|połącz|confirm|approve)/i }).first();
    await ok.waitFor({ timeout: 15_000 });
    await ok.click();
  }
  await page.waitForFunction(
    () => !/select wallet|connecting/i.test(document.querySelector(".topbar .wallet-adapter-button")?.textContent ?? ""),
    null,
    { timeout: 20_000 },
  );
  return (await button.innerText()).trim();
};
