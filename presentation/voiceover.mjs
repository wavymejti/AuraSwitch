// Narration via ElevenLabs → audio/<clip>.wav (one file per clip, picked up by post/montage.mjs).
//
//   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node voiceover.mjs [I.1 III.4 …]
//
// The key is read from the environment only – never commit it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CLIPS } from "./timeline.mjs";

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
if (!KEY || !VOICE) {
  console.error("Ustaw ELEVENLABS_API_KEY i ELEVENLABS_VOICE_ID");
  process.exit(1);
}
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
const AUDIO = new URL("audio", import.meta.url).pathname;
fs.mkdirSync(AUDIO, { recursive: true });

/** Spoken form for the synthesiser only (subtitles keep the written form). */
const spoken = (text) =>
  text
    .replace(/AuraSwitch/g, "Aura Switch")
    .replace(/SOL-a/g, "sola")
    .replace(/[„”]/g, "");

const only = process.argv.slice(2);
const clips = CLIPS.filter((c) => !only.length || only.includes(c.id));
const duration = (f) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));

for (const clip of CLIPS) {
  if (!clips.includes(clip)) continue;
  const i = CLIPS.indexOf(clip);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: spoken(clip.line),
      model_id: MODEL,
      language_code: MODEL.includes("turbo") || MODEL.includes("flash") ? "pl" : undefined,
      // Neighbouring lines keep intonation consistent across separately generated clips.
      previous_text: CLIPS[i - 1] ? spoken(CLIPS[i - 1].line) : undefined,
      next_text: CLIPS[i + 1] ? spoken(CLIPS[i + 1].line) : undefined,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`✖ ${clip.id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const mp3 = path.join(AUDIO, `${clip.id}.mp3`);
  fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));

  // Trim leading/trailing silence; if the line is longer than its clip, speed it up (≤ 12 %).
  const wav = path.join(AUDIO, `${clip.id}.wav`);
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse";
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", mp3, "-af", trim, "-ar", "48000", "-ac", "2", wav]);
  let len = duration(wav);
  const room = clip.target - 0.5; // 0.2 s lead-in + a breath before the cut
  let note = "";
  if (len > room) {
    const tempo = len / room;
    if (tempo > 1.12) note = `  ⚠ za długie o ${(len - room).toFixed(1)} s – skróć tekst`;
    const t = Math.min(tempo, 1.12);
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", wav, "-af", `atempo=${t.toFixed(4)}`, `${wav}.tmp.wav`]);
    fs.renameSync(`${wav}.tmp.wav`, wav);
    note ||= `  (przyspieszone ×${t.toFixed(2)})`;
    len = duration(wav);
  }
  fs.rmSync(mp3);
  console.log(`✔ ${clip.id.padEnd(6)} ${len.toFixed(1)} s / ${clip.target} s${note}`);
}
