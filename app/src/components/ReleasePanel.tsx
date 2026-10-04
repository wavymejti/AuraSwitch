import type { PublicKey } from "@solana/web3.js";
import { CheckCircle2, ExternalLink, HandCoins } from "lucide-react";
import { explorerAddress } from "../lib/config";
import { shortKey } from "../lib/format";
import { sameKey, statusOf, type CareProgram, type CareVault } from "../lib/program";
import { secondsLeft } from "./StatusPanel";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

interface Props {
  program: CareProgram;
  wallet: PublicKey | null;
  vault: CareVault;
  pda: PublicKey;
  now: number;
  busy: boolean;
  run: (label: string, fn: () => Promise<string>) => Promise<string | null>;
}

/**
 * Substitute caregiver's side. At 0:00 the presence agent sends the release
 * automatically; the button is a fallback anyone can use if no agent is running.
 */
export const ReleasePanel = ({ program, wallet, vault, pda, now, busy, run }: Props) => {
  const status = statusOf(vault);
  const expired = secondsLeft(vault, now) <= 0;
  const isBeneficiary = sameKey(wallet, vault.beneficiary);
  const b = vault.beneficiary.toBase58();

  return (
    <section className="glass card" id="beneficiary-card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-icon">
            <HandCoins size={18} />
          </span>
          Opiekun zastępczy
        </div>
        {isBeneficiary && <span className="chip chip-ok">To Ty</span>}
      </div>

      <div className="who">
        <Avatar address={b} />
        <div className="who-text">
          <strong>Otrzyma cały fundusz</strong>
          <span>
            <a href={explorerAddress(b)} target="_blank" rel="noreferrer">
              {shortKey(b)} <ExternalLink size={11} />
            </a>
          </span>
        </div>
      </div>

      {status === "released" ? (
        <div className="note note-ok" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <CheckCircle2 size={18} style={{ flex: "none", marginTop: 1 }} />
          Środki z funduszu zostały przekazane na konto zastępcy.
        </div>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
            Przy 0:00 przekazanie wyśle automatycznie agent obecności. Jeśli nie działa, może to zrobić każdy:
          </p>
          <Button
            variant="danger"
            block
            disabled={!wallet || status !== "active" || !expired || busy}
            onClick={() =>
              run("Przekazanie środków zastępcy", () =>
                program.methods
                  .releaseToBeneficiary()
                  .accountsPartial({ caller: wallet!, vault: pda, beneficiary: vault.beneficiary })
                  .rpc(),
              )
            }
          >
            <HandCoins size={16} /> Przekaż środki zastępcy
          </Button>
          {!wallet && <p className="hint">Połącz dowolny portfel, aby wysłać przekazanie ręcznie.</p>}
        </>
      )}
    </section>
  );
};
