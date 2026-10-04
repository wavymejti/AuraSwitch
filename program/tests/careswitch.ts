import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { BN } from "bn.js";
import { expect } from "chai";
import { Careswitch } from "../target/types/careswitch";

const { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } =
  anchor.web3;
type Keypair = anchor.web3.Keypair;
type PublicKeyT = anchor.web3.PublicKey;

const TIMEOUT_SECS = 2;
const DEPOSIT = new BN(2 * LAMPORTS_PER_SOL);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Moves the cluster clock forward. Surfpool exposes a `surfnet_timeTravel`
 * cheatcode; on any other validator we fall back to waiting in real time.
 */
const warp = async (connection: anchor.web3.Connection, secs: number) => {
  const clock = await connection.getParsedAccountInfo(
    anchor.web3.SYSVAR_CLOCK_PUBKEY,
  );
  const now: number = (clock.value!.data as any).parsed.info.unixTimestamp;
  const res = await fetch(connection.rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "surfnet_timeTravel",
      params: [{ absoluteTimestamp: (now + secs) * 1000 }],
    }),
  }).then((r) => r.json());
  if (res.error) await sleep((secs + 1) * 1000);
};

describe("careswitch", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;
  const program = anchor.workspace.careswitch as Program<Careswitch>;

  // A = provider wallet (funded by the local validator)
  const owner = provider.wallet.publicKey;
  const beneficiary = Keypair.generate(); // B
  const heartbeat = Keypair.generate();
  const stranger = Keypair.generate();

  const findVault = (vaultId: BN, vaultOwner: PublicKeyT = owner) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("care"),
        vaultOwner.toBuffer(),
        vaultId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    )[0];

  const fund = async (to: PublicKeyT, sol: number) => {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: to,
        lamports: sol * LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(tx);
  };

  const expectError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (err: any) {
      const actual = err?.error?.errorCode?.code ?? String(err);
      expect(actual).to.contain(code);
      return;
    }
    expect.fail(`expected ${code}, but transaction succeeded`);
  };

  const rentOf = async (vault: PublicKeyT) => {
    const info = await connection.getAccountInfo(vault);
    return connection.getMinimumBalanceForRentExemption(info!.data.length);
  };

  const initialize = (
    vaultId: BN,
    opts: { timeout?: number; beneficiary?: PublicKeyT } = {},
  ) =>
    program.methods
      .initialize(
        vaultId,
        opts.beneficiary ?? beneficiary.publicKey,
        heartbeat.publicKey,
        new BN(opts.timeout ?? TIMEOUT_SECS),
      )
      .accountsPartial({ owner, vault: findVault(vaultId) })
      .rpc();

  const ping = (vault: PublicKeyT, signer?: Keypair) =>
    program.methods
      .ping()
      .accountsPartial({ signer: signer?.publicKey ?? owner, vault })
      .signers(signer ? [signer] : [])
      .rpc();

  const release = (
    vault: PublicKeyT,
    caller: Keypair,
    to: PublicKeyT = beneficiary.publicKey,
  ) =>
    program.methods
      .releaseToBeneficiary()
      .accountsPartial({ caller: caller.publicKey, vault, beneficiary: to })
      .signers([caller])
      .rpc();

  const withdraw = (vault: PublicKeyT, lamports: BN | number) =>
    program.methods
      .withdraw(new BN(lamports))
      .accountsPartial({ owner, vault })
      .rpc();

  const status = async (vault: PublicKeyT) =>
    Object.keys((await program.account.careVault.fetch(vault)).status)[0];

  const vaultId = new BN(Date.now());
  const vault = findVault(vaultId);

  before(async () => {
    for (const kp of [beneficiary, heartbeat, stranger]) {
      await fund(kp.publicKey, 1);
    }
  });

  it("initializes the vault and accepts a deposit", async () => {
    await initialize(vaultId);
    await program.methods
      .deposit(DEPOSIT)
      .accountsPartial({ depositor: owner, vault })
      .rpc();

    const state = await program.account.careVault.fetch(vault);
    expect(state.owner.toBase58()).to.equal(owner.toBase58());
    expect(state.beneficiary.toBase58()).to.equal(
      beneficiary.publicKey.toBase58(),
    );
    expect(state.status).to.deep.equal({ active: {} });

    const info = await connection.getAccountInfo(vault);
    expect(info!.lamports).to.equal(
      (await rentOf(vault)) + DEPOSIT.toNumber(),
    );
  });

  it("rejects release before the timeout", async () => {
    await expectError(release(vault, stranger), "NotExpired");
  });

  it("accepts pings from owner and heartbeat key only", async () => {
    const before = (await program.account.careVault.fetch(vault))
      .lastHeartbeat;
    await warp(connection, 1);
    await ping(vault, heartbeat);
    const after = (await program.account.careVault.fetch(vault)).lastHeartbeat;
    expect(after.toNumber()).to.be.greaterThan(before.toNumber());

    await ping(vault);
    await expectError(ping(vault, stranger), "NotAuthorized");
  });

  it("rejects release to anyone but the stored beneficiary", async () => {
    await warp(connection, TIMEOUT_SECS + 2);
    await expectError(
      release(vault, stranger, stranger.publicKey),
      "NotAuthorized",
    );
  });

  it("lets anyone release the whole balance to B after the timeout", async () => {
    const rent = await rentOf(vault);
    const vaultBefore = await connection.getBalance(vault);
    const bBefore = await connection.getBalance(beneficiary.publicKey);

    await release(vault, stranger);

    expect(await connection.getBalance(beneficiary.publicKey)).to.equal(
      bBefore + (vaultBefore - rent),
    );
    expect(await connection.getBalance(vault)).to.equal(rent);
    expect(await status(vault)).to.equal("released");
  });

  it("can't release twice; the device can't ping a released vault", async () => {
    await expectError(release(vault, stranger), "NotActive");
    await expectError(ping(vault, heartbeat), "NotActive");
    await expectError(withdraw(vault, 1000), "NotActive");
  });

  it("lets A reactivate, refill and withdraw after a release", async () => {
    await ping(vault);
    expect(await status(vault)).to.equal("active");

    await program.methods
      .deposit(new BN(LAMPORTS_PER_SOL / 2))
      .accountsPartial({ depositor: owner, vault })
      .rpc();
    const available = (await connection.getBalance(vault)) - (await rentOf(vault));

    await expectError(withdraw(vault, available + 1), "InsufficientFunds");
    await withdraw(vault, available);
    expect(await connection.getBalance(vault)).to.equal(await rentOf(vault));
  });

  it("releases an empty vault without moving lamports", async () => {
    await warp(connection, TIMEOUT_SECS + 2);
    const bBefore = await connection.getBalance(beneficiary.publicKey);
    await release(vault, stranger);
    expect(await connection.getBalance(beneficiary.publicKey)).to.equal(bBefore);
    expect(await status(vault)).to.equal("released");
  });

  it("rejects invalid configurations", async () => {
    const id = () => new BN(Date.now() + Math.floor(Math.random() * 1e6));
    await expectError(initialize(id(), { timeout: 0 }), "InvalidConfig");
    await expectError(initialize(id(), { beneficiary: owner }), "InvalidConfig");
  });
});
