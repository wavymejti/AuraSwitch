import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnimatePresence, motion } from "motion/react";
import {
  Bluetooth,
  CheckCircle2,
  Code2,
  Gavel,
  HandCoins,
  HeartPulse,
  Landmark,
  LockKeyhole,
  ServerOff,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AuraOrb } from "../components/AuraOrb";
import { LogoMark } from "../components/ui/Logo";
import { GithubIcon } from "../components/ui/GithubIcon";
import { TopoBackground } from "../components/ui/TopoBackground";
import { PROGRAM_ID } from "../lib/config";
import { shortKey } from "../lib/format";

/*
 * Slides for the submission video, recorded by Playwright.
 *
 * Contract (presentation/record.mjs relies on it):
 *   window.__slides.ready          Promise – fonts loaded and the first slide finished animating
 *   window.__slides.show(id, step) jump to a slide/step, resolves when its animation is done
 *   window.__slides.next()         next step (or next slide), resolves when the animation is done
 *   window.__slides.list           [{ id, steps }]
 *   <html data-slide="I.2:1">      current slide and step
 *   ?s=I.2&step=1                  deep link; ←/→ step manually
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const REPO = "github.com/wavymejti/AuraSwitch";
/** Public address shown in the "check it yourself" slide (set after deploying, e.g. to Vercel). */
const PUBLIC_APP = import.meta.env.VITE_PUBLIC_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");

interface SlideDef {
  id: string;
  steps: number;
  render: (step: number, done: () => void) => ReactNode;
}

/** Fade/slide in; calls `done` when this element's entrance finishes. */
const In = ({
  children,
  delay = 0,
  onDone,
  y = 30,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  onDone?: () => void;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <motion.div
    className={className}
    style={style}
    initial={{ opacity: 0, y }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay, ease: EASE }}
    onAnimationComplete={onDone}
  >
    {children}
  </motion.div>
);

