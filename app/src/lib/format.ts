import { BN } from "@anchor-lang/core";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const solFmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 4 });

export const formatSol = (lamports: number) =>
  `${solFmt.format(lamports / LAMPORTS_PER_SOL)} SOL`;

/** Accepts "0,5" or "0.5". Returns null for anything that isn't a positive amount. */
export const parseSol = (input: string): BN | null => {
  const n = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return new BN(Math.round(n * LAMPORTS_PER_SOL));
};

export const formatCountdown = (secs: number) => {
  const s = Math.max(0, Math.ceil(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export const shortKey = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
