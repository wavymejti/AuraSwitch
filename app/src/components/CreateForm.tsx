import { useState } from "react";
import { BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Sparkles } from "lucide-react";
import { HEARTBEAT_KEYPAIR } from "../lib/config";
import { findVaultPda } from "../lib/pda";
import type { CareProgram } from "../lib/program";
import type { Selection } from "../hooks/useSelection";
import { Button } from "./ui/Button";

interface Props {
  program: CareProgram;
  owner: PublicKey;
  busy: boolean;
  run: (label: string, fn: () => Promise<string>) => Promise<string | null>;
  onCreated: (s: Selection) => void;
}

const parseKey = (s: string) => {
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
};

export const CreateForm = ({ program, owner, busy, run, onCreated }: Props) => {
  const [beneficiary, setBeneficiary] = useState("");
  const [heartbeat, setHeartbeat] = useState(HEARTBEAT_KEYPAIR?.publicKey.toBase58() ?? "");
  const [timeout, setTimeoutSecs] = useState("40");

  const beneficiaryKey = parseKey(beneficiary);
  const heartbeatKey = parseKey(heartbeat);
  const timeoutNum = Number(timeout);
  const valid =
    !!beneficiaryKey &&
    !!heartbeatKey &&
    Number.isInteger(timeoutNum) &&
    timeoutNum > 0 &&
    !beneficiaryKey.equals(owner);

  const submit = async () => {
    if (!valid) return;
    const vaultId = new BN(Date.now());
    const vault = findVaultPda(owner, vaultId);
    const sig = await run("Założenie funduszu", () =>
      program.methods
        .initialize(vaultId, beneficiaryKey!, heartbeatKey!, new BN(timeoutNum))
        .accountsPartial({ owner, vault, systemProgram: SystemProgram.programId })
        .rpc(),
    );
    if (sig) onCreated({ owner, vaultId: vaultId.toString() });
  };

  return (
    <section className="glass create-card">
      <span className="eyebrow">
        <Sparkles size={14} /> Nowy fundusz
      </span>
      <h2>Stwórz aurę dla bliskiej osoby</h2>
      <p className="muted" style={{ margin: "0 0 24px" }}>
        Wskaż, kto przejmie opiekę, i po jakim czasie bez sygnału „Jestem” ma do niego trafić fundusz.
      </p>
      <div className="stack">
        <label className="field">
          Opiekun zastępczy – adres portfela, który otrzyma środki
          <input
            className="input"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="np. CfUq…YUcZ"
            spellCheck={false}
          />
        </label>
        {beneficiaryKey?.equals(owner) && <p className="hint">Zastępca musi być inną osobą niż opiekun główny.</p>}
        <label className="field">
          Czas bez „Jestem”, po którym fundusz przejdzie na zastępcę
          <div className="input-group">
            <input
              className="input"
              type="number"
              min={1}
              value={timeout}
              onChange={(e) => setTimeoutSecs(e.target.value)}
            />
            <span className="input-suffix">sekund</span>
          </div>
        </label>
        <details className="advanced">
          <summary>Klucz urządzenia „Jestem” (zaawansowane)</summary>
          <input
            className="input"
            value={heartbeat}
            onChange={(e) => setHeartbeat(e.target.value)}
            spellCheck={false}
          />
          <p className="hint">
            Ten klucz może tylko potwierdzać obecność i – po czasie – wysłać fundusz do zastępcy. Nie ma dostępu do
            środków.
          </p>
        </details>
        <Button variant="primary" size="lg" block disabled={!valid || busy} onClick={submit}>
          <Sparkles size={18} /> Załóż fundusz
        </Button>
      </div>
    </section>
  );
};
