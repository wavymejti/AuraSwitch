// Creates a durable-nonce account for each given wallet, paid by the CLI wallet.
// Transactions that use a durable nonce instead of a recent blockhash never expire,
// so a slow wallet prompt (devnet blockhash lives only ~30 s) can't break the demo.
//
//   RPC=<devnet url> node --experimental-strip-types scripts/create-nonces.ts <wallet> [<wallet> ...]
//
// Address = createWithSeed(CLI wallet, nonceSeed(wallet), SystemProgram) – the app
// derives the same address from VITE_NONCE_BASE (the CLI wallet's pubkey).
import anchor from "@anchor-lang/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, NONCE_ACCOUNT_LENGTH } =
  anchor.web3;

export const nonceSeed = (wallet: anchor.web3.PublicKey) =>
  `cs-nonce-${wallet.toBase58().slice(0, 20)}`;

const payer = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")),
  ),
);
const connection = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {
  commitment: "confirmed",
});
const rent = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

for (const arg of process.argv.slice(2)) {
  const wallet = new PublicKey(arg);
  const seed = nonceSeed(wallet);
  const nonce = await PublicKey.createWithSeed(payer.publicKey, seed, SystemProgram.programId);

  if (await connection.getAccountInfo(nonce)) {
    console.log(`${wallet.toBase58()} → ${nonce.toBase58()} (already exists)`);
    continue;
  }
  await provider.sendAndConfirm(
    new Transaction().add(
      ...SystemProgram.createNonceAccount({
        fromPubkey: payer.publicKey,
        noncePubkey: nonce,
        basePubkey: payer.publicKey,
        seed,
        authorizedPubkey: wallet,
        lamports: rent,
      }).instructions,
    ),
  );
  console.log(`${wallet.toBase58()} → ${nonce.toBase58()} (created)`);
}
console.log(`VITE_NONCE_BASE=${payer.publicKey.toBase58()}`);
