import type { PublicKey } from "@solana/web3.js";
import { ExternalLink } from "lucide-react";
import { CLOCK_MARGIN_SECS, explorerAddress } from "../lib/config";
import { formatCountdown, formatSol, shortKey } from "../lib/format";
import { statusOf, type CareVault } from "../lib/program";
import type { PresenceStatus } from "../hooks/usePresence";
import { AuraOrb, type OrbState } from "./AuraOrb";
import { PresenceBar } from "./PresenceBar";

interface Props {
  vault: CareVault;
  pda: PublicKey;
  lamports: number;
  rentMin: number;
  now: number;
  presence: PresenceStatus | null;
}

/** Seconds until the UI considers the timeout passed (on-chain timeout + clock margin). */
export const secondsLeft = (vault: CareVault, now: number) =>
  vault.lastHeartbeat.toNumber() + vault.timeoutSecs.toNumber() + CLOCK_MARGIN_SECS - now;

/** Orb state + labels shared by the app and the presentation view. */
export const orbView = (vault: CareVault, now: number) => {
  const status = statusOf(vault);
  const total = vault.timeoutSecs.toNumber() + CLOCK_MARGIN_SECS;
  const left = secondsLeft(vault, now);
  const progress = left / total;
  if (status !== "active") {
    return {
      status,
      left,
      progress: 0,
      state: "released" as OrbState,
      time: "✓",
      sub: status === "released" ? "przekazano zastępcy" : "przejęty",
    };
  }
  return {
    status,
    left,
    progress,
    state: (progress < 0.25 ? "expiring" : "active") as OrbState,
    time: formatCountdown(left),
    sub: left > 0 ? "do przekazania" : "przekazuję…",
  };
};

export const StatusPanel = ({ vault, pda, lamports, rentMin, now, presence }: Props) => {
  const view = orbView(vault, now);
  const available = Math.max(0, lamports - rentMin);

  return (
    <section className="glass status-card">
      <div className="status-top">
        <span
          className={`chip ${
            view.status === "active" ? (view.state === "expiring" ? "chip-warn" : "chip-ok") : "chip-pink"
          }`}
        >
          <span className="dot" />
          {view.status === "active"
            ? view.state === "expiring"
              ? "Kończy się czas"
              : "Aktywny"
            : view.status === "released"
              ? "Przekazany zastępcy"
              : "Przejęty"}
        </span>
        <div className="balance">
          <div className="balance-value">{formatSol(available)}</div>
          <div className="balance-label">w funduszu</div>
        </div>
      </div>

      <div className="orb-stage">
        <AuraOrb
          size={300}
          progress={view.progress}
          time={view.time}
          sub={view.sub}
          state={view.state}
          pulseKey={vault.lastHeartbeat.toString()}
        />
      </div>
      <p className="orb-caption">
        {view.status === "released"
          ? "Środki trafiły do opiekuna zastępczego. Opiekun główny może reaktywować fundusz przyciskiem „Jestem”."
          : view.left > 0
            ? "Każde „Jestem” odnawia aurę. Gdy licznik dojdzie do zera, cały fundusz przejdzie na zastępcę."
            : "Brak sygnału „Jestem” – fundusz właśnie przechodzi na zastępcę."}
      </p>

      <PresenceBar status={presence} pda={pda} />

      <dl className="facts">
        <div className="fact">
          <dt>Zastępca</dt>
          <dd>{shortKey(vault.beneficiary.toBase58())}</dd>
        </div>
        <div className="fact">
          <dt>Czas bez „Jestem”</dt>
          <dd>{vault.timeoutSecs.toString()} s</dd>
        </div>
        <div className="fact">
          <dt>Konto funduszu</dt>
          <dd>
            <a href={explorerAddress(pda.toBase58())} target="_blank" rel="noreferrer">
              {shortKey(pda.toBase58())} <ExternalLink size={12} />
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
};
