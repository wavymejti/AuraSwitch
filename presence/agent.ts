// CareSwitch presence agent (macOS).
//
// While the caregiver's phone is within Bluetooth range, this sends the on-chain
// "Jestem" heartbeat signed by the device key. When the phone leaves, the agent
// stops pinging; the countdown runs on-chain, and once it hits zero the agent sends
// the permissionless `release_to_beneficiary` (Solana has no cron – someone has to).
// The laptop holds no power over the funds: the program decides when a release is
// allowed and that it can only go to the beneficiary stored in the vault.
//
//   npm run scan                      list nearby BLE devices to find the phone
//   PHONE=<name or uuid> npm start    run the agent
//
// Env: PHONE (required for start), RSSI_MIN (default -75), GRACE (s, default 8),
//      RPC (default: VITE_RPC from ../app/.env.local), KEY (default ../keys/heartbeat.json),
//      STATUS_PORT (default 4747 – the web app reads http://localhost:4747/status)
import anchor from "@anchor-lang/core";
import noble from "@stoprocent/noble";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const here = import.meta.dirname;
const scanOnly = process.argv.includes("--scan");

// ---------- config ----------

const readAppEnv = (key: string) => {
  try {
    const line = fs
      .readFileSync(path.join(here, "../app/.env.local"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
};

const PHONE = (process.env.PHONE ?? "").trim().toLowerCase();
const RSSI_MIN = Number(process.env.RSSI_MIN ?? -75);
const RSSI_HYSTERESIS = 5;
const GRACE_SECS = Number(process.env.GRACE ?? 8);
const RPC = process.env.RPC ?? readAppEnv("VITE_RPC") ?? "https://api.devnet.solana.com";
const KEY_PATH = process.env.KEY ?? path.join(here, "../keys/heartbeat.json");
const STATUS_PORT = Number(process.env.STATUS_PORT ?? 4747);

const now = () => Date.now() / 1000;
const time = () => new Date().toLocaleTimeString("pl-PL");
const log = (msg: string) => {
  process.stdout.write("\r\x1b[2K");
  console.log(`${time()}  ${msg}`);
};
const normUuid = (u: string) => u.toLowerCase().replace(/-/g, "");

// ---------- Bluetooth ----------

interface Seen {
  name: string;
  services: string[];
  apple: boolean;
  rssi: number; // smoothed
  lastSeen: number;
}
const devices = new Map<string, Seen>();

const matchesPhone = (name: string, services: string[]) =>
  !!PHONE &&
  (name.toLowerCase().includes(PHONE) || services.some((s) => normUuid(s) === normUuid(PHONE)));

noble.on("discover", (p) => {
  const ad = p.advertisement;
  const name = ad.localName ?? "";
  const services = ad.serviceUuids ?? [];
  const prev = devices.get(p.id);
  devices.set(p.id, {
    name: name || prev?.name || "",
    services: services.length ? services : prev?.services ?? [],
    apple: ad.manufacturerData?.readUInt16LE?.(0) === 0x004c || !!prev?.apple,
    // Exponential smoothing – raw RSSI jumps ±10 dBm between packets.
    rssi: prev ? Math.round(prev.rssi * 0.7 + p.rssi * 0.3) : p.rssi,
    lastSeen: now(),
  });
});

const startBluetooth = async () => {
  noble.on("stateChange", (state) => {
    if (state === "unauthorized") {
      log(
        "❌ Brak zgody na Bluetooth. Ustawienia systemowe → Prywatność i ochrona → Bluetooth → " +
          "włącz dla aplikacji, w której uruchamiasz agenta (Terminal / iTerm / VS Code), i uruchom ponownie.",
      );
      process.exit(1);
    }
    if (state === "poweredOff") log("⚠️  Bluetooth jest wyłączony – włącz go w macOS.");
  });
  try {
    await noble.waitForPoweredOnAsync(15_000);
  } catch {
    log("❌ Bluetooth nie wystartował w 15 s (wyłączony albo brak zgody w Ustawieniach → Prywatność → Bluetooth).");
    process.exit(1);
  }
  await noble.startScanningAsync([], true); // allowDuplicates → continuous RSSI updates
};

// ---------- scan mode ----------

const runScan = () => {
  log("Skanuję Bluetooth… (Ctrl+C, aby zakończyć). Szukaj urządzenia z LightBlue – nazwy albo UUID usługi.");
  setInterval(() => {
    const rows = [...devices.entries()]
      .filter(([, d]) => now() - d.lastSeen < 10)
      .sort((a, b) => b[1].rssi - a[1].rssi)
      .slice(0, 25);
    console.clear();
    console.log(`${time()}  urządzenia w zasięgu (najsilniejsze u góry)\n`);
    console.log("RSSI  NAZWA                      USŁUGI (UUID)                          ID");
    for (const [id, d] of rows) {
      console.log(
        `${String(d.rssi).padStart(4)}  ${(d.name || (d.apple ? "(Apple, bez nazwy)" : "-")).padEnd(26).slice(0, 26)} ` +
          `${(d.services.join(",") || "-").padEnd(38).slice(0, 38)} ${id.slice(0, 12)}`,
      );
    }
    console.log(
      "\nTwój iPhone z LightBlue to zwykle jedno z najsilniejszych urządzeń z nazwą lub UUID z LightBlue." +
        "\nUruchom potem:  PHONE=<nazwa albo UUID> npm start",
    );
  }, 2000);
};

// ---------- presence ----------

let present = false;
let phoneRssi: number | null = null;
let phoneLastSeen: number | null = null;
let presentSince: number | null = null;
let absentSince: number | null = null;
let lastPing: { at: number; sig: string } | null = null;
let lastRelease: { at: number; sig: string } | null = null;

const updatePresence = () => {
  const mine = [...devices.values()]
    .filter((d) => matchesPhone(d.name, d.services))
    .sort((a, b) => b.lastSeen - a.lastSeen)[0];
  const fresh = !!mine && now() - mine.lastSeen < GRACE_SECS;
  phoneRssi = fresh ? mine!.rssi : null;
  if (mine) phoneLastSeen = mine.lastSeen;

  // Hysteresis so a phone at the edge of the threshold doesn't flicker in and out.
  const next = present
    ? fresh && mine!.rssi >= RSSI_MIN - RSSI_HYSTERESIS
    : fresh && mine!.rssi >= RSSI_MIN;
  if (next !== present) {
    present = next;
    if (present) {
      presentSince = now();
      absentSince = null;
    } else {
      absentSince = now();
      presentSince = null;
    }
    log(
      present
        ? `📱 Telefon w pobliżu (RSSI ${phoneRssi}) – wysyłam „Jestem”.`
        : `🚶 Telefon poza zasięgiem – przestaję potwierdzać obecność. Przy 0 przekażę fundusz zastępcy.`,
    );
  }
};

// ---------- chain ----------

const { Connection, Keypair, PublicKey } = anchor.web3;
const deviceKey = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, "utf8"))));
const idl = JSON.parse(fs.readFileSync(path.join(here, "../app/src/idl/careswitch.json"), "utf8"));
const connection = new Connection(RPC, "confirmed");
const program = new anchor.Program(
  idl,
  new anchor.AnchorProvider(connection, new anchor.Wallet(deviceKey), { commitment: "confirmed" }),
);

