import { useState } from "react";
import { BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { DEFAULT_PAYEES, HEARTBEAT_KEYPAIR, type Payee } from "../lib/config";
import { findVaultPda } from "../lib/pda";
import type { CareProgram } from "../lib/program";
import type { Selection } from "../hooks/useSelection";

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
  const [heartbeat, setHeartbeat] = useState(
    HEARTBEAT_KEYPAIR?.publicKey.toBase58() ?? "",
  );
  const [timeout, setTimeoutSecs] = useState("30");
  const [payees, setPayees] = useState<Payee[]>(DEFAULT_PAYEES);

  const beneficiaryKey = parseKey(beneficiary);
  const heartbeatKey = parseKey(heartbeat);
  const payeeKeys = payees
    .filter((p) => p.address.trim())
    .map((p) => parseKey(p.address));
  const timeoutNum = Number(timeout);
  const valid =
    !!beneficiaryKey &&
    !!heartbeatKey &&
    Number.isInteger(timeoutNum) &&
    timeoutNum > 0 &&
    payeeKeys.length > 0 &&
    payeeKeys.every(Boolean);

  const submit = async () => {
    if (!valid) return;
    const vaultId = new BN(Date.now());
    const vault = findVaultPda(owner, vaultId);
    const sig = await run("Założenie funduszu", () =>
      program.methods
        .initialize(
          vaultId,
          beneficiaryKey!,
          heartbeatKey!,
          new BN(timeoutNum),
          payeeKeys as PublicKey[],
        )
        .accountsPartial({
          owner,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
    );
    if (sig) onCreated({ owner, vaultId: vaultId.toString() });
  };

  const setPayee = (i: number, patch: Partial<Payee>) =>
    setPayees((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="stack">
      <label>
        Opiekun zastępczy (adres portfela)
        <input
          value={beneficiary}
          onChange={(e) => setBeneficiary(e.target.value)}
          placeholder="np. 7xKX…"
          spellCheck={false}
        />
      </label>
      <label>
        Czas bez sygnału „Jestem” (sekundy)
        <input
          type="number"
          min={1}
          value={timeout}
          onChange={(e) => setTimeoutSecs(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Zatwierdzone placówki (maks. 3)</legend>
        {payees.map((p, i) => (
          <div className="payee-row" key={i}>
            <input
              value={p.name}
              onChange={(e) => setPayee(i, { name: e.target.value })}
              placeholder="Nazwa"
            />
            <input
              value={p.address}
              onChange={(e) => setPayee(i, { address: e.target.value })}
              placeholder="Adres"
              spellCheck={false}
            />
          </div>
        ))}
        {payees.length < 3 && (
          <button
            className="link"
            onClick={() => setPayees([...payees, { name: "", address: "" }])}
          >
            + dodaj placówkę
          </button>
        )}
      </fieldset>
      <details>
        <summary>Klucz urządzenia „Jestem”</summary>
        <input
          value={heartbeat}
          onChange={(e) => setHeartbeat(e.target.value)}
          spellCheck={false}
        />
        <p className="hint">
          Ten klucz może tylko potwierdzać obecność – nie ma dostępu do środków.
        </p>
      </details>
      <button className="primary" disabled={!valid || busy} onClick={submit}>
        Załóż fundusz
      </button>
    </div>
  );
};
