import { useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { parseSol } from "../lib/format";
import { isActive, sameKey, type CareProgram, type CareVault } from "../lib/program";

interface Props {
  program: CareProgram;
  wallet: PublicKey | null;
  vault: CareVault;
  pda: PublicKey;
  busy: boolean;
  run: (label: string, fn: () => Promise<string>) => Promise<string | null>;
}

export const OwnerPanel = ({ program, wallet, vault, pda, busy, run }: Props) => {
  const [deposit, setDeposit] = useState("2");
  const [withdraw, setWithdraw] = useState("");
  const isOwner = sameKey(wallet, vault.owner);
  const depositAmount = parseSol(deposit);
  const withdrawAmount = parseSol(withdraw);

  return (
    <section className="card">
      <h2>Opiekun główny</h2>
      {!isOwner && wallet && (
        <p className="hint">Połączony portfel nie jest opiekunem głównym.</p>
      )}

      <button
        className="big"
        disabled={!wallet || busy}
        onClick={() =>
          run("Jestem", () =>
            program.methods.ping().accountsPartial({ signer: wallet!, vault: pda }).rpc(),
          )
        }
      >
        Jestem
      </button>

      <div className="row">
        <input
          inputMode="decimal"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          aria-label="Kwota wpłaty w SOL"
        />
        <button
          disabled={!wallet || !depositAmount || busy}
          onClick={() =>
            run("Wpłata", () =>
              program.methods
                .deposit(depositAmount!)
                .accountsPartial({ depositor: wallet!, vault: pda })
                .rpc(),
            )
          }
        >
          Wpłać
        </button>
      </div>

      <div className="row">
        <input
          inputMode="decimal"
          value={withdraw}
          placeholder="kwota"
          onChange={(e) => setWithdraw(e.target.value)}
          aria-label="Kwota wypłaty w SOL"
        />
        <button
          disabled={!wallet || !withdrawAmount || busy || !isActive(vault)}
          onClick={() =>
            run("Wypłata", () =>
              program.methods
                .withdraw(withdrawAmount!)
                .accountsPartial({ owner: wallet!, vault: pda })
                .rpc(),
            )
          }
        >
          Wypłać
        </button>
      </div>
    </section>
  );
};
