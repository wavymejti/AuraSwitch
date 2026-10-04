import { useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { motion } from "motion/react";
import { HeartPulse } from "lucide-react";
import { AuraOrb } from "../components/AuraOrb";
import { orbView } from "../components/StatusPanel";
import { TxLog } from "../components/TxLog";
import { Logo } from "../components/ui/Logo";
import { TopoBackground } from "../components/ui/TopoBackground";
import { useNow } from "../hooks/useNow";
import { OFFSET, useSelection } from "../hooks/useSelection";
import { useTxLog } from "../hooks/useTxLog";
import { useVault } from "../hooks/useVault";
import { HEARTBEAT_KEYPAIR } from "../lib/config";
import { findVaultPda } from "../lib/pda";
import { isActive, keypairWallet, makeProgram } from "../lib/program";

/**
 * Stand-in for the bedside device: one big "Jestem" signed by the device key.
 * The key can only ping (and, after the timeout, send the release to B).
 */
export const Heartbeat = () => {
  const { connection } = useConnection();
  const program = useMemo(
    () => (HEARTBEAT_KEYPAIR ? makeProgram(connection, keypairWallet(HEARTBEAT_KEYPAIR)) : null),
    [connection],
  );

  if (!program || !HEARTBEAT_KEYPAIR) {
    return (
      <>
        <TopoBackground />
        <div className="shell device">
          <Logo />
          <p className="muted">
            Brak klucza urządzenia – ustaw <code>VITE_HEARTBEAT_SECRET</code> w <code>.env.local</code>.
          </p>
        </div>
      </>
    );
  }
  return <HeartbeatInner program={program} />;
};

const HeartbeatInner = ({ program }: { program: NonNullable<ReturnType<typeof makeProgram>> }) => {
  const device = HEARTBEAT_KEYPAIR!.publicKey;
  const { selection } = useSelection(program, device, [OFFSET.heartbeatKey]);
  const pda = useMemo(
    () => (selection ? findVaultPda(selection.owner, selection.vaultId) : null),
    [selection?.owner.toBase58(), selection?.vaultId],
  );
  const { vault, refresh } = useVault(program, pda);
  const { entries, busy, run } = useTxLog(refresh);
  const now = useNow();
  const view = vault ? orbView(vault, now) : null;

  const ping = () =>
    run("Jestem (urządzenie)", () => program.methods.ping().accountsPartial({ signer: device, vault: pda! }).rpc());

  return (
    <>
      <TopoBackground />
      <div className="shell device">
        <Logo />
        {!vault || !view ? (
          <p className="muted">Szukam funduszu powiązanego z tym urządzeniem…</p>
        ) : (
          <>
            <AuraOrb
              size={240}
              progress={view.progress}
              time={view.time}
              sub={view.sub}
              state={view.state}
              pulseKey={vault.lastHeartbeat.toString()}
            />
            <motion.button
              className="btn-heartbeat"
              disabled={!!busy || !isActive(vault)}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 20 }}
              onClick={ping}
            >
              <HeartPulse size={40} /> Jestem
            </motion.button>
            <p className="muted" style={{ maxWidth: 380, margin: 0 }}>
              {isActive(vault)
                ? "Przycisk przy łóżku. Ten klucz umie tylko potwierdzić obecność – nie ruszy pieniędzy."
                : "Fundusz jest już u zastępcy. Urządzenie nie może go przywrócić – zrobi to tylko opiekun główny ze swojego portfela."}
            </p>
          </>
        )}
        <div style={{ width: "min(420px, 100%)" }}>
          <TxLog entries={entries} />
        </div>
      </div>
    </>
  );
};
