// Overlays injected into the page DOM (also works inside the Phantom popup):
// badge, caption, spotlight, animated cursor. Everything is tagged data-overlay and
// attached to <html>, not <body>, so a CSS zoom on the page doesn't scale it twice.

const BRAND = { pink: "#FF9ECF", lavender: "#AB9FF2", ink: "#1B1430" };

export const overlay = {
  async badge(page, text) {
    await page.evaluate(({ text, BRAND }) => {
      document.querySelector('[data-overlay="badge"]')?.remove();
      const el = document.createElement("div");
      el.dataset.overlay = "badge";
      el.textContent = text;
      el.style.cssText = `position:fixed;top:28px;right:32px;z-index:2147483646;padding:12px 22px;border-radius:999px;
        background:${BRAND.lavender};color:${BRAND.ink};font:700 22px/1 Outfit,Inter,sans-serif;
        box-shadow:0 12px 40px -10px ${BRAND.lavender};opacity:0;transform:translateY(-8px);transition:all .35s ease`;
      document.documentElement.appendChild(el);
      requestAnimationFrame(() => Object.assign(el.style, { opacity: "1", transform: "none" }));
    }, { text, BRAND });
  },

  async caption(page, text) {
    await page.evaluate(({ text }) => {
      document.querySelector('[data-overlay="caption"]')?.remove();
      const el = document.createElement("div");
      el.dataset.overlay = "caption";
      el.textContent = text;
      el.style.cssText = `position:fixed;left:50%;bottom:48px;transform:translateX(-50%);z-index:2147483646;max-width:80%;
        padding:14px 26px;border-radius:18px;background:rgba(13,10,20,.82);color:#F4F1FF;text-align:center;
        font:600 28px/1.3 Outfit,Inter,sans-serif;backdrop-filter:blur(8px)`;
      document.documentElement.appendChild(el);
    }, { text });
  },

  /** Dims everything except the element, with a pink outline. */
  async spotlight(page, locator, { pad = 12 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box) return;
    await page.evaluate(({ box, pad, BRAND }) => {
      document.querySelector('[data-overlay="spotlight"]')?.remove();
      const el = document.createElement("div");
      el.dataset.overlay = "spotlight";
      el.style.cssText = `position:fixed;z-index:2147483645;pointer-events:none;border-radius:14px;
        left:${box.x - pad}px;top:${box.y - pad}px;width:${box.width + pad * 2}px;height:${box.height + pad * 2}px;
        box-shadow:0 0 0 3px ${BRAND.pink},0 0 0 9999px rgba(8,6,14,.62);transition:all .5s cubic-bezier(.16,1,.3,1)`;
      document.documentElement.appendChild(el);
    }, { box, pad, BRAND });
  },

  /** Moves an injected cursor to the element's centre (Playwright clicks don't move the system cursor). */
  async cursorTo(page, locator, { ms = 650 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box) return;
    await page.evaluate(({ x, y, ms }) => new Promise((resolve) => {
      let c = document.querySelector('[data-overlay="cursor"]');
      if (!c) {
        c = document.createElement("div");
        c.dataset.overlay = "cursor";
        c.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#fff" stroke="#1B1430" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
        c.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
          transform:translate(${innerWidth * 0.6}px,${innerHeight * 0.75}px);filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))`;
        document.documentElement.appendChild(c);
        c.getBoundingClientRect();
      }
      c.style.transition = `transform ${ms}ms cubic-bezier(.22,1,.36,1)`;
      c.style.transform = `translate(${x}px,${y}px)`;
      setTimeout(() => {
        const r = document.createElement("div");
        r.dataset.overlay = "ripple";
        r.style.cssText = `position:fixed;left:${x - 18}px;top:${y - 18}px;width:36px;height:36px;border-radius:50%;
          border:3px solid #FF9ECF;z-index:2147483646;pointer-events:none;transition:all .5s ease-out`;
        document.documentElement.appendChild(r);
        requestAnimationFrame(() => Object.assign(r.style, { transform: "scale(2)", opacity: "0" }));
        setTimeout(() => r.remove(), 600);
        resolve();
      }, ms);
    }), { x: box.x + box.width / 2, y: box.y + box.height / 2, ms });
  },

  async clear(page, which) {
    await page.evaluate((which) => {
      document.querySelectorAll(which ? `[data-overlay="${which}"]` : "[data-overlay]").forEach((el) => el.remove());
    }, which);
  },
};
