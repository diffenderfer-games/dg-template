/**
 * kit/audio: one-shot sound primitives (tone, noise) and a per-sound throttle.
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md § "Sound effects"
 *
 * Short SFX may stay on the main thread (docs/kit/audio.md): they are a few
 * nodes that stop by themselves. Noise uses a fixed pattern, not Math.random.
 */
import type { AudioEngine } from './engine.ts';
import type { BufferLike, NoiseOpts, SfxKit, ToneOpts } from './types.ts';

let noise: BufferLike | null = null;

/** A 1 s buffer of noise, made once (a fixed LCG: no Math.random in the kit). */
function noiseBuffer(engine: AudioEngine): BufferLike | null {
  const ctx = engine.ctx;
  if (!ctx) return null;
  if (noise !== null && noise.length === ctx.sampleRate) return noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let s = 22222;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s / 0x3fffffff - 1) * 0.8;
  }
  noise = buf;
  return buf;
}

/** The primitives, playing into the engine's SFX bus. */
export function sfxKit(engine: AudioEngine): SfxKit {
  return {
    tone(o: ToneOpts) {
      const ctx = engine.ctx;
      const bus = engine.sfx;
      if (!ctx || !bus) return;
      const t0 = ctx.currentTime + (o.delay ?? 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur);
      g.gain.setValueAtTime(o.vol ?? 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g);
      g.connect(bus);
      osc.start(t0);
      osc.stop(t0 + o.dur + 0.02);
    },
    noise(o: NoiseOpts) {
      const ctx = engine.ctx;
      const bus = engine.sfx;
      const buf = noiseBuffer(engine);
      if (!ctx || !bus || !buf) return;
      const t0 = ctx.currentTime + (o.delay ?? 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.vol ?? 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filter.type;
        f.frequency.setValueAtTime(o.filter.freq, t0);
        src.connect(f);
        f.connect(g);
      } else {
        src.connect(g);
      }
      g.connect(bus);
      src.start(t0);
      src.stop(t0 + o.dur + 0.02);
    },
  };
}

/** At most `cap` plays of the same sound per `windowMs` (bfme SFX_CAP): a burst of coins isn't a wall of noise. */
export function throttleSfx(now: () => number, cap = 3, windowMs = 100): (name: string, play: () => void) => void {
  const recent = new Map<string, number[]>();
  return (name, play) => {
    const t = now();
    const list = (recent.get(name) ?? []).filter((at) => t - at < windowMs);
    if (list.length >= cap) return;
    list.push(t);
    recent.set(name, list);
    play();
  };
}
