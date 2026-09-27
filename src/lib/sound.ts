/**
 * Sound effects synthesised with the Web Audio API: no audio files, so they work offline and add
 * nothing to the download. Respects the mute setting. iOS only allows audio after a user gesture,
 * so the context is created lazily on the first tap.
 */
import { useSettings } from '../state/settingsStore';

export type Sfx = 'tap' | 'correct' | 'acceptable' | 'wrong' | 'levelUp' | 'chest' | 'reveal' | 'achievement' | 'chips' | 'deal' | 'coin';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

interface Note {
  freq: number;
  /** Seconds after start. */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Slide to this frequency over the note. */
  to?: number;
}

function play(notes: Note[]) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    osc.type = n.type ?? 'triangle';
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
    const peak = n.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(a.out);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
  }
}

/** Short filtered noise burst (chip clicks, card slides). */
function noise(at: number, dur: number, freq: number, gain = 0.4) {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 2;
  const g = a.ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.out);
  src.start(a.ctx.currentTime + 0.01 + at);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const SOUNDS: Record<Sfx, () => void> = {
  tap: () => play([{ freq: 520, at: 0, dur: 0.06, type: 'sine', gain: 0.25, to: 380 }]),
  correct: () => play([{ freq: C5, at: 0, dur: 0.12 }, { freq: G5, at: 0.09, dur: 0.22 }]),
  acceptable: () => play([{ freq: E5, at: 0, dur: 0.16, type: 'sine' }]),
  wrong: () => play([{ freq: 220, at: 0, dur: 0.22, type: 'square', gain: 0.18, to: 150 }]),
  levelUp: () =>
    play([
      { freq: C5, at: 0, dur: 0.14 },
      { freq: E5, at: 0.12, dur: 0.14 },
      { freq: G5, at: 0.24, dur: 0.14 },
      { freq: C6, at: 0.36, dur: 0.45 },
      { freq: G5, at: 0.36, dur: 0.45, type: 'sine', gain: 0.3 },
    ]),
  chest: () => {
    noise(0, 0.12, 400, 0.5);
    noise(0.18, 0.12, 500, 0.5);
    noise(0.36, 0.16, 650, 0.6);
  },
  reveal: () =>
    play([
      { freq: G5, at: 0, dur: 0.1, type: 'sine' },
      { freq: C6, at: 0.07, dur: 0.1, type: 'sine' },
      { freq: 1318.5, at: 0.14, dur: 0.35, type: 'sine' },
    ]),
  achievement: () =>
    play([
      { freq: E5, at: 0, dur: 0.12 },
      { freq: G5, at: 0.1, dur: 0.12 },
      { freq: C6, at: 0.2, dur: 0.35 },
    ]),
  chips: () => {
    noise(0, 0.05, 3200, 0.5);
    noise(0.06, 0.05, 2800, 0.4);
  },
  deal: () => noise(0, 0.09, 1800, 0.35),
  coin: () => play([{ freq: 1568, at: 0, dur: 0.08, type: 'square', gain: 0.12 }, { freq: 2093, at: 0.07, dur: 0.18, type: 'square', gain: 0.12 }]),
};

const lastPlayed: Partial<Record<Sfx, number>> = {};

export function sfx(name: Sfx) {
  if (!useSettings.getState().soundOn) return;
  // Several cards dealt at once shouldn't stack into a roar.
  const now = performance.now();
  if (now - (lastPlayed[name] ?? -1e9) < 60) return;
  lastPlayed[name] = now;
  try {
    SOUNDS[name]();
  } catch {
    // Audio is decoration; never let it break the app.
  }
}
