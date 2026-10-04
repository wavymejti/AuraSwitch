import { useEffect, useRef, useState } from "react";
import type { CareVault } from "../lib/program";
import { statusOf } from "../lib/program";

export interface ReleaseEvent {
  amount: number; // lamports that went to B
  beneficiary: string;
  at: number;
}

/**
 * Fires once when a vault we've been watching flips from active to released,
 * with the balance it held right before – that's what the beneficiary received.
 */
export const useReleaseEvent = (
  key: string | null,
  vault: CareVault | null,
  lamports: number,
  rentMin: number,
) => {
  const [event, setEvent] = useState<ReleaseEvent | null>(null);
  const prev = useRef<{ key: string | null; status?: string; available: number }>({ key: null, available: 0 });

  useEffect(() => {
    if (prev.current.key !== key) {
      prev.current = { key, status: vault ? statusOf(vault) : undefined, available: Math.max(0, lamports - rentMin) };
      return;
    }
    if (!vault) return;
    const status = statusOf(vault);
    if (prev.current.status === "active" && status === "released") {
      setEvent({ amount: prev.current.available, beneficiary: vault.beneficiary.toBase58(), at: Date.now() });
    }
    prev.current = {
      key,
      status,
      available: status === "active" ? Math.max(0, lamports - rentMin) : prev.current.available,
    };
  }, [key, vault, lamports, rentMin]);

  return { event, clear: () => setEvent(null) };
};
