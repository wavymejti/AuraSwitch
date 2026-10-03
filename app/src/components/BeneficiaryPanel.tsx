import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { parseSol } from "../lib/format";
import { payeeName } from "../lib/payees";
import { isActive, sameKey, type CareProgram, type CareVault } from "../lib/program";
import { secondsLeft } from "./StatusPanel";

interface Props {
  program: CareProgram;
  wallet: PublicKey | null;
  vault: CareVault;
  pda: PublicKey;
  now: number;
  busy: boolean;
  run: (label: string, fn: () => Promise<string>) => Promise<string | null>;
}

const OTHER = "__other__";

export const BeneficiaryPanel = ({ program, wallet, vault, pda, now, busy, run }: Props) => {
  const [recipient, setRecipient] = useState(vault.allowlist[0]?.toBase58() ?? "");
  const [other, setOther] = useState("");
  const [amount, setAmount] = useState("0,5");
  const active = isActive(vault);
  const expired = secondsLeft(vault, now) <= 0;
  const isBeneficiary = sameKey(wallet, vault.beneficiary);
  const payAmount = parseSol(amount);
  const target = recipient === OTHER ? other.trim() : recipient;

  // The UI deliberately doesn't filter recipients – the program does.
  const pay = () => {
    const label =
      recipient === OTHER
        ? "Płatność → inny adres"
        : `Płatność → ${payeeName(new PublicKey(recipient))}`;
    return run(label, async () =>
      program.methods
        .pay(payAmount!)
        .accountsPartial({
          beneficiary: wallet!,
          vault: pda,
          recipient: new PublicKey(target),
        })
        .rpc(),
    );
  };

  return (
    <section className="card">
      <h2>Opiekun zastępczy</h2>

      <button
        className="danger"
        disabled={!wallet || !active || !expired || busy}
        onClick={() =>
          run("Aktywacja przejęcia", () =>
            program.methods
              .activateTakeover()
              .accountsPartial({ caller: wallet!, vault: pda })
              .rpc(),
          )
        }
      >
        Aktywuj przejęcie
      </button>
      <p className="hint">Może to zrobić każdy – decyduje wyłącznie zegar.</p>

      <h3>Zapłać placówce</h3>
      {!isBeneficiary && wallet && (
        <p className="hint">Połączony portfel nie jest opiekunem zastępczym.</p>
      )}
      <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
        {vault.allowlist.map((k) => (
          <option key={k.toBase58()} value={k.toBase58()}>
            {payeeName(k)}
          </option>
        ))}
        <option value={OTHER}>Inny adres…</option>
      </select>
      {recipient === OTHER && (
        <div className="row">
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Adres odbiorcy"
            spellCheck={false}
          />
          {wallet && (
            <button className="link" onClick={() => setOther(wallet.toBase58())}>
              mój portfel
            </button>
          )}
        </div>
      )}
      <div className="row">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Kwota płatności w SOL"
        />
        <button
          className="primary"
          disabled={!wallet || !payAmount || !target || busy || active}
          onClick={pay}
        >
          Zapłać
        </button>
      </div>
    </section>
  );
};
