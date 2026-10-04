import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "./lib/config";
import { Heartbeat } from "./pages/Heartbeat";
import { Landing } from "./pages/Landing";
import { Main } from "./pages/Main";
import { Show } from "./pages/Show";

/** Tiny path router: / landing · /app fund · /pokaz presentation · /heartbeat device button. */
const route = () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  // Old share links were /?owner=…&id=… – keep them working.
  if (path === "/" && new URLSearchParams(window.location.search).has("owner")) return "app";
  if (path.endsWith("/heartbeat")) return "heartbeat";
  if (path.endsWith("/pokaz")) return "show";
  if (path.endsWith("/app")) return "app";
  return "landing";
};

export const App = () => {
  // Phantom and other modern wallets register themselves via Wallet Standard.
  const wallets = useMemo(() => [], []);
  const page = route();

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {page === "landing" && <Landing />}
          {page === "app" && <Main />}
          {page === "show" && <Show />}
          {page === "heartbeat" && <Heartbeat />}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
