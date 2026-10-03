import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../idl/careswitch.json";

export const RPC_URL: string =
  import.meta.env.VITE_RPC || clusterApiUrl("devnet");

export const PROGRAM_ID = new PublicKey(idl.address);

/** Seconds added on top of the on-chain timeout before the UI enables takeover (network clock drift). */
export const CLOCK_MARGIN_SECS = 3;

export const POLL_MS = 3000;

const parseKey = (s: string | undefined) => {
  try {
    return s ? new PublicKey(s) : null;
  } catch {
    return null;
  }
};

/** Payer of the durable-nonce accounts (program/scripts/create-nonces.ts). */
export const NONCE_BASE: PublicKey | null = parseKey(import.meta.env.VITE_NONCE_BASE);

/** Devnet-only heartbeat device key, embedded in the bundle on purpose (see README). */
export const HEARTBEAT_KEYPAIR: Keypair | null = (() => {
  const raw = import.meta.env.VITE_HEARTBEAT_SECRET;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
})();

export interface Payee {
  name: string;
  address: string;
}

export const DEFAULT_PAYEES: Payee[] = [
  { name: "Apteka", address: parseKey(import.meta.env.VITE_APTEKA)?.toBase58() ?? "" },
  { name: "Ośrodek rehabilitacji", address: parseKey(import.meta.env.VITE_OSRODEK)?.toBase58() ?? "" },
];

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

export const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;
