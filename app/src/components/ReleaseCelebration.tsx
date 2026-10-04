import { useEffect, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import confetti from "canvas-confetti";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { shortKey } from "../lib/format";
import type { ReleaseEvent } from "../hooks/useReleaseEvent";

const COLORS = ["#CFC7FF", "#AB9FF2", "#FF9ECF", "#FFFFFF", "#8B78F0"];
const PARTICLES = 26;

const centerOf = (id: string, fallback: { x: number; y: number }) => {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * "The aura flows to B": glowing particles stream from the orb to the substitute's
 * card, confetti bursts, and the received amount counts up.
 */
export const ReleaseCelebration = ({ event, onClose }: { event: ReleaseEvent; onClose: () => void }) => {
  const [shown, setShown] = useState(0);
  const from = useRef(centerOf("aura-orb", { x: window.innerWidth / 2, y: window.innerHeight / 2 }));
  const to = useRef(centerOf("beneficiary-card", { x: window.innerWidth * 0.85, y: window.innerHeight / 2 }));
  const sol = event.amount / LAMPORTS_PER_SOL;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counter = animate(0, sol, {
      duration: reduced ? 0 : 2.2,
      delay: reduced ? 0 : 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    if (!reduced) {
      const burst = (x: number, y: number, n: number) =>
        confetti({
          particleCount: n,
          spread: 75,
          startVelocity: 42,
          ticks: 220,
          origin: { x: x / window.innerWidth, y: y / window.innerHeight },
          colors: COLORS,
          scalar: 1.05,
          zIndex: 70,
        });
      const t1 = setTimeout(() => burst(to.current.x, to.current.y, 90), 1300);
      const t2 = setTimeout(() => burst(window.innerWidth / 2, window.innerHeight * 0.4, 140), 1700);
      const close = setTimeout(onClose, 8000);
      return () => {
        counter.stop();
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(close);
      };
    }
    const close = setTimeout(onClose, 6000);
    return () => {
      counter.stop();
      clearTimeout(close);
    };
  }, []);

  return (
    <motion.div
      className="celebrate"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      role="dialog"
      aria-live="assertive"
      aria-label="Fundusz przekazany zastępcy"
    >
      {Array.from({ length: PARTICLES }, (_, i) => {
        const size = 6 + ((i * 7) % 9);
        const bend = ((i % 5) - 2) * 60;
        return (
          <motion.span
            key={i}
            className="particle"
            style={{
              width: size,
              height: size,
              left: 0,
              top: 0,
              background: COLORS[i % COLORS.length],
              boxShadow: `0 0 ${size * 2}px ${size / 2}px ${COLORS[i % COLORS.length]}`,
            }}
            initial={{ x: from.current.x, y: from.current.y, opacity: 0, scale: 0.4 }}
            animate={{
              x: [from.current.x, (from.current.x + to.current.x) / 2 + bend, to.current.x],
              y: [from.current.y, Math.min(from.current.y, to.current.y) - 120 - bend / 2, to.current.y],
              opacity: [0, 1, 0],
              scale: [0.4, 1.2, 0.3],
            }}
            transition={{ duration: 1.4, delay: 0.1 + i * 0.035, ease: "easeInOut" }}
          />
        );
      })}

      <motion.div
        className="celebrate-card"
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.8 }}
      >
        <div className="eyebrow" style={{ justifyContent: "center", color: "var(--pink)" }}>
          Aura przeszła na zastępcę
        </div>
        <div className="celebrate-amount">+{shown.toLocaleString("pl-PL", { maximumFractionDigits: 3 })} SOL</div>
        <div className="celebrate-title">Fundusz trafił do {shortKey(event.beneficiary)}</div>
        <div className="celebrate-sub">Bez banku, notariusza i sądu – zdecydował zegar w programie on-chain.</div>
      </motion.div>
    </motion.div>
  );
};
