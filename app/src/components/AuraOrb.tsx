import { AnimatePresence, motion } from "motion/react";

export type OrbState = "active" | "expiring" | "released" | "idle";

interface Props {
  size?: number;
  /** Remaining share of the timeout, 0..1. */
  progress: number;
  time: string;
  sub?: string;
  state: OrbState;
  /** Changes whenever a heartbeat lands – emits a ripple. */
  pulseKey?: string | number;
}

const CIRCUMFERENCE = 2 * Math.PI * 46;

const RING: Record<OrbState, [string, string]> = {
  active: ["#CFC7FF", "#8B78F0"],
  expiring: ["#FFC876", "#FF9ECF"],
  released: ["#FF9ECF", "#C0549A"],
  idle: ["#6E5BE8", "#3B2A99"],
};

/**
 * The fund as a glowing aura: the ring drains as the timeout runs out, the core
 * breathes, and every "Jestem" sends a ripple outwards.
 */
export const AuraOrb = ({ size = 300, progress, time, sub, state, pulseKey }: Props) => {
  const [from, to] = RING[state];
  const id = `orb-grad-${state}`;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className="orb" id="aura-orb" style={{ ["--orb-size" as string]: `${size}px` }}>
      <svg className="ring" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(171,159,242,0.12)" strokeWidth="2" />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - (state === "released" ? 1 : clamped))}
          style={{
            filter: `drop-shadow(0 0 3px ${from})`,
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s",
          }}
        />
      </svg>

      {/* orbiting sparks */}
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: "9%" }}
        animate={{ rotate: 360 }}
        transition={{ duration: state === "released" ? 30 : 12, repeat: Infinity, ease: "linear" }}
      >
        {[0, 120, 240].map((deg) => (
          <span
            key={deg}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 6,
              height: 6,
              marginLeft: -3,
              marginTop: -3,
              borderRadius: "50%",
              background: from,
              boxShadow: `0 0 12px 3px ${from}`,
              transform: `rotate(${deg}deg) translateY(-${size * 0.41}px)`,
            }}
          />
        ))}
      </motion.div>

      <motion.div
        className={`orb-core ${state === "released" ? "is-released" : ""} ${state === "expiring" ? "is-expiring" : ""}`}
        animate={{ scale: state === "idle" ? 0.92 : [1, 1.045, 1] }}
        transition={{ duration: state === "expiring" ? 1.1 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatePresence>
        {pulseKey !== undefined && (
          <motion.div
            key={String(pulseKey)}
            className="orb-pulse"
            initial={{ scale: 1, opacity: 0.85 }}
            animate={{ scale: 2.05, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <div className="orb-label">
        <div className="orb-time">{time}</div>
        {sub && <div className="orb-sub">{sub}</div>}
      </div>
    </div>
  );
};