/** Text typed in character by character, line after line. */
const Typed = ({ lines, onDone, perChar = 0.032 }: { lines: string[]; onDone: () => void; perChar?: number }) => {
  let i = 0;
  const total = lines.join("").length;
  return (
    <h1 className="slide-question">
      {lines.map((line, li) => (
        <span key={li} className="slide-line">
          {[...line].map((ch) => {
            const idx = i++;
            return (
              <motion.span
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * perChar + li * 0.25, duration: 0.25 }}
                onAnimationComplete={idx === total - 1 ? onDone : undefined}
              >
                {ch}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
};

/** Reads the program's upgrade authority – the "nobody can change the rules" chip is only true once it's gone. */
const useProgramFinal = () => {
  const { connection } = useConnection();
  const [final, setFinal] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const program = await connection.getParsedAccountInfo(PROGRAM_ID);
      const programData = (program.value?.data as any)?.parsed?.info?.programData;
      if (!programData) return;
      const pd = await connection.getParsedAccountInfo(new PublicKey(programData));
      const authority = (pd.value?.data as any)?.parsed?.info?.authority;
      if (alive) setFinal(authority === null || authority === undefined);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [connection]);
  return final;
};

const CODE_LINES: { text: ReactNode; hl?: number }[] = [
  { text: <span className="c">// program on-chain: release_to_beneficiary</span> },
  { text: "#[account(mut, seeds = […], bump," },
  { text: <>    <b>has_one = beneficiary</b> @ CareError::NotAuthorized)]</>, hl: 0 },
  { text: "pub vault: Account<'info, CareVault>," },
  { text: "" },
  { text: "require!(vault.status == Status::Active, NotActive);" },
  { text: <><b>require!(now - vault.last_heartbeat</b></>, hl: 1 },
  { text: <><b>         &gt; vault.timeout_secs</b>, NotExpired);</>, hl: 1 },
  { text: "" },
  { text: <>vault.<b>send_lamports(&amp;vault_info, &amp;beneficiary, amount)</b>?;</>, hl: 2 },
  { text: "vault.status = Status::Released;" },
];

const CODE_NOTES = [
  "Pieniądze mogą trafić wyłącznie do zastępcy zapisanego przez opiekuna.",
  "Przed upływem czasu program odmówi – decyduje zegar sieci.",
  "Całe saldo trafia do zastępcy. Bez banku, notariusza i sądu.",
];

const useSlides = (final: boolean | null): SlideDef[] =>
  useMemo(
    () => [
      {
        id: "I.1",
        steps: 1,
        render: (_s, done) => (
          <div className="slide-center">
            <Typed lines={["Co się stanie z pieniędzmi", "na leczenie mojego dziecka,", "jeśli jutro trafię do szpitala?"]} onDone={done} />
          </div>
        ),
      },
      {
        id: "I.2",
        steps: 3,
        render: (step, done) => (
          <div className="slide-pad">
            <In>
              <span className="eyebrow slide-eyebrow">Dziś</span>
              <h2 className="slide-title">Pieniądze utykają u pośredników.</h2>
            </In>
            <div className="slide-cards">
              {[
                { icon: <Landmark size={40} />, name: "Bank", text: "Pełnomocnictwo wygasa ze śmiercią.", stat: "0 zł", label: "dla opiekuna spoza rodziny", us: false },
                { icon: <Gavel size={40} />, name: "Sąd opiekuńczy", text: "Ustanowienie kuratora, wnioski, terminy.", stat: "tygodnie", label: "a często miesiące", us: false },
                { icon: <Sparkles size={40} />, name: "AuraSwitch", text: "Zasady ustalone z góry, pilnuje ich program.", stat: "sekundy", label: "od upływu ustalonego czasu", us: true },
              ].map((c, i) =>
                i <= step ? (
                  <In key={c.name} delay={i === step ? 0.1 : 0} onDone={i === step ? done : undefined}>
                    <div className={`glass slide-card ${c.us ? "is-us" : "is-them"}`}>
                      <div className="big-icon">{c.icon}</div>
                      <h3>{c.name}</h3>
                      <p>{c.text}</p>
                      <div className="slide-stat">{c.stat}</div>
                      <div className="slide-stat-label">{c.label}</div>
                    </div>
                  </In>
                ) : (
                  <div key={c.name} className="slide-card-placeholder" />
                ),
              )}
            </div>
          </div>
        ),
      },
      {
        id: "II.1",
        steps: 1,
        render: (_s, done) => (
          <div className="slide-center slide-hero">
            <In y={0}>
              <AuraOrb size={520} progress={1} time="0:40" sub="opiekun jest obok" state="active" pulseKey="hero" />
            </In>
            <In delay={0.5} onDone={done}>
              <div className="slide-brand">
                <LogoMark size={64} /> AuraSwitch
              </div>
              <h1 className="slide-tagline">
                Opieka, która <span className="grad">nie czeka na sąd.</span>
              </h1>
            </In>
          </div>
        ),
      },
      {
        id: "II.2",
        steps: 3,
        render: (step, done) => (
          <div className="slide-pad">
            <In>
              <span className="eyebrow slide-eyebrow">Jak to działa</span>
              <h2 className="slide-title">Fundusz, który pilnuje się sam.</h2>
            </In>
            <div className="slide-cards">
              {[
                { icon: <Wallet size={36} />, title: "Załóż fundusz", text: "Wpłata, zastępca i czas bez sygnału." },
                { icon: <Bluetooth size={36} />, title: "Bądź obok", text: "Telefon w pobliżu = „Jestem” wysyłane za Ciebie." },
                { icon: <HandCoins size={36} />, title: "Aura przechodzi dalej", text: "Brak sygnału → fundusz trafia do zastępcy." },
              ].map((c, i) =>
                i <= step ? (
                  <In key={c.title} onDone={i === step && step < 2 ? done : undefined}>
                    <div className="glass slide-card">
                      <span className="slide-step-num">{i + 1}</span>
                      <div className="big-icon">{c.icon}</div>
                      <h3>{c.title}</h3>
                      <p>{c.text}</p>
                    </div>
                  </In>
                ) : (
                  <div key={c.title} className="slide-card-placeholder" />
                ),
              )}
            </div>
            {step >= 2 && (
              <In delay={0.4} onDone={done} className="slide-states">
                <span className="chip chip-ok slide-chip">
                  <span className="dot" /> Aktywny
                </span>
                <span className="slide-arrows">⇄</span>
                <span className="chip chip-pink slide-chip">
                  <HandCoins size={20} /> Przekazany
                </span>
              </In>
            )}
          </div>
        ),
      },
      {
        id: "IV.2",
        steps: 3,
        render: (step, done) => (
          <div className="slide-pad">
            <In onDone={step === 0 ? done : undefined}>
              <span className="eyebrow slide-eyebrow">Dowód</span>
              <h2 className="slide-title">Reguły są w programie, nie u pośrednika.</h2>
            </In>
            <div className="slide-code-row">
              <pre className="code-quote slide-code">
                {CODE_LINES.map((l, i) => (
                  <motion.div
                    key={i}
                    className="slide-code-line"
                    animate={{
                      backgroundColor: l.hl === step ? "rgba(255,158,207,0.16)" : "rgba(255,158,207,0)",
                      opacity: l.hl === undefined || l.hl <= step ? 1 : 0.45,
                    }}
                    transition={{ duration: 0.5 }}
                    onAnimationComplete={l.hl === step && step === 1 ? done : undefined /* done() is idempotent per step */}
                  >
                    {l.text || " "}
                  </motion.div>
                ))}
              </pre>
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  className="slide-code-note"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.45 }}
                >
                  {CODE_NOTES[step]}
                </motion.p>
              </AnimatePresence>
            </div>
            {step >= 2 && (
              <In delay={0.3} onDone={done} className="slide-chips">
                <span className="chip slide-chip">
                  <LockKeyhole size={20} /> Sejf bez klucza
                </span>
                <span className="chip slide-chip">
                  <ServerOff size={20} /> Bez backendu
                </span>
                <span className="chip slide-chip">
                  {final ? <ShieldCheck size={20} /> : <Code2 size={20} />}
                  {final ? "Reguł nie zmieni nikt" : "Kod otwarty"}
                </span>
              </In>
            )}
          </div>
        ),
      },
      {
        id: "V.1",
        steps: 1,
        render: (_s, done) => (
          <div className="slide-pad">
            <In>
              <span className="eyebrow slide-eyebrow">Sprawdź sam</span>
              <h2 className="slide-title">Bez telefonu, w 5 minut.</h2>
            </In>
            <div className="slide-checklist">
              {[
                { icon: <Smartphone size={30} />, text: "Phantom na Devnecie, dwa konta z faucet.solana.com" },
                { icon: <Sparkles size={30} />, text: "Załóż fundusz – zastępca = drugie konto, czas 30 s" },
                { icon: <HeartPulse size={30} />, text: "Nie klikaj „Jestem”. Po 0:00 „Przekaż środki zastępcy” może kliknąć każdy" },
              ].map((c, i) => (
                <In key={i} delay={0.2 + i * 0.18} onDone={i === 2 ? done : undefined}>
                  <div className="glass slide-check">
                    <span className="card-icon slide-check-icon">{c.icon}</span>
                    {c.text}
                  </div>
                </In>
              ))}
            </div>
            <In delay={0.9} className="slide-url">
              <CheckCircle2 size={26} /> {PUBLIC_APP ? `${PUBLIC_APP}/app` : REPO}
            </In>
          </div>
        ),
      },
      {
        id: "V.2",
        steps: 1,
        render: (_s, done) => (
          <div className="slide-center slide-outro">
            <In y={10}>
              <LogoMark size={150} />
            </In>
            <In delay={0.25}>
              <div className="slide-brand slide-brand-lg">AuraSwitch</div>
              <h1 className="slide-tagline">
                Opieka, która <span className="grad">nie czeka na sąd.</span>
              </h1>
            </In>
            <In delay={0.5} onDone={done} className="slide-links">
              <span className="chip slide-chip">
                <GithubIcon size={20} /> {REPO}
              </span>
              <span className="chip slide-chip">Program {shortKey(PROGRAM_ID.toBase58())}</span>
              <span className="chip slide-chip">
                <Sparkles size={18} /> Superteam Poland · Finance Without Intermediaries
              </span>
            </In>
            <In delay={0.8} className="slide-fineprint">
              prototyp na devnecie · w produkcji dni zamiast sekund, USDC zamiast SOL
            </In>
          </div>
        ),
      },
    ],
    [final],
  );

/** Fixed 1920×1080 stage scaled to the window, so previews and recordings match. */
const useStageScale = () => {
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return k;
};

declare global {
  interface Window {
    __slides?: {
      ready: Promise<void>;
      show: (id: string, step?: number) => Promise<void>;
      next: () => Promise<void>;
      list: { id: string; steps: number }[];
    };
  }
}

export const Slides = () => {
  const final = useProgramFinal();
  const slides = useSlides(final);
  const scale = useStageScale();

  const initial = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const idx = Math.max(0, slides.findIndex((s) => s.id === p.get("s")));
    const step = Math.min(Number(p.get("step") ?? 0) || 0, slides[idx].steps - 1);
    return { idx, step };
  }, []);
  const [pos, setPos] = useState(initial);
  const slide = slides[pos.idx];

  // Resolve pending show()/next() once the current step has finished animating.
  const waiters = useRef<(() => void)[]>([]);
  const doneKey = useRef("");
  const key = `${slide.id}:${pos.step}`;
  const done = useCallback(() => {
    if (doneKey.current === key) return;
    doneKey.current = key;
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((r) => r());
  }, [key]);

  const waitDone = () =>
    new Promise<void>((resolve) => {
      waiters.current.push(resolve);
      // Fallback so a missed callback never hangs the recording.
      setTimeout(resolve, 6000);
    });

  const posRef = useRef(pos);
  posRef.current = pos;

  const go = useCallback(
    (idx: number, step: number) => {
      const target = { idx: Math.max(0, Math.min(idx, slides.length - 1)), step: Math.max(0, step) };
      const p = waitDone();
      doneKey.current = "";
      setPos(target);
      return p;
    },
    [slides.length],
  );

  const next = useCallback(() => {
    const { idx, step } = posRef.current;
    return step < slides[idx].steps - 1 ? go(idx, step + 1) : go(idx + 1, 0);
  }, [go, slides]);
  const prev = useCallback(() => {
    const { idx, step } = posRef.current;
    return step > 0 ? go(idx, step - 1) : go(idx - 1, slides[Math.max(0, idx - 1)].steps - 1);
  }, [go, slides]);

  useEffect(() => {
    document.documentElement.dataset.slide = key;
  }, [key]);

  // Public API for Playwright.
  useEffect(() => {
    const firstDone = waitDone();
    window.__slides = {
      ready: Promise.all([document.fonts.ready, firstDone]).then(() => undefined),
      show: (id, step = 0) => go(slides.findIndex((s) => s.id === id), step),
      next,
      list: slides.map((s) => ({ id: s.id, steps: s.steps })),
    };
  }, []);
  useEffect(() => {
    if (window.__slides) {
      window.__slides.next = next;
      window.__slides.show = (id, step = 0) => go(slides.findIndex((s) => s.id === id), step);
    }
  }, [next, go, slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="slides-viewport">
      <TopoBackground />
      <div
        className="slide-stage"
        style={{
          transform: `scale(${scale})`,
          left: (window.innerWidth - 1920 * scale) / 2,
          top: (window.innerHeight - 1080 * scale) / 2,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            className="slide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {slide.render(pos.step, done)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
