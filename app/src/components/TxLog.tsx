import { explorerTx } from "../lib/config";
import type { LogEntry } from "../hooks/useTxLog";

export const TxLog = ({ entries }: { entries: LogEntry[] }) => (
  <section className="card">
    <h2>Historia operacji</h2>
    {entries.length === 0 ? (
      <p className="hint">Brak operacji w tej sesji.</p>
    ) : (
      <ul className="log">
        {entries.map((e) => (
          <li key={e.id} className={e.ok ? "ok" : "err"}>
            <span className="time">{e.at.toLocaleTimeString("pl-PL")}</span>
            <span className="icon">{e.ok ? "✓" : "✕"}</span>
            <span className="label">{e.label}</span>
            {e.sig ? (
              <a href={explorerTx(e.sig)} target="_blank" rel="noreferrer">
                Explorer ↗
              </a>
            ) : (
              <span className="msg">
                {e.message}
                {e.detail && e.detail !== e.message && (
                  <small className="detail">{e.detail}</small>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
