import { useCallback, useState } from "react";
import { humanError } from "../lib/errors";

export interface LogEntry {
  id: number;
  at: Date;
  label: string;
  ok: boolean;
  sig?: string;
  message?: string;
  detail?: string;
}

let nextId = 1;

/**
 * Keeps a list of transaction outcomes. `run` wraps a transaction call:
 * it records the signature on success or a human-readable error on failure.
 */
export const useTxLog = (onDone?: () => void) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const add = (e: Omit<LogEntry, "id" | "at">) =>
    setEntries((prev) => [{ ...e, id: nextId++, at: new Date() }, ...prev].slice(0, 30));

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(label);
      try {
        const sig = await fn();
        add({ label, ok: true, sig });
        return sig;
      } catch (err) {
        console.error(label, err);
        const { message, detail } = humanError(err);
        add({ label, ok: false, message, detail });
        return null;
      } finally {
        setBusy(null);
        onDone?.();
      }
    },
    [onDone],
  );

  return { entries, busy, run };
};
