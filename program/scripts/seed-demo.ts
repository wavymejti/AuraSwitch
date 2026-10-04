// Creates a demo CareVault owned by the CLI wallet and funds the demo keys.
//
//   RPC=http://127.0.0.1:18899 TIMEOUT=30 BENEFICIARY=<pubkey> \
//     node --experimental-strip-types scripts/seed-demo.ts
//
// The device key is read from ../keys/heartbeat.json. Without BENEFICIARY a local
// keypair (../keys/beneficiary.json) is created and used.
import anchor from "@anchor-lang/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } =
  anchor.web3;

const KEYS = path.resolve(import.meta.dirname, "../../keys");
const loadKey = (file: string) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
const keyFile = (name: string) => path.join(KEYS, `${name}.json`);

const rpc = process.env.RPC ?? "http://127.0.0.1:8899";
const timeout = Number(process.env.TIMEOUT ?? 30);
const depositSol = Number(process.env.DEPOSIT ?? 2);

const owner = loadKey(path.join(os.homedir(), ".config/solana/id.json"));
const heartbeat = loadKey(keyFile("heartbeat"));

let beneficiary: anchor.web3.PublicKey;
if (process.env.BENEFICIARY) {
  beneficiary = new PublicKey(process.env.BENEFICIARY);
} else {
  if (!fs.existsSync(keyFile("beneficiary"))) {
    fs.writeFileSync(keyFile("beneficiary"), JSON.stringify([...Keypair.generate().secretKey]));
  }
  beneficiary = loadKey(keyFile("beneficiary")).publicKey;
}

const connection = new Connection(rpc, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), {
  commitment: "confirmed",
});
const idl = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../target/idl/careswitch.json"), "utf8"),
);
const program = new anchor.Program(idl, provider);

// Top up keys that need SOL: the device key pays its own fees (pings, releases).
const topUps: [anchor.web3.PublicKey, number][] = [
  [heartbeat.publicKey, 0.2],
  [beneficiary, 0.01],
];
for (const [key, sol] of topUps) {
  if ((await connection.getBalance(key)) >= sol * LAMPORTS_PER_SOL) continue;
  await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: key,
        lamports: Math.round(sol * LAMPORTS_PER_SOL),
      }),
    ),
  );
  console.log(`funded ${key.toBase58()} with ${sol} SOL`);
}

const vaultId = new anchor.BN(Date.now());
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from("care"), owner.publicKey.toBuffer(), vaultId.toArrayLike(Buffer, "le", 8)],
  program.programId,
);

await program.methods
  .initialize(vaultId, beneficiary, heartbeat.publicKey, new anchor.BN(timeout))
  .accountsPartial({ owner: owner.publicKey, vault })
  .rpc();
await program.methods
  .deposit(new anchor.BN(depositSol * LAMPORTS_PER_SOL))
  .accountsPartial({ depositor: owner.publicKey, vault })
  .rpc();

console.log(
  JSON.stringify(
    {
      vault: vault.toBase58(),
      owner: owner.publicKey.toBase58(),
      vaultId: vaultId.toString(),
      beneficiary: beneficiary.toBase58(),
      query: `?owner=${owner.publicKey.toBase58()}&id=${vaultId.toString()}`,
    },
    null,
    2,
  ),
);
