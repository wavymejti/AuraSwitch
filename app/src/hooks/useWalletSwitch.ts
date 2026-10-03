import { useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface AccountEvents {
  on?: (event: "accountChanged", cb: (key: unknown) => void) => void;
  removeListener?: (event: "accountChanged", cb: (key: unknown) => void) => void;
}

/**
 * Reconnects so the page uses the account that is active in the wallet right now.
 * After `disconnect` the adapter forgets the wallet; selecting it again makes
 * `autoConnect` connect with whichever account the wallet currently has open.
 */
export const useSwitchAccount = () => {
  const { wallet, disconnect, select } = useWallet();
  const name = wallet?.adapter.name;
  return useCallback(async () => {
    if (!name) return;
    await disconnect().catch(() => {});
    select(name);
  }, [name, disconnect, select]);
};

/**
 * Phantom signs only for its active account, but switching accounts in the
 * extension doesn't always update the page – signing then fails with
 * "Unexpected error". Follow the switch automatically.
 */
export const useFollowWalletAccount = () => {
  const { publicKey } = useWallet();
  const switchAccount = useSwitchAccount();

  useEffect(() => {
    const provider = (window as { phantom?: { solana?: AccountEvents } }).phantom?.solana;
    if (!provider?.on) return;
    const onChange = (next: unknown) => {
      const nextKey = (next as { toBase58?: () => string } | null)?.toBase58?.();
      if (nextKey && nextKey === publicKey?.toBase58()) return;
      switchAccount();
    };
    provider.on("accountChanged", onChange);
    return () => provider.removeListener?.("accountChanged", onChange);
  }, [publicKey?.toBase58(), switchAccount]);
};
