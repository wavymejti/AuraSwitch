import { useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { TxLog } from "../components/TxLog";
import { secondsLeft } from "../components/StatusPanel";
import { useNow } from "../hooks/useNow";
import { OFFSET, useSelection } from "../hooks/useSelection";
import { useTxLog } from "../hooks/useTxLog";
import { useVault } from "../hooks/useVault";
import { HEARTBEAT_KEYPAIR } from "../lib/config";
import { formatCountdown } from "../lib/format";
import { findVaultPda } from "../lib/pda";
import { isActive, keypairWallet, makeProgram } from "../lib/program";

/**
 * Stand-in for the ESP32 button: one big "Jestem" signed by the device key.
 * The key can only ping – it can't move funds.
 */
export const Heartbeat = () => {
  const { connection } = useConnection();
  const program = useMemo(
    () => (HEARTBEAT_KEYPAIR ? makeProgram(connection, keypairWallet(HEARTBEAT_KEYPAIR)) : null),
    [connection],
  );

  if (!program || !HEARTBEAT_KEYPAIR) {
    return (
      <div className="page heartbeat">
        <p className="hint">
          Brak klucza urządzenia – ustaw <code>VITE_HEARTBEAT_SECRET</code> w <code>.env.local</code>.
        </p>
      </div>
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

  const ping = () =>
    run("Jestem (urządzenie)", () =>
      program.methods.ping().accountsPartial({ signer: device, vault: pda! }).rpc(),
    );

  return (
    <div className="page heartbeat">
      {!vault ? (
        <p className="hint">Szukam funduszu powiązanego z tym urządzeniem…</p>
      ) : (
        <>
          <p className={`badge ${isActive(vault) ? "ok" : "warn"}`}>
            {isActive(vault) ? "Aktywny" : "Przejęty"}
          </p>
          {isActive(vault) && (
            <div className="countdown">{formatCountdown(secondsLeft(vault, now))}</div>
          )}
          <button
            className="big heartbeat-btn"
            disabled={!!busy || !isActive(vault)}
            onClick={ping}
          >
            Jestem
          </button>
          {!isActive(vault) && (
            <p className="hint">
              Po przejęciu urządzenie nie może przywrócić funduszu – zrobi to tylko
              opiekun główny ze swojego portfela.
            </p>
          )}
        </>
      )}
      <TxLog entries={entries} />
    </div>
  );
};
