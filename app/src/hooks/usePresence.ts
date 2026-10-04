import { useEffect, useState } from "react";
import { PRESENCE_URL } from "../lib/config";

export interface PresenceStatus {
  device: string;
  phone: {
    name: string;
    present: boolean;
    rssi: number | null;
    rssiMin: number;
    lastSeenSecsAgo: number | null;
    presentForSecs: number | null;
    absentForSecs: number | null;
  };
  vault: { address: string; id: string; active: boolean; released: boolean } | null;
  lastPing: { secsAgo: number; sig: string } | null;
  lastRelease: { secsAgo: number; sig: string } | null;
}

/** Status of the local presence agent (presence/agent.ts); null when it isn't running. */
export const usePresence = () => {
  const [status, setStatus] = useState<PresenceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(PRESENCE_URL, { cache: "no-store" });
        const next = res.ok ? ((await res.json()) as PresenceStatus) : null;
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return status;
};
