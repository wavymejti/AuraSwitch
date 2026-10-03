import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BeneficiaryPanel } from "../components/BeneficiaryPanel";
import { CreateForm } from "../components/CreateForm";
import { OwnerPanel } from "../components/OwnerPanel";
import { StatusPanel } from "../components/StatusPanel";
import { TxLog } from "../components/TxLog";
import { useNow } from "../hooks/useNow";
import { useFollowWalletAccount, useSwitchAccount } from "../hooks/useWalletSwitch";
import { useSelection } from "../hooks/useSelection";
import { useTxLog } from "../hooks/useTxLog";
import { useVault } from "../hooks/useVault";
import { findVaultPda } from "../lib/pda";
import { makeProgram, readOnlyWallet, sameKey } from "../lib/program";

const fallbackWallet = readOnlyWallet();

export const Main = () => {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const wallet = anchorWallet?.publicKey ?? null;
  const program = useMemo(
    () => makeProgram(connection, anchorWallet ?? fallbackWallet),
    [connection, anchorWallet],
  );

  const { selection, setSelection, searching } = useSelection(program, wallet);
  const pda = useMemo(
    () => (selection ? findVaultPda(selection.owner, selection.vaultId) : null),
    [selection?.owner.toBase58(), selection?.vaultId],
  );
  const { vault, lamports, rentMin, loaded, refresh } = useVault(program, pda);
  const { entries, busy, run } = useTxLog(refresh);
  const now = useNow();
  useFollowWalletAccount();
  const switchAccount = useSwitchAccount();

  const role = !vault || !wallet
    ? null
    : sameKey(wallet, vault.owner)
      ? "Opiekun główny"
      : sameKey(wallet, vault.beneficiary)
        ? "Opiekun zastępczy"
        : "Obserwator";

  const shareLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  };

  return (
    <div className="page">
      <header>
        <div>
          <h1>CareSwitch</h1>
          <p className="tagline">Fundusz na leczenie, który nie potrzebuje pełnomocnika.</p>
        </div>
        <div className="wallet">
          {role && <span className="role">{role}</span>}
          {wallet && (
            <button className="link" onClick={switchAccount} title="Połącz konto wybrane teraz w Phantomie">
              zmień konto
            </button>
          )}
          <WalletMultiButton />
        </div>
      </header>

      {selection && (
        <nav className="vault-bar">
          <span>
            Fundusz nr <strong>{selection.vaultId}</strong>
          </span>
          <button className="link" onClick={shareLink}>
            kopiuj link
          </button>
          <button className="link" onClick={() => setSelection(null)}>
            nowy fundusz
          </button>
        </nav>
      )}

      {!selection && (
        <section className="card">
          <h2>Załóż fundusz</h2>
          {!wallet ? (
            <p className="hint">Połącz portfel, aby założyć fundusz lub zobaczyć swój.</p>
          ) : searching ? (
            <p className="hint">Szukam Twojego funduszu…</p>
          ) : (
            <CreateForm
              program={program}
              owner={wallet}
              busy={!!busy}
              run={run}
              onCreated={setSelection}
            />
          )}
        </section>
      )}

      {selection && pda && !vault && (
        <section className="card">
          <p className="hint">
            {loaded ? "Nie znaleziono funduszu o tym numerze." : "Wczytywanie…"}
          </p>
        </section>
      )}

      {vault && pda && (
        <>
          <StatusPanel vault={vault} pda={pda} lamports={lamports} rentMin={rentMin} now={now} />
          <div className="columns">
            <OwnerPanel
              program={program}
              wallet={wallet}
              vault={vault}
              pda={pda}
              busy={!!busy}
              run={run}
            />
            <BeneficiaryPanel
              key={pda.toBase58()}
              program={program}
              wallet={wallet}
              vault={vault}
              pda={pda}
              now={now}
              busy={!!busy}
              run={run}
            />
          </div>
        </>
      )}

      {busy && <div className="busy">Wysyłanie: {busy}…</div>}
      <TxLog entries={entries} />

      <footer>
        Sieć testowa Solana (devnet). Reguły funduszu egzekwuje program on-chain –
        ta strona tylko wysyła polecenia.
      </footer>
    </div>
  );
};
