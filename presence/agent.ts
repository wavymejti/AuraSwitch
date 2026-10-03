// CareSwitch presence agent (macOS).
//
// While the caregiver's phone is within Bluetooth range, this sends the on-chain
// "Jestem" heartbeat signed by the device key. When the phone leaves, the agent
// simply stops – the countdown itself runs on-chain, so the laptop holds no power:
// its key can only ping, and switching it off cannot stop a takeover.
//
//   npm run scan                      list nearby BLE devices to find the phone
//   PHONE=<name or uuid> npm start    run the agent
//
// Env: PHONE (required for start), RSSI_MIN (default -75), GRACE (s, default 8),
//      RPC (default: VITE_RPC from ../app/.env.local), KEY (default ../keys/heartbeat.json)
import anchor from "@anchor-lang/core";
import noble from "@stoprocent/noble";
import fs from "node:fs";
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

const updatePresence = () => {
  const mine = [...devices.values()]
    .filter((d) => matchesPhone(d.name, d.services))
    .sort((a, b) => b.lastSeen - a.lastSeen)[0];
  const fresh = !!mine && now() - mine.lastSeen < GRACE_SECS;
  phoneRssi = fresh ? mine!.rssi : null;

  // Hysteresis so a phone at the edge of the threshold doesn't flicker in and out.
  const next = present
    ? fresh && mine!.rssi >= RSSI_MIN - RSSI_HYSTERESIS
    : fresh && mine!.rssi >= RSSI_MIN;
  if (next !== present) {
    present = next;
    log(
      present
        ? `📱 Telefon w pobliżu (RSSI ${phoneRssi}) – wysyłam „Jestem”.`
        : `🚶 Telefon poza zasięgiem – przestaję potwierdzać obecność. Licznik on-chain biegnie.`,
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
  id: string;
  active: boolean;
  timeout: number;
  lastHeartbeat: number;
}
let vault: VaultView | null = null;
let lastDiscovery = 0;
let sending = false;

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
  const v: any = await program.account.careVault.fetch(vault.address);
  const wasActive = vault.active;
  vault = {
    address: vault.address,
    id: v.vaultId.toString(),
    active: "active" in v.status,
    timeout: v.timeoutSecs.toNumber(),
    lastHeartbeat: v.lastHeartbeat.toNumber(),
  };
  if (wasActive === true && !vault.active) {
    log("⚠️  Fundusz PRZEJĘTY. Urządzenie nie może go przywrócić – zrobi to tylko opiekun główny („Jestem” w portfelu).");
  }
};

const maybePing = async () => {
  if (!present || !vault?.active || sending) return;
  // Ping well before the timeout, but not on every loop (each ping is a transaction).
  const every = Math.max(5, Math.floor(vault.timeout / 3));
  if (now() - vault.lastHeartbeat < every) return;

  sending = true;
  try {
    const sig = await program.methods
      .ping()
      .accountsPartial({ signer: deviceKey.publicKey, vault: vault.address })
      .rpc();
    vault.lastHeartbeat = Math.floor(now());
    log(`✅ „Jestem” wysłane  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    const code = err?.error?.errorCode?.code;
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
      ? `fundusz ${vault.id}: AKTYWNY, do przejęcia ${left} s`
      : `fundusz ${vault.id}: PRZEJĘTY`;
  }
  process.stdout.write(`\r\x1b[2K${phone}  ·  ${fund}`);
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

  await startBluetooth();
  setInterval(updatePresence, 500);
  setInterval(statusLine, 1000);
  const loop = async () => {
    try {
      await refreshVault();
      await maybePing();
    } catch (err: any) {
      log(`⚠️  RPC: ${String(err?.message ?? err).slice(0, 120)}`);
    }
    setTimeout(loop, 2000);
  };
  loop();
}
