import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { animate, AnimatePresence, motion } from "motion/react";
import { Bluetooth, ExternalLink, HandCoins, Radio, Smartphone, UserRound } from "lucide-react";
import { AuraOrb } from "../components/AuraOrb";
import { ReleaseCelebration } from "../components/ReleaseCelebration";
import { orbView } from "../components/StatusPanel";
import { Avatar } from "../components/ui/Avatar";
import { ButtonLink } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { TopoBackground } from "../components/ui/TopoBackground";
import { useNow } from "../hooks/useNow";
import { usePresence } from "../hooks/usePresence";
import { useReleaseEvent, type ReleaseEvent } from "../hooks/useReleaseEvent";
import { useVault } from "../hooks/useVault";
import { POLL_MS, PROGRAM_ID, explorerAddress } from "../lib/config";
import { formatSol, shortKey } from "../lib/format";
import { findVaultPda } from "../lib/pda";
import { makeProgram, readOnlyWallet } from "../lib/program";

const viewer = readOnlyWallet();

/** Fund from ?owner=&id=, otherwise the one the presence agent is watching. */
const useShowTarget = (agentVault: string | undefined) =>
  useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const owner = p.get("owner");
    const id = p.get("id");
    try {
      if (owner && id) return findVaultPda(new PublicKey(owner), id);
    } catch {
      /* fall through */
    }
    return agentVault ? new PublicKey(agentVault) : null;
  }, [agentVault]);

