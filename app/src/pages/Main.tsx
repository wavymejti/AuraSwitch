import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Plus, Presentation, RefreshCw } from "lucide-react";
import { CreateForm } from "../components/CreateForm";
import { OwnerPanel } from "../components/OwnerPanel";
import { ReleaseCelebration } from "../components/ReleaseCelebration";
import { ReleasePanel } from "../components/ReleasePanel";
import { StatusPanel } from "../components/StatusPanel";
import { TxLog } from "../components/TxLog";
import { Button, ButtonLink } from "../components/ui/Button";
import { Logo, LogoMark } from "../components/ui/Logo";
import { TopoBackground } from "../components/ui/TopoBackground";
import { useNow } from "../hooks/useNow";
import { usePresence } from "../hooks/usePresence";
import { useReleaseEvent } from "../hooks/useReleaseEvent";
import { useSelection } from "../hooks/useSelection";
import { useTxLog } from "../hooks/useTxLog";
import { useVault } from "../hooks/useVault";
import { useFollowWalletAccount, useSwitchAccount } from "../hooks/useWalletSwitch";
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
  const presence = usePresence();
  const switchAccount = useSwitchAccount();
  const release = useReleaseEvent(pda?.toBase58() ?? null, vault, lamports, rentMin);
  const [copied, setCopied] = useState(false);

  const role = !vault || !wallet
    ? null
    : sameKey(wallet, vault.owner)
      ? "Opiekun główny"
      : sameKey(wallet, vault.beneficiary)
        ? "Opiekun zastępczy"
        : "Obserwator";

  const shareLink = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  const showHref = selection ? `/pokaz?owner=${selection.owner.toBase58()}&id=${selection.vaultId}` : "/pokaz";

  return (
    <>
      <TopoBackground intensity={0.75} />
      <div className="shell">
        <header className="topbar">
          <div className="container topbar-inner">
            <Logo />
            <nav className="topbar-nav">
              <ButtonLink variant="ghost" href={showHref} target="_blank" rel="noreferrer" className="hide-sm">
                <Presentation size={16} /> Tryb pokazu
              </ButtonLink>
              {role && <span className="chip hide-sm">{role}</span>}
              {wallet && (
                <Button variant="ghost" size="sm" onClick={switchAccount} title="Połącz konto wybrane teraz w Phantomie">
                  <RefreshCw size={14} /> zmień konto
                </Button>
              )}
              <WalletMultiButton />
            </nav>
          </div>
        </header>

        <main className="container app-main">
          {!selection && !wallet && (
            <motion.section
              className="glass empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <LogoMark size={72} />
              <h2>Połącz portfel</h2>
              <p className="muted" style={{ margin: "0 0 24px" }}>
                Połącz Phantom (sieć Devnet), aby założyć fundusz albo zobaczyć swój – jako opiekun główny lub
                zastępca.
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <WalletMultiButton />
              </div>
            </motion.section>
          )}

          {!selection && wallet && searching && (
            <section className="glass empty-state">
              <div className="spinner" style={{ margin: "0 auto", width: 28, height: 28 }} />
              <h2>Szukam Twojego funduszu…</h2>
            </section>
          )}

          {!selection && wallet && !searching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <CreateForm program={program} owner={wallet} busy={!!busy} run={run} onCreated={setSelection} />
            </motion.div>
          )}

          {selection && (
            <div className="vault-bar">
              <div className="vault-id">
                <strong>Fundusz nr {selection.vaultId}</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" onClick={shareLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "skopiowano" : "kopiuj link"}
                </Button>
                <Button size="sm" onClick={() => setSelection(null)}>
                  <Plus size={14} /> nowy fundusz
                </Button>
              </div>
            </div>
          )}

          {selection && pda && !vault && (
            <section className="glass empty-state">
              {loaded ? (
                <h2>Nie znaleziono funduszu o tym numerze</h2>
              ) : (
                <>
                  <div className="spinner" style={{ margin: "0 auto", width: 28, height: 28 }} />
                  <h2>Wczytywanie…</h2>
                </>
              )}
            </section>
          )}

          {vault && pda && (
            <motion.div
              className="app-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <StatusPanel
                vault={vault}
                pda={pda}
                lamports={lamports}
                rentMin={rentMin}
                now={now}
                presence={presence}
              />
              <div className="app-side">
                <OwnerPanel program={program} wallet={wallet} vault={vault} pda={pda} busy={!!busy} run={run} />
                <ReleasePanel
                  key={pda.toBase58()}
                  program={program}
                  wallet={wallet}
                  vault={vault}
                  pda={pda}
                  now={now}
                  busy={!!busy}
                  run={run}
                />
                <TxLog entries={entries} />
              </div>
            </motion.div>
          )}

          {!vault && entries.length > 0 && (
            <div style={{ maxWidth: 620, margin: "20px auto 0" }}>
              <TxLog entries={entries} />
            </div>
          )}

          <p className="footer-note">
            Sieć testowa Solana (devnet). Reguły funduszu egzekwuje program on-chain – ta strona tylko wysyła polecenia.
          </p>
        </main>
      </div>

      <AnimatePresence>
        {busy && (
          <motion.div
            className="busy-toast"
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
          >
            <span className="spinner" /> {busy}… zatwierdź w Phantomie
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {release.event && <ReleaseCelebration event={release.event} onClose={release.clear} />}
      </AnimatePresence>
    </>
  );
};
