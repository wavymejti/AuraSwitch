import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { POLL_MS } from "../lib/config";
import type { CareProgram, CareVault } from "../lib/program";

export interface VaultState {
  vault: CareVault | null;
  lamports: number;
  rentMin: number;
  loaded: boolean;
}

const EMPTY: VaultState = { vault: null, lamports: 0, rentMin: 0, loaded: false };

/**
 * Polls the CareVault account every POLL_MS with a single RPC call
 * (public devnet rate-limits per IP). Pauses while the tab is hidden.
 */
export const useVault = (program: CareProgram, pda: PublicKey | null) => {
  const [state, setState] = useState<VaultState>(EMPTY);
  const rentCache = useRef<Map<number, number>>(new Map());

  const refresh = useCallback(async () => {
    if (!pda) return;
    const connection = program.provider.connection;
    try {
      const info = await connection.getAccountInfo(pda, "confirmed");
      if (!info) {
        setState({ ...EMPTY, loaded: true });
        return;
      }
      const size = info.data.length;
      let rentMin = rentCache.current.get(size);
      if (rentMin === undefined) {
        rentMin = await connection.getMinimumBalanceForRentExemption(size);
        rentCache.current.set(size, rentMin);
      }
      const vault = program.coder.accounts.decode<CareVault>("careVault", info.data);
      setState({ vault, lamports: info.lamports, rentMin, loaded: true });
    } catch (err) {
      // keep last known state on transient RPC errors (e.g. 429)
      console.warn("vault poll failed", err);
    }
  }, [program, pda?.toBase58()]);

  useEffect(() => {
    setState(EMPTY);
    if (!pda) return;
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { ...state, refresh };
};