/** Polls a wallet balance (the substitute's), so the jump after a release is visible. */
const useBalance = (key: PublicKey | null) => {
  const { connection } = useConnection();
  const [lamports, setLamports] = useState<number | null>(null);
  useEffect(() => {
    setLamports(null);
    if (!key) return;
    let alive = true;
    const poll = () =>
      connection
        .getBalance(key, "confirmed")
        .then((l) => alive && setLamports(l))
        .catch(() => {});
    poll();
    const t = setInterval(() => document.visibilityState === "visible" && poll(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [connection, key?.toBase58()]);
  return lamports;
};

/** Number that glides to its new value instead of jumping. */
const AnimatedSol = ({ lamports }: { lamports: number }) => {
  const [shown, setShown] = useState(lamports);
  const prev = useRef(lamports);
  useEffect(() => {
    const controls = animate(prev.current, lamports, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    prev.current = lamports;
    return () => controls.stop();
  }, [lamports]);
  return (
    <>
      {(shown / LAMPORTS_PER_SOL).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
      <small>SOL</small>
    </>
  );
};

export const Show = () => {
  const { connection } = useConnection();
  const program = useMemo(() => makeProgram(connection, viewer), [connection]);
  const presence = usePresence();
  const pda = useShowTarget(presence?.vault?.address);
  const { vault, lamports, rentMin } = useVault(program, pda);
  const now = useNow();
  const beneficiary = vault?.beneficiary ?? null;
  const bLamports = useBalance(beneficiary);
  const release = useReleaseEvent(pda?.toBase58() ?? null, vault, lamports, rentMin);
  const [preview, setPreview] = useState<ReleaseEvent | null>(null);
  const [highlightB, setHighlightB] = useState(false);

  const event = release.event ?? preview;
  useEffect(() => {
    if (!event) return;
    setHighlightB(true);
    const t = setTimeout(() => setHighlightB(false), 9000);
    return () => clearTimeout(t);
  }, [event?.at]);

  // ?podglad – rehearse the release animation without touching the chain.
  useEffect(() => {
    if (!vault || !new URLSearchParams(window.location.search).has("podglad")) return;
    const t = setTimeout(
      () =>
        setPreview({
          amount: lamports - rentMin > 0 ? lamports - rentMin : LAMPORTS_PER_SOL,
          beneficiary: vault.beneficiary.toBase58(),
          at: Date.now(),
        }),
      1500,
    );
    return () => clearTimeout(t);
  }, [!!vault]);

  const view = vault ? orbView(vault, now) : null;
  const agentOnThisFund = !!pda && presence?.vault?.address === pda.toBase58();
  const phone = agentOnThisFund ? presence?.phone : undefined;
  const lastRelease = agentOnThisFund ? presence?.lastRelease : null;

  return (
    <>
      <TopoBackground intensity={view?.state === "released" ? 1.2 : 0.9} />
      <div className="shell show container">
        <header className="topbar-inner">
          <Logo />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="chip">
              <span className="dot" /> Na żywo · Solana devnet
            </span>
            {pda && (
              <ButtonLink
                size="sm"
                href={explorerAddress(pda.toBase58())}
                target="_blank"
                rel="noreferrer"
              >
                Fundusz w Explorerze <ExternalLink size={13} />
              </ButtonLink>
            )}
          </div>
        </header>

        {!vault || !view ? (
          <div style={{ display: "grid", placeItems: "center" }}>
            <div className="glass empty-state">
              <div className="spinner" style={{ margin: "0 auto", width: 28, height: 28 }} />
              <h2>{pda ? "Wczytywanie funduszu…" : "Czekam na fundusz"}</h2>
              <p className="muted">
                {pda
                  ? "Łączę się z siecią."
                  : "Uruchom agenta obecności albo otwórz tryb pokazu z aplikacji (przycisk „Tryb pokazu”)."}
              </p>
            </div>
          </div>
        ) : (
          <div className="show-stage">
            {/* A – primary caregiver and their phone */}
            <motion.section
              className="glass person"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="person-role">
                <Avatar address={vault.owner.toBase58()} size={52} />
                <div>
                  <span className="eyebrow">
                    <UserRound size={13} /> Opiekun główny
                  </span>
                  <div className="person-addr">{shortKey(vault.owner.toBase58())}</div>
                </div>
              </div>
              {phone ? (
                <div className={`presence ${phone.present ? "is-near" : "is-gone"}`} style={{ marginTop: 0 }}>
                  <span className="presence-icon">
                    {phone.present ? <Smartphone size={20} /> : <Bluetooth size={20} />}
                    {phone.present && (
                      <motion.span
                        className="presence-ripple"
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                  </span>
                  <div className="presence-text">
                    <strong>{phone.present ? "Telefon w pobliżu" : "Telefon poza zasięgiem"}</strong>
                    <span>
                      {phone.present
                        ? presence?.lastPing
                          ? `ostatnie „Jestem” ${presence.lastPing.secsAgo} s temu`
                          : "urządzenie mówi „Jestem”"
                        : phone.absentForSecs !== null
                          ? `od ${phone.absentForSecs} s – „Jestem” ustało`
                          : "„Jestem” ustało"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="presence is-off" style={{ marginTop: 0 }}>
                  <span className="presence-icon">
                    <Radio size={20} />
                  </span>
                  <div className="presence-text">
                    <strong>„Jestem” z aplikacji</strong>
                    <span>agent obecności nie pilnuje tego funduszu</span>
                  </div>
                </div>
              )}
              <div className="person-meta">
                Wpłacił środki i ustalił zasady. Może w każdej chwili kliknąć „Jestem” – albo po prostu być obok.
              </div>
            </motion.section>

            {/* the fund */}
            <motion.div
              className="show-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <AuraOrb
                size={420}
                progress={view.progress}
                time={view.time}
                sub={view.sub}
                state={view.state}
                pulseKey={vault.lastHeartbeat.toString()}
              />
              <div className="show-vault-balance">{formatSol(Math.max(0, lamports - rentMin))} w funduszu</div>
            </motion.div>

            {/* B – substitute, live wallet balance */}
            <motion.section
              id="beneficiary-card"
              className={`glass person ${highlightB ? "is-highlight" : ""}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0, scale: highlightB ? 1.03 : 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="person-role">
                <Avatar address={vault.beneficiary.toBase58()} size={52} />
                <div>
                  <span className="eyebrow" style={{ color: "var(--pink)" }}>
                    <HandCoins size={13} /> Opiekun zastępczy
                  </span>
                  <div className="person-addr">{shortKey(vault.beneficiary.toBase58())}</div>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 14, marginBottom: 6 }}>
                Saldo portfela
              </div>
              <div className="person-balance">
                {bLamports === null ? "…" : <AnimatedSol lamports={bLamports} />}
              </div>
              <div className="person-meta">
                {view.status === "released"
                  ? "Otrzymał cały fundusz – bez banku, notariusza i sądu."
                  : "Otrzyma cały fundusz, gdy licznik dojdzie do zera."}
              </div>
            </motion.section>
          </div>
        )}

        <footer className="show-footer">
          <span>
            Reguły egzekwuje program on-chain{" "}
            <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
              {shortKey(PROGRAM_ID.toBase58())} <ExternalLink size={12} />
            </a>
          </span>
          {lastRelease && (
            <a href={`https://explorer.solana.com/tx/${lastRelease.sig}?cluster=devnet`} target="_blank" rel="noreferrer">
              Transakcja przekazania <ExternalLink size={12} />
            </a>
          )}
        </footer>
      </div>

      <AnimatePresence>
        {event && (
          <ReleaseCelebration
            event={event}
            onClose={() => {
              release.clear();
              setPreview(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};
