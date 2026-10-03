import type { PublicKey } from "@solana/web3.js";
import { DEFAULT_PAYEES } from "./config";
import { shortKey } from "./format";

/** Friendly name for an allowlisted address (falls back to a shortened key). */
export const payeeName = (key: PublicKey) =>
  DEFAULT_PAYEES.find((p) => p.address === key.toBase58())?.name ??
  shortKey(key.toBase58());
