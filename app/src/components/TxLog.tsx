import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, History, X } from "lucide-react";
import { explorerTx } from "../lib/config";
import type { LogEntry } from "../hooks/useTxLog";

export const TxLog = ({ entries }: { entries: LogEntry[] }) => (
  <section className="glass card">
    <div className="card-head">
      <div className="card-title">
        <span className="card-icon">
          <History size={18} />
        </span>
        Historia
      </div>
    </div>
    {entries.length === 0 ? (
      <p className="hint" style={{ marginTop: 0 }}>
        Brak operacji w tej sesji.
      </p>
    ) : (
      <ul className="log">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.li
              key={e.id}
              className={e.ok ? "ok" : "err"}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <span className="log-icon">{e.ok ? <Check size={16} /> : <X size={16} />}</span>
              <span className="log-label">
                {e.label} <span className="log-time">· {e.at.toLocaleTimeString("pl-PL")}</span>
              </span>
              {e.sig ? (
                <a className="log-link" href={explorerTx(e.sig)} target="_blank" rel="noreferrer">
                  Explorer <ExternalLink size={12} />
                </a>
              ) : (
                <span />
              )}
              {!e.ok && (
                <span className="log-msg">
                  {e.message}
                  {e.detail && e.detail !== e.message && <small className="log-detail">{e.detail}</small>}
                </span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    )}
  </section>
);
