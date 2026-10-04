// Montage: markers + tracks → out/<take>/auraswitch-2min.mp4 + napisy.srt
//
//   node post/montage.mjs [take-dir]          (default: newest out/*)
//
// Optional env:
//   PHONE_VIDEO=path.mov  PHONE_CUE_AT=12.3   iPhone screen recording for the PiP and the second
//                                             (in that video) when LightBlue broadcasting was
//                                             switched off – aligned with marker III.3:cue
//   MUSIC=path.mp3                            quiet music, ducked under the narration
//   SCREEN_OFFSET=…                           override the screen-track sync (wall-clock seconds
//                                             of screen.mp4 t=0) if flash detection fails
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WINDOW } from "../lib/browser.mjs";
import { CLIPS } from "../timeline.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const W = 1920;
const H = 1080;
const FPS = 30;
const BG = "0x0d0a14";
const XFADE = 0.35;
const ENC = ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(FPS)];

const take = process.argv[2]
  ? path.resolve(fs.existsSync(process.argv[2]) ? process.argv[2] : path.join(ROOT, "out", process.argv[2]))
  :
  path.join(ROOT, "out", fs.readdirSync(path.join(ROOT, "out")).filter((d) => !d.startsWith(".")).sort().pop());
const tmp = path.join(take, "montage");
fs.mkdirSync(tmp, { recursive: true });

const markers = JSON.parse(fs.readFileSync(path.join(take, "markers.json"), "utf8"));
// Last occurrence wins: a resumed take (--take) re-records clips after a failed attempt.
// The sync flash is the exception – the screen track was synced against the first one.
const at = (name) => (name === "sync:flash" ? markers.find((m) => m.name === name) : markers.findLast((m) => m.name === name))?.t;
const between = (prefix, a, b) => markers.filter((m) => m.name.startsWith(prefix) && m.t >= a && m.t <= b);

const ff = (args, label) => {
  try {
    return execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  } catch (e) {
    throw new Error(`ffmpeg (${label}) failed:\n${e.stderr ?? e.message}`);
  }
};
const probe = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));

// ---------- "page" track: variable-rate CDP frames → constant 30 fps ----------

// frames/, frames-2/, … (a take can be resumed with --take) – merged on one clock.
const frames = fs
  .readdirSync(take)
  .filter((d) => /^frames(-\d+)?$/.test(d) && fs.existsSync(path.join(take, d, "frames.json")))
  .flatMap((d) => JSON.parse(fs.readFileSync(path.join(take, d, "frames.json"), "utf8")).map((f) => ({ ...f, dir: d })))
  .sort((a, b) => a.t - b.t);

const pageSegment = (t0, t1, out) => {
  const i0 = Math.max(0, frames.findLastIndex((f) => f.t <= t0));
  const sel = frames.slice(i0).filter((f, i) => i === 0 || f.t < t1);
  if (!sel.length) throw new Error(`no page frames between ${t0} and ${t1}`);
  const lines = ["ffconcat version 1.0"];
  sel.forEach((f, i) => {
    const start = Math.max(f.t, t0);
    const end = i + 1 < sel.length ? sel[i + 1].t : t1;
    lines.push(`file '${path.join(take, f.dir, f.file)}'`, `duration ${Math.max(0.001, end - start).toFixed(4)}`);
  });
  lines.push(`file '${path.join(take, sel.at(-1).dir, sel.at(-1).file)}'`);
  const list = `${out}.txt`;
  fs.writeFileSync(list, lines.join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", `fps=${FPS},scale=${W}:${H}:flags=lanczos:in_range=full:out_range=tv,setsar=1,format=yuv420p`, ...ENC, out], `page ${out}`);
  return t1 - t0;
};

// ---------- "screen" track: sync via the white flash, crop the Brave window ----------

const screenFile = path.join(take, "screen.mp4");
const screenMeta = fs.existsSync(`${screenFile}.json`) ? JSON.parse(fs.readFileSync(`${screenFile}.json`, "utf8")) : null;

const screenGeometry = () => {
  const [vw] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", screenFile], { encoding: "utf8" })
    .trim()
    .split(",")
    .map(Number);
  const scale = vw / (screenMeta?.logicalScreen?.width ?? vw);
  const even = (n) => Math.round(n / 2) * 2;
  return { x: even(WINDOW.x * scale), y: even(WINDOW.y * scale), w: even(WINDOW.width * scale), h: even(WINDOW.height * scale) };
};

/** Wall-clock time of screen.mp4 t=0, from the brightness spike of the sync flash. */
const screenOffset = () => {
  if (process.env.SCREEN_OFFSET) return Number(process.env.SCREEN_OFFSET);
  const g = screenGeometry();
  const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -t 30 -i "${screenFile}" -vf "crop=${g.w}:${g.h}:${g.x}:${g.y},signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1`], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  let pts = null;
  for (const m of log.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)) {
    if (Number(m[2]) > 200) {
      pts = Number(m[1]);
      break;
    }
  }
  if (pts === null) throw new Error("sync flash not found in screen.mp4 – set SCREEN_OFFSET");
  return at("sync:flash") - pts;
};

