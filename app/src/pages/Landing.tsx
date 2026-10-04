import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Bluetooth,
  Gavel,
  HandCoins,
  HeartPulse,
  Landmark,
  LockKeyhole,
  Presentation,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AuraOrb, type OrbState } from "../components/AuraOrb";
import { ButtonLink } from "../components/ui/Button";
import { GithubIcon } from "../components/ui/GithubIcon";
import { Logo } from "../components/ui/Logo";
import { TopoBackground } from "../components/ui/TopoBackground";
import { PROGRAM_ID, explorerAddress } from "../lib/config";

const REPO_URL = "https://github.com/wavymejti/AuraSwitch";

const Reveal = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

/** Looping demo of the orb: 40 s countdown compressed into ~11 s, release, reset. */
const HeroOrb = () => {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setT(((performance.now() - start) / 1000) % 16), 100);
    return () => clearInterval(id);
  }, []);

  const counting = t < 11;
  const left = counting ? 40 * (1 - t / 11) : 0;
  const pings = t < 3.5 ? Math.floor(t / 1.2) : 3; // a few "Jestem" pulses while the phone is near
  const size = Math.min(380, Math.max(240, window.innerWidth - 80));
  const state: OrbState = counting ? (left < 12 ? "expiring" : "active") : "released";
  const phoneNear = t < 3.5;

  return (
    <div className="hero-visual">
      <AuraOrb
        size={size}
        progress={phoneNear ? 1 : left / 40}
        time={counting ? `0:${String(Math.ceil(phoneNear ? 40 : left)).padStart(2, "0")}` : "✓"}
        sub={counting ? (phoneNear ? "opiekun jest obok" : "do przekazania") : "przekazano zastępcy"}
        state={state}
        pulseKey={phoneNear ? pings : undefined}
      />
      <motion.div
        className="glass chip"
        style={{ position: "absolute", left: "2%", top: "16%", height: 44, padding: "0 16px" }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {phoneNear ? <Smartphone size={16} /> : <Bluetooth size={16} />}
        {phoneNear ? "Telefon w pobliżu" : "Telefon poza zasięgiem"}
      </motion.div>
      <motion.div
        className="glass chip chip-pink"
        style={{ position: "absolute", right: "0%", bottom: "14%", height: 44, padding: "0 16px" }}
        animate={{ y: [0, 8, 0], opacity: counting ? 0.35 : 1, scale: counting ? 0.94 : 1 }}
        transition={{ y: { duration: 5, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.4 } }}
      >
        <HandCoins size={16} /> +2 SOL → zastępca
      </motion.div>
    </div>
  );
};