interface VaultView {
  address: anchor.web3.PublicKey;
  beneficiary: anchor.web3.PublicKey;
  id: string;
  active: boolean;
  released: boolean;
  timeout: number;
  lastHeartbeat: number;
}
let vault: VaultView | null = null;
let lastDiscovery = 0;
let sending = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Signs with the device key, sends, and confirms by polling signature status.
 * Anchor's .rpc() waits on a WebSocket subscription, which sometimes stalls and
 * reports "not confirmed in 30 s" for transactions that actually landed.
 */
const sendTx = async (builder: { transaction: () => Promise<anchor.web3.Transaction> }) => {
  const tx = await builder.transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = deviceKey.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(deviceKey);
  const sig = await connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
  for (;;) {
    const status = (await connection.getSignatureStatuses([sig])).value[0];
    if (status?.err) throw new Error(`transakcja ${sig} odrzucona: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return sig;
    if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) {
      throw new Error(`transakcja ${sig} wygasła (nie trafiła do bloku)`);
    }
    await sleep(1000);
  }
};

/** Anchor error code from a preflight failure ("Error Code: NotExpired" in the logs). */
const programErrorCode = (err: any): string | undefined => {
  const logs: string[] = err?.logs ?? err?.transactionLogs ?? [];
  const text = [err?.message ?? "", ...logs].join("\n");
  return err?.error?.errorCode?.code ?? text.match(/Error Code: (\w+)/)?.[1];
};

/** Log a recurring warning at most once a minute instead of every loop. */
const lastWarned = new Map<string, number>();
const warnOnce = (key: string, msg: string) => {
  if (now() - (lastWarned.get(key) ?? 0) < 60) return;
  lastWarned.set(key, now());
  log(msg);
};

/** Newest vault whose heartbeat key is this device (offset 72 in CareVault). */
const discoverVault = async () => {
  const found = await program.account.careVault.all([
    { memcmp: { offset: 72, bytes: deviceKey.publicKey.toBase58() } },
  ]);
  const newest = found.sort((a: any, b: any) => b.account.vaultId.cmp(a.account.vaultId))[0];
  if (newest && newest.publicKey.toBase58() !== vault?.address.toBase58()) {
    log(`🔗 Pilnuję funduszu nr ${newest.account.vaultId.toString()} (${newest.publicKey.toBase58().slice(0, 8)}…).`);
  }
  return newest?.publicKey ?? null;
};

const refreshVault = async () => {
  if (!vault || now() - lastDiscovery > 15) {
    lastDiscovery = now();
    const address = await discoverVault();
    if (!address) {
      vault = null;
      return;
    }
    vault = { address } as VaultView;
  }
  let v: any;
  try {
    v = await program.account.careVault.fetch(vault.address);
  } catch (err: any) {
    if (/does not exist|has no data/i.test(String(err?.message))) throw err;
    warnOnce(
      "decode",
      `⚠️  Nie umiem odczytać funduszu ${vault.address.toBase58().slice(0, 8)}… – agent ma starszy opis programu (IDL) ` +
        "niż program w sieci. Zatrzymaj agenta (Ctrl+C) i uruchom go ponownie.",
    );
    return;
  }
  const wasActive = vault.active;
  vault = {
    address: vault.address,
    beneficiary: v.beneficiary,
    id: v.vaultId.toString(),
    active: "active" in v.status,
    released: "released" in v.status,
    timeout: v.timeoutSecs.toNumber(),
    lastHeartbeat: v.lastHeartbeat.toNumber(),
  };
  if (wasActive === true && !vault.active) {
    log(
      "💸 Fundusz PRZEKAZANY zastępcy. Urządzenie nie może go przywrócić – zrobi to tylko opiekun główny („Jestem” w portfelu).",
    );
  }
  if (wasActive === false && vault.active) log("🔄 Opiekun główny reaktywował fundusz.");
};

/** Seconds of extra margin over the on-chain timeout (local vs. cluster clock). */
const RELEASE_MARGIN_SECS = 2;

/**
 * Timeout passed and the phone is gone → send the release. Anyone could; the agent
 * does it so the handover happens without anyone clicking.
 */
const maybeRelease = async () => {
  if (present || !vault?.active || sending) return;
  if (now() - vault.lastHeartbeat <= vault.timeout + RELEASE_MARGIN_SECS) return;

  sending = true;
  try {
    const sig = await sendTx(
      program.methods.releaseToBeneficiary().accountsPartial({
        caller: deviceKey.publicKey,
        vault: vault.address,
        beneficiary: vault.beneficiary,
      }),
    );
    vault.active = false;
    vault.released = true;
    lastRelease = { at: now(), sig };
    log(`💸 Czas minął – fundusz przekazany zastępcy  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    const code = programErrorCode(err);
    // NotExpired: the cluster clock is a little behind ours – try again next loop.
    if (code !== "NotExpired") {
      log(`❌ Przekazanie nie przeszło${code ? ` (${code})` : ""}: ${String(err?.message ?? err).slice(0, 120)}`);
    }
  } finally {
    sending = false;
  }
};

const maybePing = async () => {
  if (!present || !vault?.active || sending) return;
  // Ping well before the timeout, but not on every loop (each ping is a transaction).
  const every = Math.max(5, Math.floor(vault.timeout / 3));
  if (now() - vault.lastHeartbeat < every) return;

  sending = true;
  try {
    const sig = await sendTx(
      program.methods.ping().accountsPartial({ signer: deviceKey.publicKey, vault: vault.address }),
    );
    vault.lastHeartbeat = Math.floor(now());
    lastPing = { at: now(), sig };
    log(`✅ „Jestem” wysłane  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    const code = programErrorCode(err);
    log(`❌ „Jestem” nie przeszło${code ? ` (${code})` : ""}: ${String(err?.message ?? err).slice(0, 120)}`);
  } finally {
    sending = false;
  }
};

const statusLine = () => {
  const phone = present ? `📱 blisko (${phoneRssi} dBm)` : phoneRssi !== null ? `📱 daleko (${phoneRssi} dBm)` : "📱 brak sygnału";
  let fund = "fundusz: szukam…";
  if (vault?.id) {
    const left = Math.max(0, Math.ceil(vault.lastHeartbeat + vault.timeout - now()));
    fund = vault.active
      ? `fundusz ${vault.id}: AKTYWNY, do przekazania zastępcy ${left} s`
      : vault.released
        ? `fundusz ${vault.id}: PRZEKAZANY zastępcy`
        : `fundusz ${vault.id}: nieaktywny`;
  }
  process.stdout.write(`\r\x1b[2K${phone}  ·  ${fund}`);
};

// ---------- status for the web app ----------

/** Read-only JSON status so the web page can show "phone nearby / gone" next to the countdown. */
const startStatusServer = () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Chrome/Brave Private Network Access preflight for localhost requests.
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.writeHead(204).end();
      return;
    }
    if (req.url !== "/status") {
      res.writeHead(404).end();
      return;
    }
    const t = now();
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        device: deviceKey.publicKey.toBase58(),
        phone: {
          name: PHONE,
          present,
          rssi: phoneRssi,
          rssiMin: RSSI_MIN,
          lastSeenSecsAgo: phoneLastSeen ? Math.round(t - phoneLastSeen) : null,
          presentForSecs: presentSince ? Math.round(t - presentSince) : null,
          absentForSecs: absentSince ? Math.round(t - absentSince) : null,
        },
        vault: vault?.id
          ? {
              address: vault.address.toBase58(),
              id: vault.id,
              active: vault.active,
              released: vault.released,
            }
          : null,
        lastPing: lastPing ? { secsAgo: Math.round(t - lastPing.at), sig: lastPing.sig } : null,
        lastRelease: lastRelease ? { secsAgo: Math.round(t - lastRelease.at), sig: lastRelease.sig } : null,
      }),
    );
  });
  server.on("error", (err: any) =>
    log(`⚠️  Status dla strony niedostępny (port ${STATUS_PORT}: ${err.code ?? err.message}). Agent działa dalej.`),
  );
  server.listen(STATUS_PORT, "127.0.0.1", () =>
    log(`🌐 Status dla strony: http://localhost:${STATUS_PORT}/status`),
  );
};

// ---------- main ----------

if (scanOnly) {
  await startBluetooth();
  runScan();
} else {
  if (!PHONE) {
    console.error("Ustaw PHONE=<nazwa albo UUID telefonu>. Najpierw: npm run scan");
    process.exit(1);
  }
  const balance = await connection.getBalance(deviceKey.publicKey);
  log(`Klucz urządzenia ${deviceKey.publicKey.toBase58()} · saldo ${(balance / 1e9).toFixed(4)} SOL · RPC ${new URL(RPC).host}`);
  if (balance < 0.005e9) log("⚠️  Mało SOL na kluczu urządzenia – każdy „Jestem” to opłata transakcyjna.");
  log(`Telefon: „${PHONE}”, próg RSSI ${RSSI_MIN} dBm, utrata sygnału po ${GRACE_SECS} s.`);

  startStatusServer();
  await startBluetooth();
  setInterval(updatePresence, 500);
  setInterval(statusLine, 1000);
  const loop = async () => {
    try {
      await refreshVault();
      await maybePing();
      await maybeRelease();
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 120);
      warnOnce(`rpc:${msg}`, `⚠️  RPC: ${msg}`);
    }
    setTimeout(loop, 2000);
  };
  loop();
}
