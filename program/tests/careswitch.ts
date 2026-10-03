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
  const apteka = Keypair.generate();
  const osrodek = Keypair.generate();

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

  const initialize = (
    vaultId: BN,
    opts: { timeout?: number; allowlist?: PublicKeyT[] } = {},
  ) =>
    program.methods
      .initialize(
        vaultId,
        beneficiary.publicKey,
        heartbeat.publicKey,
        new BN(opts.timeout ?? TIMEOUT_SECS),
        opts.allowlist ?? [apteka.publicKey, osrodek.publicKey],
      )
      .accountsPartial({ owner, vault: findVault(vaultId) })
      .rpc();

  const ping = (vault: PublicKeyT, signer?: Keypair) =>
    program.methods
      .ping()
      .accountsPartial({ signer: signer?.publicKey ?? owner, vault })
      .signers(signer ? [signer] : [])
      .rpc();

  const activateTakeover = (vault: PublicKeyT, caller: Keypair) =>
    program.methods
      .activateTakeover()
      .accountsPartial({ caller: caller.publicKey, vault })
      .signers([caller])
      .rpc();

  const pay = (
    vault: PublicKeyT,
    signer: Keypair,
    recipient: PublicKeyT,
    lamports: number,
  ) =>
    program.methods
      .pay(new BN(lamports))
      .accountsPartial({ beneficiary: signer.publicKey, vault, recipient })
      .signers([signer])
      .rpc();

  const withdraw = (vault: PublicKeyT, lamports: BN | number) =>
    program.methods
      .withdraw(new BN(lamports))
      .accountsPartial({ owner, vault })
      .rpc();

  const vaultId = new BN(Date.now());
  const vault = findVault(vaultId);

  before(async () => {
    for (const kp of [beneficiary, heartbeat, stranger]) {
      await fund(kp.publicKey, 1);
    }
    // Recipients must already hold rent-exempt balance to accept small payments.
    for (const kp of [apteka, osrodek]) {
      await fund(kp.publicKey, 0.01);
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
    expect(state.allowlist).to.have.length(2);

    const info = await connection.getAccountInfo(vault);
    const rent = await connection.getMinimumBalanceForRentExemption(
      info!.data.length,
    );
    expect(info!.lamports).to.equal(rent + DEPOSIT.toNumber());
  });

  it("rejects takeover before the timeout", async () => {
    await expectError(activateTakeover(vault, stranger), "NotExpired");
  });

  it("rejects pay while active", async () => {
    await expectError(
      pay(vault, beneficiary, apteka.publicKey, 1000),
      "NotInTakeover",
    );
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

  it("lets anyone activate the takeover after the timeout", async () => {
    await warp(connection, TIMEOUT_SECS + 2);
    await activateTakeover(vault, stranger);
    const state = await program.account.careVault.fetch(vault);
    expect(state.status).to.deep.equal({ takeover: {} });

    await expectError(activateTakeover(vault, stranger), "NotActive");
  });

  it("lets B pay an allowlisted recipient", async () => {
    const amount = 0.5 * LAMPORTS_PER_SOL;
    const before = await connection.getBalance(apteka.publicKey);
    await pay(vault, beneficiary, apteka.publicKey, amount);
    expect(await connection.getBalance(apteka.publicKey)).to.equal(
      before + amount,
    );
  });

  it("rejects B paying himself", async () => {
    await expectError(
      pay(vault, beneficiary, beneficiary.publicKey, 1000),
      "RecipientNotAllowed",
    );
  });

  it("rejects pay signed by anyone other than B", async () => {
    await expectError(
      pay(vault, stranger, apteka.publicKey, 1000),
      "NotAuthorized",
    );
  });

  it("rejects paying out more than the vault holds", async () => {
    await expectError(
      pay(vault, beneficiary, osrodek.publicKey, DEPOSIT.toNumber()),
      "InsufficientFunds",
    );
  });

  it("rejects heartbeat ping and withdraw during takeover", async () => {
    await expectError(ping(vault, heartbeat), "NotActive");
    await expectError(withdraw(vault, 1000), "NotActive");
  });

  it("returns control to A when the owner pings", async () => {
    await ping(vault);
    const state = await program.account.careVault.fetch(vault);
    expect(state.status).to.deep.equal({ active: {} });

    await expectError(
      pay(vault, beneficiary, apteka.publicKey, 1000),
      "NotInTakeover",
    );
  });

  it("lets A withdraw but keeps the vault rent-exempt", async () => {
    const info = await connection.getAccountInfo(vault);
    const rent = await connection.getMinimumBalanceForRentExemption(
      info!.data.length,
    );
    const available = info!.lamports - rent;

    await expectError(withdraw(vault, available + 1), "InsufficientFunds");
    await withdraw(vault, available);
    expect(await connection.getBalance(vault)).to.equal(rent);
  });

  it("rejects invalid configurations", async () => {
    const id = () => new BN(Date.now() + Math.floor(Math.random() * 1e6));
    await expectError(initialize(id(), { timeout: 0 }), "InvalidConfig");
    await expectError(initialize(id(), { allowlist: [] }), "InvalidConfig");
    await expectError(
      initialize(id(), {
        allowlist: [1, 2, 3, 4].map(() => Keypair.generate().publicKey),
      }),
      "InvalidConfig",
    );
    await expectError(
      initialize(id(), { allowlist: [beneficiary.publicKey] }),
      "InvalidConfig",
    );
    await expectError(
      initialize(id(), { allowlist: [owner] }),
      "InvalidConfig",
    );
  });
});
