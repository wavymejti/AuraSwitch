// Act IV – Proof: the release transaction in Explorer, then the rule in the program's code.
import { agent } from "../lib/agent.mjs";
import { B, DEVICE, appEnv } from "../lib/env.mjs";
import { overlay } from "../lib/overlay.mjs";
import { clip } from "../timeline.mjs";

/**
 * Tags the smallest element whose text contains every string in `texts` and returns a
 * locator for it. Explorer's markup (Tailwind divs) changes often; text is stable.
 */
const tagRow = async (page, texts, tag) => {
  const found = await page.evaluate(
    ({ texts, tag }) => {
      const all = [...document.querySelectorAll("body *")].filter(
        (el) => el.offsetParent !== null && texts.every((t) => el.textContent.includes(t)),
      );
      const smallest = all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
      // Prefer a row-like element: climb one level if the hit is just the value cell.
      const el = smallest.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
      if (!el) return false;
      el.dataset.spot = tag;
      return true;
    },
    { texts, tag },
  );
  if (!found) throw new Error(`Explorer: nie znalazłem wiersza z ${texts.join(" + ")}`);
  return page.locator(`[data-spot="${tag}"]`);
};

const releaseSignature = async (state) =>
  state.releaseSig ?? process.env.RELEASE_SIG ?? (await agent.status().catch(() => null))?.lastRelease?.sig;

export default async ({ stage, mark, slide, state }) => {
  const sig = await releaseSignature(state);
  if (!sig) throw new Error("Brak podpisu transakcji przekazania (akt III, RELEASE_SIG albo agent.lastRelease)");
  const beneficiary = state.beneficiary ?? B;

  // IV.1 – Explorer
  await stage.bringToFront();
  // Explorer's public devnet RPC rate-limits by IP – fall back to our private one.
  const loaded = async (url) => {
    await stage.goto(url, { waitUntil: "domcontentloaded" });
    const ok = stage.getByText("Success", { exact: true }).first();
    const broken = stage.getByText(/RPC is not responding|Failed to fetch|Too many requests/i).first();
    await ok.or(broken).waitFor({ timeout: 45_000 }).catch(() => {});
    return ok.isVisible().catch(() => false);
  };
  const publicUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
  const privateUrl = `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(appEnv("VITE_RPC") ?? "")}`;
  if (!(await loaded(publicUrl))) {
    console.log("  publiczny RPC Explorera nie odpowiada – używam prywatnego");
    if (!(await loaded(privateUrl))) throw new Error("Explorer nie wczytał transakcji ani przez publiczny, ani przez prywatny RPC");
  }
  await stage.getByText("Accounts & SOL balance").waitFor({ timeout: 45_000 });
  await stage.getByRole("button", { name: /opt-out/i }).click({ timeout: 3000 }).catch(() => {});
  // Larger type for 1080p; hide the support bubble.
  // Larger type in the 1080p frame when the page is laid out 1920 CSS px wide (headless).
  const zoom = (await stage.evaluate(() => innerWidth)) > 1700 ? 1.32 : 1;
  await stage.addStyleTag({ content: `body{zoom:${zoom}} [class*='intercom'],[id*='intercom']{display:none!important}` });
  await stage.evaluate(() => window.scrollTo(0, 0));
  await stage.waitForTimeout(800);

  const total = clip("IV.1").target;
  mark("IV.1:in");
  const feePayer = await tagRow(stage, ["Fee payer", DEVICE], "fee");
  await overlay.spotlight(stage, feePayer);
  await overlay.caption(stage, "Podpisał klucz urządzenia – agent obecności");
  await stage.waitForTimeout((total / 2) * 1000);

  const bRow = await tagRow(stage, [beneficiary, "+◎"], "b");
  await bRow.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await stage.waitForTimeout(900);
  await overlay.caption(stage, "Całe saldo trafiło do zastępcy – i tylko do niego");
  await overlay.spotlight(stage, bRow);
  await stage.waitForTimeout((total / 2) * 1000);
  mark("IV.1:out");
  await overlay.clear(stage);

  // IV.2 – the rule in code
  await slide("IV.2");
};
