import { AnchorProvider, Program, type Wallet } from "@anchor-lang/core";
import {
  ComputeBudgetProgram,
  type ConfirmOptions,
  Connection,
  Keypair,
  type SendOptions,
  type Signer,
  PublicKey,
  SystemProgram,
  type TransactionSignature,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { NONCE_BASE } from "./config";
import idl from "../idl/careswitch.json";
import type { Careswitch } from "../idl/careswitch";

export type CareProgram = Program<Careswitch>;
export type CareVault = Awaited<
  ReturnType<CareProgram["account"]["careVault"]["fetch"]>
>;

/** Browser wallets have no `payer`; the provider only needs the signing methods. */
type SigningWallet = Omit<Wallet, "payer">;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The signed tx outlived its blockhash (devnet: ~150 blocks ≈ 30–35 s). */
export class BlockhashExpiredError extends Error {}

type RawTx = Buffer | Uint8Array | Array<number>;

/**
 * Explicit priority fee (~200 lamports). Phantom prepends its own ComputeBudget
 * instructions when a tx has none – which pushes AdvanceNonce out of first place
 * and turns a durable-nonce tx into an invalid "Blockhash not found" one.
 */
const computeBudget = () => [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
];

const PROGRAM_NAMES: Record<string, string> = {
  [SystemProgram.programId.toBase58()]: "System",
  [ComputeBudgetProgram.programId.toBase58()]: "ComputeBudget",
  [idl.address]: "CareSwitch",
};

/** Program names of a signed tx's instructions, in order. */
const instructionPrograms = (raw: RawTx) => {
  const message = VersionedTransaction.deserialize(Uint8Array.from(raw)).message;
  return message.compiledInstructions.map((ix) => {
    const id = message.staticAccountKeys[ix.programIdIndex].toBase58();
    return PROGRAM_NAMES[id] ?? id.slice(0, 6);
  });
};

/**
 * Connection that knows which blockhash the app handed out, so a
 * "Blockhash not found" from preflight can be told apart:
 * - expired (wallet prompt took too long) → BlockhashExpiredError, no point retrying;
 * - not expired → the load-balanced RPC node lags behind; resend the same signed bytes.
 */
class BlockhashAwareConnection extends Connection {
  private issued?: { blockhash: string; lastValidBlockHeight: number; at: number };
  private nonceInUse = false;

  async freshBlockhash() {
    const latest = await this.getLatestBlockhash("confirmed");
    this.issued = { ...latest, at: Date.now() };
    this.nonceInUse = false;
    return latest.blockhash;
  }

  /** The wallet's durable-nonce account (see program/scripts/create-nonces.ts), if any. */
  async durableNonceFor(wallet: PublicKey) {
    if (!NONCE_BASE) return null;
    const address = await PublicKey.createWithSeed(
      NONCE_BASE,
      `cs-nonce-${wallet.toBase58().slice(0, 20)}`,
      SystemProgram.programId,
    );
    const account = await this.getNonce(address, "confirmed").catch(() => null);
    if (!account || !account.authorizedPubkey.equals(wallet)) return null;
    this.issued = undefined; // nonce txs don't expire
    this.nonceInUse = true;
    return { address, value: account.nonce };
  }

  override async sendRawTransaction(raw: RawTx, options?: SendOptions): Promise<TransactionSignature> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await super.sendRawTransaction(raw, options);
      } catch (err) {
        if (!/Blockhash not found/i.test(String((err as Error)?.message))) throw err;
        const why = await this.diagnose(raw);
        if (why.expired) {
          throw new BlockhashExpiredError(
            `TRANSAKCJA WYGASŁA – ${why.secs} s od przygotowania (blockhash ${why.signedHash})`,
          );
        }
        if (why.walletReorderedNonce) {
          (err as Error).message +=
            ` | portfel zmienił transakcję – instrukcje: ${why.programs.join(", ")}`;
          throw err;
        }
        if (attempt >= 4) {
          (err as Error).message +=
            ` | blockhash w transakcji: ${why.signedHash} | instrukcje: ${why.programs.join(", ")}` +
            (why.swapped ? ` – portfel podmienił blockhash aplikacji (${this.issued?.blockhash})` : "");
          throw err;
        }
        await sleep(800 * (attempt + 1));
      }
    }
  }

  private async diagnose(raw: RawTx) {
    const signedHash = VersionedTransaction.deserialize(Uint8Array.from(raw)).message.recentBlockhash;
    const issued = this.issued;
    const swapped = !!issued && issued.blockhash !== signedHash;
    const secs = issued ? Math.round((Date.now() - issued.at) / 1000) : 0;
    let expired = false;
    if (issued && !swapped) {
      const height = await this.getBlockHeight("confirmed").catch(() => undefined);
      expired = height !== undefined && height > issued.lastValidBlockHeight;
    }
    const programs = instructionPrograms(raw);
    // A durable-nonce tx is only recognised if AdvanceNonce is the first instruction.
    const walletReorderedNonce = this.nonceInUse && programs[0] !== "System";
    return { signedHash, swapped, secs, expired, programs, walletReorderedNonce };
  }
}

