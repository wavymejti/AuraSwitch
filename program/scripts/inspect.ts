// Prints a CareVault's state and the cluster clock vs. local time.
//   RPC=https://api.devnet.solana.com OWNER=<pubkey> ID=<vault id> node --experimental-strip-types scripts/inspect.ts
import anchor from "@anchor-lang/core";
import fs from "node:fs";
import path from "node:path";

const { Connection, PublicKey, Keypair, SYSVAR_CLOCK_PUBKEY } = anchor.web3;
const connection = new Connection(process.env.RPC ?? "https://api.devnet.solana.com", "confirmed");
const idl = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../target/idl/careswitch.json"), "utf8"),
);
const program = new anchor.Program(
  idl,
  new anchor.AnchorProvider(connection, new anchor.Wallet(Keypair.generate()), {}),
);
const owner = new PublicKey(process.env.OWNER!);
const id = new anchor.BN(process.env.ID!);
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from("care"), owner.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
  program.programId,
);

const clock = await connection.getParsedAccountInfo(SYSVAR_CLOCK_PUBKEY);
const chainNow: number = (clock.value!.data as any).parsed.info.unixTimestamp;
const localNow = Math.floor(Date.now() / 1000);
const info = await connection.getAccountInfo(vault);
const v: any = await program.account.careVault.fetch(vault);
const rent = await connection.getMinimumBalanceForRentExemption(info!.data.length);

console.log({
  vault: vault.toBase58(),
  status: Object.keys(v.status)[0],
  lamports: info!.lamports,
  available: info!.lamports - rent,
  timeout: v.timeoutSecs.toNumber(),
  lastHeartbeat: v.lastHeartbeat.toNumber(),
  chainNow,
  localNow,
  chainMinusLocal: chainNow - localNow,
  secsSinceHeartbeatOnChain: chainNow - v.lastHeartbeat.toNumber(),
});
const sigs = await connection.getSignaturesForAddress(vault, { limit: 10 });
for (const s of sigs) console.log(s.signature.slice(0, 20), s.err ? "ERR " + JSON.stringify(s.err) : "ok", new Date((s.blockTime ?? 0) * 1000).toISOString());
