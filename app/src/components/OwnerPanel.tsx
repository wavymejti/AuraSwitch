import { useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { motion } from "motion/react";
import { ArrowDownToLine, HeartPulse, UserRound, Wallet } from "lucide-react";
import { parseSol, shortKey } from "../lib/format";
import { isActive, sameKey, type CareProgram, type CareVault } from "../lib/program";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

interface Props {
  program: CareProgram;
  wallet: PublicKey | null;
  vault: CareVault;
  pda: PublicKey;
  busy: boolean;
  run: (label: string, fn: () => Promise<string>) => Promise<string | null>;
}

export const OwnerPanel = ({ program, wallet, vault, pda, busy, run }: Props) => {
  const [deposit, setDeposit] = useState("1");
  const [withdraw, setWithdraw] = useState("");
  const isOwner = sameKey(wallet, vault.owner);
  const depositAmount = parseSol(deposit);
  const withdrawAmount = parseSol(withdraw);
  const owner = vault.owner.toBase58();

  return (
    <section className="glass card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-icon">
            <UserRound size={18} />
          </span>
          Opiekun główny
        </div>
        {isOwner && <span className="chip chip-ok">To Ty</span>}
      </div>

      <div className="who">
        <Avatar address={owner} />
        <div className="who-text">
          <strong>Codzienne „Jestem”</strong>
          <span>{shortKey(owner)}</span>
        </div>
      </div>

      <motion.button
        className="btn-heartbeat"
        disabled={!wallet || busy}
        whileHover={!wallet || busy ? undefined : { scale: 1.015 }}
        whileTap={!wallet || busy ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        onClick={() =>
          run("Jestem", () => program.methods.ping().accountsPartial({ signer: wallet!, vault: pda }).rpc())
        }
      >
        <HeartPulse size={28} /> Jestem
      </motion.button>
      {!isOwner && wallet && (
        <p className="hint">Połączony portfel nie jest opiekunem głównym – program odrzuci jego „Jestem”.</p>
      )}

      <div className="stack" style={{ marginTop: 20, gap: 10 }}>
        <div className="row">
          <div className="input-group">
            <input
              className="input"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              aria-label="Kwota wpłaty w SOL"
            />
            <span className="input-suffix">SOL</span>
          </div>
          <Button
            disabled={!wallet || !depositAmount || busy}
            onClick={() =>
              run("Wpłata", () =>
                program.methods.deposit(depositAmount!).accountsPartial({ depositor: wallet!, vault: pda }).rpc(),
              )
            }
          >
            <Wallet size={16} /> Wpłać
          </Button>
        </div>
        <div className="row">
          <div className="input-group">
            <input
              className="input"
              inputMode="decimal"
              value={withdraw}
              placeholder="kwota"
              onChange={(e) => setWithdraw(e.target.value)}
              aria-label="Kwota wypłaty w SOL"
            />
            <span className="input-suffix">SOL</span>
          </div>
          <Button
            disabled={!wallet || !withdrawAmount || busy || !isActive(vault)}
            onClick={() =>
              run("Wypłata", () =>
                program.methods.withdraw(withdrawAmount!).accountsPartial({ owner: wallet!, vault: pda }).rpc(),
              )
            }
          >
            <ArrowDownToLine size={16} /> Wypłać
          </Button>
        </div>
      </div>
    </section>
  );
};