export const Landing = () => (
  <>
    <TopoBackground />
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Logo />
          <nav className="topbar-nav">
            <ButtonLink variant="ghost" href="#jak" className="hide-sm">
              Jak to działa
            </ButtonLink>
            <ButtonLink variant="ghost" href="#bez-posrednika" className="hide-sm">
              Bez pośrednika
            </ButtonLink>
            <ButtonLink variant="ghost" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Kod na GitHubie">
              <GithubIcon />
            </ButtonLink>
            <ButtonLink variant="primary" href="/app">
              <span className="hide-sm">Otwórz aplikację</span>
              <span className="show-sm">Aplikacja</span>
              <ArrowRight size={16} />
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <motion.span
              className="chip"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles size={14} /> Superteam Poland · Finance Without Intermediaries
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Opieka, która <span className="grad">nie czeka na sąd.</span>
            </motion.h1>
            <motion.p
              className="hero-lead"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              AuraSwitch to fundusz na leczenie bliskiej osoby. Dopóki jesteś obok, Twój telefon sam mówi
              „Jestem”. Gdy sygnał zniknie, pieniądze trafią do opiekuna zastępczego w sekundy, bez banku,
              notariusza i sądu.
            </motion.p>
            <motion.div
              className="hero-ctas"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <ButtonLink variant="primary" size="lg" href="/app">
                Załóż fundusz <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink size="lg" href="#jak">
                Zobacz, jak działa
              </ButtonLink>
            </motion.div>
            <motion.div
              className="hero-badges"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <span className="chip">
                <ShieldCheck size={14} /> Reguły w programie on-chain
              </span>
              <span className="chip">
                <LockKeyhole size={14} /> Sejf bez klucza
              </span>
              <span className="chip">
                <HeartPulse size={14} /> Bez backendu
              </span>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroOrb />
          </motion.div>
        </section>

        <section className="section" id="problem">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Problem</span>
              <h2>Gdy opiekuna zabraknie, pieniądze utykają u pośredników.</h2>
              <p>
                Rodzic osoby z głęboką niepełnosprawnością odkłada na leki i rehabilitację. Jeśli trafi do szpitala
                albo umrze, dostęp do tych pieniędzy zależy od banku i sądu, a leki trzeba kupić dziś.
              </p>
            </div>
          </Reveal>
          <div className="compare">
            <Reveal delay={0}>
              <div className="glass compare-card is-them">
                <div className="big-icon">
                  <Landmark size={26} />
                </div>
                <h3>Bank</h3>
                <p>
                  Pełnomocnictwo wygasa ze śmiercią. Dyspozycja na wypadek śmierci: tylko dla rodziny i do 20×
                  przeciętnej pensji.
                </p>
                <div className="stat">0 zł</div>
                <div className="stat-label">dla opiekuna spoza rodziny</div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="glass compare-card is-them">
                <div className="big-icon">
                  <Gavel size={26} />
                </div>
                <h3>Sąd opiekuńczy</h3>
                <p>Ustanowienie kuratora albo opiekuna prawnego. Wnioski, terminy, dokumenty.</p>
                <div className="stat">tygodnie</div>
                <div className="stat-label">a często miesiące</div>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="glass compare-card is-us">
                <div className="big-icon">
                  <Sparkles size={26} />
                </div>
                <h3>AuraSwitch</h3>
                <p>Zasady ustalasz z góry. Pilnuje ich program na blockchainie, a nie urzędnik.</p>
                <div className="stat">sekundy</div>
                <div className="stat-label">od upływu ustalonego czasu do przekazania</div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="jak">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Jak to działa</span>
              <h2>Trzy kroki. Na co dzień nie klikasz nic.</h2>
            </div>
          </Reveal>
          <div className="steps">
            {[
              {
                icon: <Wallet size={22} />,
                title: "Załóż fundusz",
                text: "Wpłacasz środki, wskazujesz opiekuna zastępczego i czas bezczynności – na przykład trzy dni.",
              },
              {
                icon: <Bluetooth size={22} />,
                title: "Bądź obok",
                text: "Dopóki Twój telefon jest w zasięgu domowego urządzenia, ono co chwilę mówi za Ciebie „Jestem”.",
              },
              {
                icon: <HandCoins size={22} />,
                title: "Aura przechodzi dalej",
                text: "Gdy sygnał zniknie, licznik w programie dobiega zera i cały fundusz trafia do zastępcy. Wrócisz? Jedno „Jestem” i fundusz znów jest Twój.",
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <div className="glass step">
                  <span className="step-num">{i + 1}</span>
                  <div className="card-icon">{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section" id="bez-posrednika">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Bez pośrednika</span>
              <h2>Pośrednik to ktoś, kto może powiedzieć „nie”. Tu takiego nie ma.</h2>
            </div>
          </Reveal>
          <div className="trust">
            <Reveal>
              <div className="glass trust-card">
                <div className="card-title">
                  <span className="card-icon">
                    <LockKeyhole size={18} />
                  </span>
                  Sejf bez klucza
                </div>
                <ul className="trust-list">
                  <li>
                    <ShieldCheck size={18} /> Fundusz to konto programu bez klucza prywatnego. Nie ma go ani opiekun,
                    ani zastępca, ani my.
                  </li>
                  <li>
                    <ShieldCheck size={18} /> Przekazanie może wysłać każdy, ale program przepuści je dopiero po czasie
                    i wyłącznie do zastępcy wskazanego przez opiekuna.
                  </li>
                  <li>
                    <ShieldCheck size={18} /> Urządzenie „Jestem” umie tylko potwierdzać obecność. Kradzież nie daje
                    dostępu do pieniędzy.
                  </li>
                  <li>
                    <ShieldCheck size={18} /> Po zablokowaniu aktualizacji programu nikt, łącznie z autorami, nie
                    zmieni reguł.
                  </li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="glass trust-card">
                <div className="card-title">
                  <span className="card-icon">
                    <HeartPulse size={18} />
                  </span>
                  Decyduje zegar, nie urzędnik
                </div>
                <pre className="code-quote">
                  <span className="c">// program on-chain: release_to_beneficiary</span>
                  {"\n"}
                  <span className="k">require!</span>(vault.status == Status::Active);
                  {"\n"}
                  <span className="k">require!</span>(now - vault.last_heartbeat {">"} vault.timeout_secs);
                  {"\n\n"}
                  <span className="c">// całe saldo → zastępca zapisany przez opiekuna</span>
                  {"\n"}
                  vault.<span className="k">send_lamports</span>(&amp;vault, &amp;beneficiary, amount)?;
                  {"\n"}
                  vault.status = Status::Released;
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 24 }}>
          <Reveal>
            <div className="glass cta-band">
              <h2>Pokaż, że opieka może być pewna.</h2>
              <p>Załóż fundusz na sieci testowej Solany i zobacz, jak aura przechodzi na zastępcę.</p>
              <div className="hero-ctas" style={{ justifyContent: "center" }}>
                <ButtonLink variant="primary" size="lg" href="/app">
                  Otwórz aplikację <ArrowRight size={18} />
                </ButtonLink>
                <ButtonLink size="lg" href="/pokaz">
                  <Presentation size={18} /> Tryb pokazu
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <span>AuraSwitch · hackathon Superteam Poland · Solana devnet</span>
          <span style={{ display: "flex", gap: 18 }}>
            <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
              Program w Explorerze
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  </>
);