let _offset;
const screenTime = (wall) => wall - (_offset ??= screenOffset());

/** Screen segment [t0,t1] at speed 1/f, framed on the brand background. */
const screenPart = (t0, t1, factor, out) => {
  const g = screenGeometry();
  const vf = [
    `crop=${g.w}:${g.h}:${g.x}:${g.y}`,
    `scale=-2:${H - 80}:flags=lanczos`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`,
    "setsar=1",
    `setpts=(PTS-STARTPTS)/${factor.toFixed(5)}`,
    `fps=${FPS}`,
    "format=yuv420p",
  ].join(",");
  ff(["-ss", screenTime(t0).toFixed(3), "-to", screenTime(t1).toFixed(3), "-i", screenFile, "-vf", vf, "-an", ...ENC, out], `screen ${out}`);
};

const concatFiles = (files, out) => {
  const list = `${out}.txt`;
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
  // Re-encode instead of "-c copy": clips from different encoders leave non-monotonic
  // timestamps that later make xfade end the video early.
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", `setsar=1,fps=${FPS},format=yuv420p`, "-an", ...ENC, out], `concat ${out}`);
};

// ---------- clip builders ----------

const fitToTarget = (src, real, target, speed, out) => {
  if (speed === "auto" && real > target) {
    ff(["-i", src, "-vf", `setpts=PTS/${(real / target).toFixed(5)},fps=${FPS}`, ...ENC, out], `speed ${out}`);
  } else if (real >= target) {
    ff(["-i", src, "-t", target.toFixed(3), ...ENC, out], `trim ${out}`);
  } else {
    ff(["-i", src, "-vf", `tpad=stop_mode=clone:stop_duration=${(target - real).toFixed(3)}`, ...ENC, out], `pad ${out}`);
  }
};

const withPip = (src, clip, t0, out) => {
  const video = process.env.PHONE_VIDEO;
  const cueAt = process.env.PHONE_CUE_AT;
  if (!video || cueAt === undefined || !at("III.3:cue")) return src;
  const phoneStart = t0 - (at("III.3:cue") - Number(cueAt)); // phone-video time at clip start
  const speed = clip.speed === "auto" ? (at(`${clip.id}:out`) - t0) / clip.target : 1;
  // Split layout: the page shrinks to the left, the phone stands in its own column on the
  // right – so the phone never covers the substitute's card.
  const pageW = 1480;
  const pageH = Math.round((pageW * H) / W / 2) * 2;
  const gap = 40;
  const phoneH = Math.round(pageH * 0.92 / 2) * 2;
  ff(
    [
      "-i", src,
      "-ss", Math.max(0, phoneStart).toFixed(3), "-i", video,
      "-filter_complex",
      `[0:v]scale=${pageW}:${pageH}:flags=lanczos,pad=${W}:${H}:${gap}:(oh-ih)/2:color=${BG}[bg];` +
        // eof_action=repeat: if the phone video ends first, hold its last frame (never cut the film).
        `[1:v]setpts=(PTS-STARTPTS)/${speed.toFixed(5)},fps=${FPS},scale=-2:${phoneH},setsar=1,pad=iw+8:ih+8:4:4:color=0xab9ff2[p];` +
        `[bg][p]overlay=${gap + pageW}+(${W - gap - pageW}-w)/2:(H-h)/2:eof_action=repeat,setsar=1,format=yuv420p`,
      "-t", String(clip.target), ...ENC, out,
    ],
    `pip ${out}`,
  );
  return out;
};

const buildClip = (clip) => {
  const t0 = at(`${clip.id}:in`);
  const t1 = at(`${clip.id}:out`);
  if (t0 === undefined || t1 === undefined) return null;
  const out = path.join(tmp, `${clip.id}.mp4`);

  if (clip.src === "page") {
    const raw = path.join(tmp, `${clip.id}.raw.mp4`);
    const real = pageSegment(t0, t1, raw);
    const fitted = path.join(tmp, `${clip.id}.fit.mp4`);
    fitToTarget(raw, real, clip.target, clip.speed, fitted);
    const final = clip.pip ? withPip(fitted, clip, t0, path.join(tmp, `${clip.id}.pip.mp4`)) : fitted;
    fs.copyFileSync(final, out);
    return out;
  }

  // screen: keep Phantom windows 1:1, speed up only the waiting in between
  if (!fs.existsSync(screenFile)) {
    console.warn(`  ! ${clip.id}: no screen.mp4 – skipped`);
    return null;
  }
  const opens = between("phantom:open", t0, t1).map((m) => m.t);
  const confirms = between("phantom:confirm", t0, t1).map((m) => m.t);
  const keep = opens.map((o, i) => [o - 0.3, Math.min(t1, (confirms[i] ?? o + 2) + 0.8)]);
  const parts = [];
  let cursor = t0;
  for (const [a, b] of keep) {
    if (a > cursor) parts.push({ a: cursor, b: a, keep: false });
    parts.push({ a: Math.max(a, cursor), b, keep: true });
    cursor = b;
  }
  if (cursor < t1) parts.push({ a: cursor, b: t1, keep: false });
  const kept = parts.filter((p) => p.keep).reduce((s, p) => s + p.b - p.a, 0);
  const free = parts.filter((p) => !p.keep).reduce((s, p) => s + p.b - p.a, 0);
  const room = clip.target - kept;
  const factor = room > 0.5 ? Math.max(1, free / room) : (free + kept) / clip.target; // if Phantom alone overflows, speed everything
  const files = parts.map((p, i) => {
    const f = path.join(tmp, `${clip.id}.part${i}.mp4`);
    screenPart(p.a, p.b, p.keep && room > 0.5 ? 1 : factor, f);
    return f;
  });
  const joined = path.join(tmp, `${clip.id}.joined.mp4`);
  concatFiles(files, joined);
  fitToTarget(joined, probe(joined), clip.target, undefined, out);
  return out;
};

// ---------- assemble: hard cuts inside an act, crossfades between acts ----------

const act = (id) => id.split(".")[0];
console.log(`Montaż: ${take}`);
const built = [];
for (const clip of CLIPS) {
  const file = buildClip(clip);
  if (!file) {
    console.log(`  – ${clip.id} (brak w nagraniu)`);
    continue;
  }
  built.push({ ...clip, file, dur: probe(file) });
  console.log(`  ✔ ${clip.id}  ${built.at(-1).dur.toFixed(2)} s`);
}
if (!built.length) throw new Error("Nothing to assemble");

const acts = [];
for (const c of built) {
  if (acts.at(-1)?.act !== act(c.id)) acts.push({ act: act(c.id), clips: [] });
  acts.at(-1).clips.push(c);
}
for (const a of acts) {
  a.file = path.join(tmp, `act-${a.act}.mp4`);
  concatFiles(a.clips.map((c) => c.file), a.file);
  a.dur = probe(a.file);
}

// Timeline (for audio and subtitles): each act after the first starts XFADE earlier.
let t = 0;
for (const [i, a] of acts.entries()) {
  a.start = i === 0 ? 0 : t - XFADE;
  let c0 = a.start;
  for (const c of a.clips) {
    c.start = c0;
    c0 += c.dur;
  }
  t = a.start + a.dur;
}
const total = t;

const video = path.join(tmp, "video.mp4");
if (acts.length === 1) {
  fs.copyFileSync(acts[0].file, video);
} else {
  const inputs = acts.flatMap((a) => ["-i", a.file]);
  // xfade silently stops at the first input whose SAR/timebase/format differ – normalise all.
  let chain = acts.map((_, i) => `[${i}:v]setsar=1,settb=AVTB,fps=${FPS},format=yuv420p[n${i}];`).join("");
  let prev = "[n0]";
  for (let i = 1; i < acts.length; i++) {
    const label = i === acts.length - 1 ? "[v]" : `[x${i}]`;
    chain += `${prev}[n${i}]xfade=transition=fade:duration=${XFADE}:offset=${acts[i].start.toFixed(3)}${label};`;
    prev = label;
  }
  ff([...inputs, "-filter_complex", chain.slice(0, -1), "-map", "[v]", ...ENC, video], "xfade");
}

const videoDur = probe(video);
if (videoDur < total - 0.5) throw new Error(`video.mp4 ma ${videoDur.toFixed(1)} s zamiast ${total.toFixed(1)} s – przejścia (xfade) ucięły obraz`);

// Audio: narration per clip (audio/<id>.wav) + optional ducked music; silence otherwise.
const narr = built.filter((c) => fs.existsSync(path.join(ROOT, "audio", `${c.id}.wav`)));
const final = path.join(take, "auraswitch-2min.mp4");
const audioIn = [];
const filters = [];
narr.forEach((c, i) => {
  audioIn.push("-i", path.join(ROOT, "audio", `${c.id}.wav`));
  filters.push(`[${i + 1}:a]adelay=${Math.round((c.start + 0.2) * 1000)}:all=1[n${i}]`); // 0.2 s breath after the cut
});
let audioMap;
if (narr.length) {
  filters.push(`${narr.map((_, i) => `[n${i}]`).join("")}amix=inputs=${narr.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[voice]`);
  if (process.env.MUSIC) {
    audioIn.push("-stream_loop", "-1", "-i", process.env.MUSIC);
    const m = narr.length + 1;
    filters.push(`[${m}:a]volume=0.25[mus]`, "[voice]asplit[v1][v2]", "[mus][v2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck]", "[v1][duck]amix=inputs=2:normalize=0[a]");
  } else {
    filters.push("[voice]anull[a]");
  }
  audioMap = ["-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[a]"];
} else {
  audioIn.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  audioMap = ["-map", "0:v", "-map", "1:a"];
}
ff(
  ["-i", video, ...audioIn, ...audioMap, "-t", total.toFixed(3), "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final],
  "final",
);

// Subtitles from the narration lines.
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = built
  .map((c, i) => {
    // Subtitle shows while the line is spoken (narration length if recorded, else the whole clip).
    const wav = path.join(ROOT, "audio", `${c.id}.wav`);
    const end = fs.existsSync(wav) ? Math.min(c.start + 0.2 + probe(wav) + 0.6, c.start + c.dur - 0.1) : c.start + c.dur - 0.2;
    return `${i + 1}\n${ts(c.start + 0.2)} --> ${ts(end)}\n${c.line}\n`;
  })
  .join("\n");
fs.writeFileSync(path.join(take, "napisy.srt"), srt);

console.log(`\n✔ ${final}  (${total.toFixed(1)} s)\n✔ ${path.join(take, "napisy.srt")}`);
