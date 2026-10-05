#!/usr/bin/env node
/**
 * Synthesises Lumo's sound effects as tiny 16-bit mono WAVs, so the game ships
 * with original, royalty-free audio. Run: `node scripts/generate-sounds.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const out = join(import.meta.dirname, '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** A note with exponential decay and a short attack to avoid clicks. */
function tone({ freq, freqEnd = freq, dur, gain = 0.6, decay = 6, harmonics = [1], offset = 0 }, buf) {
  const n = Math.floor(dur * RATE);
  const start = Math.floor(offset * RATE);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = freq * Math.pow(freqEnd / freq, t);
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, i / (RATE * 0.004)) * Math.exp(-decay * t);
    let v = 0;
    harmonics.forEach((amp, k) => (v += amp * Math.sin(phase * (k + 1))));
    buf[start + i] = (buf[start + i] ?? 0) + v * env * gain;
  }
  return buf;
}

function render(len, notes) {
  const buf = new Array(Math.floor(len * RATE)).fill(0);
  notes.forEach((n) => tone(n, buf));
  return buf;
}

const sounds = {
  tap: render(0.06, [{ freq: 1400, freqEnd: 900, dur: 0.06, gain: 0.35, decay: 9 }]),
  hit: render(0.14, [{ freq: 740, freqEnd: 990, dur: 0.14, gain: 0.5, decay: 7, harmonics: [1, 0.25] }]),
  perfect: render(0.32, [
    { freq: 988, dur: 0.18, gain: 0.4, decay: 6, harmonics: [1, 0.3] },
    { freq: 1480, dur: 0.24, gain: 0.35, decay: 5, harmonics: [1, 0.2], offset: 0.07 },
  ]),
  miss: render(0.42, [{ freq: 320, freqEnd: 110, dur: 0.42, gain: 0.55, decay: 4, harmonics: [1, 0.5, 0.25, 0.12] }]),
  unlock: render(0.6, [
    { freq: 523, dur: 0.3, gain: 0.35, decay: 5, harmonics: [1, 0.3] },
    { freq: 659, dur: 0.3, gain: 0.35, decay: 5, harmonics: [1, 0.3], offset: 0.09 },
    { freq: 784, dur: 0.4, gain: 0.35, decay: 4, harmonics: [1, 0.3], offset: 0.18 },
    { freq: 1047, dur: 0.42, gain: 0.3, decay: 4, harmonics: [1, 0.2], offset: 0.18 },
  ]),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(out, `${name}.wav`), wav(samples));
  console.log(`wrote assets/sounds/${name}.wav`);
}
