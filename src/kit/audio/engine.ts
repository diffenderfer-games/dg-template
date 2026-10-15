/**
 * kit/audio: the engine (music and SFX buses → compressor → out), unlock, visibility, volumes, duck.
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md § "The engine"
 *
 * - The AudioContext is created lazily on the first gesture (browsers refuse
 *   sound before one) and resumed on every gesture after, including from
 *   iOS's `interrupted` state (bfme music.ts, dinodasher's silent buffer).
 * - Suspended while the page is hidden; resumed when it shows again.
 * - Volumes use a v² curve (a slider at half is a quarter of the power: it sounds half as loud).
 * - Works over plain http (a LAN IP): nothing here needs a secure context.
 */
import type { AudioContextLike, GainLike } from './types.ts';

/** How loud: the v² curve, 0 when off. */
export function curve(on: boolean, volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return on ? v * v : 0;
}

/** The engine. */
export class AudioEngine {
  ctx: AudioContextLike | null = null;
  music: GainLike | null = null;
  sfx: GainLike | null = null;
  private readonly create: () => AudioContextLike | null;
  private levels = { music: true, sfx: true, musicVolume: 0.7, sfxVolume: 0.9 };
  private ducked = false;
  private hidden = false;

  constructor(create: () => AudioContextLike | null) {
    this.create = create;
  }

  /** Is sound running (a context exists and isn't suspended)? */
  get running(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Create the context on the first call (a gesture), resume it on every later one. Safe to call often. */
  unlock(): void {
    if (this.hidden) return;
    if (this.ctx === null) {
      const ctx = this.create();
      if (ctx === null) return;
      this.ctx = ctx;
      const out = ctx.createDynamicsCompressor();
      out.connect(ctx.destination);
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music.connect(out);
      this.sfx.connect(out);
      this.apply();
      // iOS: a silent buffer started inside the gesture really unlocks output.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination);
      silent.start(0);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
  }

  /** Unlock on every kind of gesture and page return (bfme music.ts). Returns the remover. */
  installUnlock(target: EventTarget = window): () => void {
    const events = ['pointerdown', 'keydown', 'touchend', 'click', 'pageshow', 'focus'];
    const fn = (): void => this.unlock();
    for (const e of events) target.addEventListener(e, fn, { capture: true, passive: true });
    return () => {
      for (const e of events) target.removeEventListener(e, fn, { capture: true });
    };
  }

  /** Suspend while the page is hidden; resume when it shows (dinodasher, skipbo). Returns the remover. */
  watchVisibility(doc: Document = document): () => void {
    const fn = (): void => {
      this.hidden = doc.visibilityState === 'hidden';
      if (this.ctx === null) return;
      if (this.hidden) this.ctx.suspend().catch(() => undefined);
      else this.ctx.resume().catch(() => undefined);
    };
    doc.addEventListener('visibilitychange', fn);
    return () => doc.removeEventListener('visibilitychange', fn);
  }

  setMusic(on: boolean): void {
    this.levels.music = on;
    this.apply();
  }

  setSfx(on: boolean): void {
    this.levels.sfx = on;
    this.apply();
  }

  setMusicVolume(v: number): void {
    this.levels.musicVolume = v;
    this.apply();
  }

  setSfxVolume(v: number): void {
    this.levels.sfxVolume = v;
    this.apply();
  }

  /** Lower the music (pause screen, hub UI open). */
  duck(on: boolean): void {
    this.ducked = on;
    this.apply();
  }

  /** Is sound effects output on? */
  get sfxOn(): boolean {
    return this.levels.sfx;
  }

  private apply(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.sfx) return;
    const music = curve(this.levels.music, this.levels.musicVolume) * (this.ducked ? 0.3 : 1);
    this.music.gain.setTargetAtTime(music, ctx.currentTime, 0.05);
    this.sfx.gain.setTargetAtTime(curve(this.levels.sfx, this.levels.sfxVolume), ctx.currentTime, 0.02);
  }
}
