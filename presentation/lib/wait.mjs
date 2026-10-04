/** Waits until a locator's text stays unchanged for `stableMs` (e.g. the substitute's balance after its count-up). */
export const waitStableText = async (locator, stableMs = 2000, timeout = 30_000) => {
  const end = Date.now() + timeout;
  let last = await locator.innerText();
  let since = Date.now();
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 200));
    const now = await locator.innerText();
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= stableMs) {
      return now;
    }
  }
  throw new Error(`Text did not settle within ${timeout} ms (last: ${last})`);
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