/**
 * Wallet prompts can take longer than a devnet blockhash lives (~30 s). If the
 * signer has a durable-nonce account, the tx uses it and never expires. Otherwise
 * it gets a fresh blockhash right before the prompt, and one more prompt if the
 * user approved too late.
 */
class FreshBlockhashProvider extends AnchorProvider {
  override async sendAndConfirm(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    opts?: ConfirmOptions,
  ) {
    const connection = this.connection as BlockhashAwareConnection;
    if (tx instanceof VersionedTransaction) return super.sendAndConfirm(tx, signers, opts);

    const nonce = await connection.durableNonceFor(this.wallet.publicKey);
    if (nonce) {
      // AdvanceNonce must stay first; the budget instructions follow it.
      tx.instructions = [
        SystemProgram.nonceAdvance({
          noncePubkey: nonce.address,
          authorizedPubkey: this.wallet.publicKey,
        }),
        ...computeBudget(),
        ...tx.instructions,
      ];
      tx.recentBlockhash = nonce.value;
      return super.sendAndConfirm(tx, signers, opts);
    }

    tx.instructions = [...computeBudget(), ...tx.instructions];
    for (let attempt = 0; ; attempt++) {
      tx.recentBlockhash = await connection.freshBlockhash();
      try {
        return await super.sendAndConfirm(tx, signers, opts);
      } catch (err) {
        if (!(err instanceof BlockhashExpiredError) || attempt >= 1) throw err;
        console.info("transaction expired before approval – asking the wallet again");
      }
    }
  }
}

const connections = new WeakMap<Connection, BlockhashAwareConnection>();
const blockhashAware = (connection: Connection) => {
  let c = connections.get(connection);
  if (!c) {
    c = new BlockhashAwareConnection(connection.rpcEndpoint, "confirmed");
    connections.set(connection, c);
  }
  return c;
};

export const makeProgram = (connection: Connection, wallet: SigningWallet) =>
  new Program<Careswitch>(
    idl as Careswitch,
    new FreshBlockhashProvider(blockhashAware(connection), wallet as Wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    }),
  );

/** Wallet that can't sign – enough for reading accounts before anyone connects. */
export const readOnlyWallet = (): Wallet => {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: () => Promise.reject(new Error("read-only")),
    signAllTransactions: () => Promise.reject(new Error("read-only")),
  } as Wallet;
};

/** Wallet backed by a local keypair (heartbeat device). */
export const keypairWallet = (kp: Keypair): Wallet => {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  } as Wallet;
};

export const isActive = (v: CareVault) => "active" in v.status;

/** "released" = the whole balance already went to B; "takeover" only on vaults from the allowlist version. */
export const statusOf = (v: CareVault): "active" | "released" | "takeover" =>
  "active" in v.status ? "active" : "released" in v.status ? "released" : "takeover";

export const sameKey = (a: PublicKey | null | undefined, b: PublicKey | null | undefined) =>
  !!a && !!b && a.equals(b);
