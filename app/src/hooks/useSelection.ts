import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { CareProgram } from "../lib/program";

export interface Selection {
  owner: PublicKey;
  vaultId: string;
}

// Byte offsets of pubkey fields in CareVault (after the 8-byte discriminator).
export const OFFSET = { owner: 8, beneficiary: 40, heartbeatKey: 72 } as const;

const fromUrl = (): Selection | null => {
  const p = new URLSearchParams(window.location.search);
  const owner = p.get("owner");
  const id = p.get("id");
  if (!owner || !id || !/^\d+$/.test(id)) return null;
  try {
    return { owner: new PublicKey(owner), vaultId: id };
  } catch {
    return null;
  }
};

const toUrl = (s: Selection | null) => {
  const url = new URL(window.location.href);
  if (s) {
    url.searchParams.set("owner", s.owner.toBase58());
    url.searchParams.set("id", s.vaultId);
  } else {
    url.searchParams.delete("owner");
    url.searchParams.delete("id");
  }
  window.history.replaceState(null, "", url);
};

/** Newest vault (highest vault_id) where `key` sits at one of the given offsets. */
export const discoverVault = async (
  program: CareProgram,
  key: PublicKey,
  offsets: number[],
): Promise<Selection | null> => {
  const results = await Promise.all(
    offsets.map((offset) =>
      program.account.careVault.all([
        { memcmp: { offset, bytes: key.toBase58() } },
      ]),
    ),
  );
  const newest = results
    .flat()
    .sort((a, b) => b.account.vaultId.cmp(a.account.vaultId))[0];
  return newest
    ? { owner: newest.account.owner, vaultId: newest.account.vaultId.toString() }
    : null;
};

/**
 * Which fund is on screen: taken from ?owner=&id= in the URL, otherwise
 * auto-discovered for the connected wallet (as owner or as substitute).
 */
export const useSelection = (
  program: CareProgram,
  wallet: PublicKey | null,
  offsets: number[] = [OFFSET.owner, OFFSET.beneficiary],
) => {
  const [selection, setSelectionState] = useState<Selection | null>(fromUrl);
  const [searching, setSearching] = useState(false);
  // After the user explicitly clears the selection ("new fund"), stop auto-picking.
  const [autoDiscover, setAutoDiscover] = useState(true);

  const setSelection = useCallback((s: Selection | null) => {
    toUrl(s);
    if (!s) setAutoDiscover(false);
    setSelectionState(s);
  }, []);

  useEffect(() => {
    if (selection || !wallet || !autoDiscover) return;
    let cancelled = false;
    setSearching(true);
    discoverVault(program, wallet, offsets)
      .then((found) => {
        if (cancelled || !found) return;
        toUrl(found);
        setSelectionState(found);
      })
      .catch(() => {})
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [program, wallet?.toBase58(), selection, autoDiscover]);

  return { selection, setSelection, searching };
};
