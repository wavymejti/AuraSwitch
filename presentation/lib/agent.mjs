// Presence agent status (presence/agent.ts → http://localhost:4747/status).
const URL_ = process.env.AGENT_URL ?? "http://localhost:4747/status";

export const agent = {
  async status() {
    const res = await fetch(URL_, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`agent ${res.status}`);
    return res.json();
  },
  /** Polls until `pred(status)` is truthy; returns that status. */
  async waitFor(pred, timeout = 30_000, label = "agent condition") {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
      try {
        last = await this.status();
        if (pred(last)) return last;
      } catch {
        /* agent briefly unavailable – keep polling */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(`Timeout (${timeout} ms) waiting for ${label}. Last status: ${JSON.stringify(last)}`);
  },
};
