import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "./lib/config";
import { Heartbeat } from "./pages/Heartbeat";
import { Main } from "./pages/Main";

export const App = () => {
  // Phantom and other modern wallets register themselves via Wallet Standard.
  const wallets = useMemo(() => [], []);
  const isHeartbeat = window.location.pathname.replace(/\/$/, "").endsWith("/heartbeat");

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{isHeartbeat ? <Heartbeat /> : <Main />}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
