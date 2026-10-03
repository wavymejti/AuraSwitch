import type { PublicKey } from "@solana/web3.js";
import { CLOCK_MARGIN_SECS, explorerAddress } from "../lib/config";
import { formatCountdown, formatSol, shortKey } from "../lib/format";
import { payeeName } from "../lib/payees";
import { isActive, type CareVault } from "../lib/program";

interface Props {
  vault: CareVault;
  pda: PublicKey;
  lamports: number;
  rentMin: number;
  now: number;
}

/** Seconds until the UI allows takeover (on-chain timeout + clock margin). */
export const secondsLeft = (vault: CareVault, now: number) =>
  vault.lastHeartbeat.toNumber() +
  vault.timeoutSecs.toNumber() +
  CLOCK_MARGIN_SECS -
  now;

export const StatusPanel = ({ vault, pda, lamports, rentMin, now }: Props) => {
  const active = isActive(vault);
  const left = secondsLeft(vault, now);
  const total = vault.timeoutSecs.toNumber() + CLOCK_MARGIN_SECS;
  const pct = active ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;

  return (
    <section className="card status">
      <div className="status-head">
        <span className={`badge ${active ? "ok" : "warn"}`}>
          {active ? "Aktywny" : "Przejęty"}
        </span>
        <span className="balance">
          {formatSol(Math.max(0, lamports - rentMin))}
          <small> dostępne</small>
        </span>
      </div>

      {active ? (
        <>
          <div className={`countdown ${left <= 0 ? "expired" : ""}`}>
            {formatCountdown(left)}
          </div>
          <div className="bar">
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="hint">
            {left > 0
              ? "Do możliwości przejęcia, jeśli opiekun nie potwierdzi obecności."
              : "Brak sygnału „Jestem” – każdy może teraz aktywować przejęcie."}
          </p>
        </>
      ) : (
        <p className="takeover-note">
          Opiekun zastępczy może płacić wyłącznie zatwierdzonym placówkom.
          Opiekun główny odzyska kontrolę, klikając „Jestem”.
        </p>
      )}

      <dl className="details">
        <dt>Opiekun</dt>
        <dd>{shortKey(vault.owner.toBase58())}</dd>
        <dt>Zastępca</dt>
        <dd>{shortKey(vault.beneficiary.toBase58())}</dd>
        <dt>Czas</dt>
        <dd>{vault.timeoutSecs.toString()} s</dd>
        <dt>Placówki</dt>
        <dd>{vault.allowlist.map(payeeName).join(", ")}</dd>
        <dt>Fundusz</dt>
        <dd>
          <a href={explorerAddress(pda.toBase58())} target="_blank" rel="noreferrer">
            {shortKey(pda.toBase58())} ↗
          </a>
        </dd>
      </dl>
    </section>
  );
};
