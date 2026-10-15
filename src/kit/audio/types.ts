/**
 * kit/audio: the hooks a game gives for sound, what the kit gives back, and the Web Audio subset it uses.
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md
 *
 * The kit types the small part of Web Audio it uses, so the engine runs on a
 * real AudioContext or on `fakeAudioContext()` in unit tests.
 */
import type { Json } from '../core/json.ts';

/** An AudioParam, as the kit uses it. */
export type ParamLike = {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(value: number, time: number, constant: number): unknown;
};

/** An AudioNode, as the kit uses it. */
export type NodeLike = { connect(destination: NodeLike): unknown; disconnect(): void };
export type GainLike = NodeLike & { gain: ParamLike };
export type BufferLike = {
  readonly length: number;
  readonly duration: number;
  getChannelData(channel: number): Float32Array;
};
export type SourceLike = NodeLike & {
  buffer: BufferLike | null;
  start(when?: number): void;
  stop(when?: number): void;
  onended: ((this: never, ev: Event) => unknown) | null;
};
export type OscillatorLike = NodeLike & {
  type: OscillatorType;
  frequency: ParamLike;
  start(when?: number): void;
  stop(when?: number): void;
};
export type FilterLike = NodeLike & { type: BiquadFilterType; frequency: ParamLike };

/** An AudioContext, as the kit uses it. */
export type AudioContextLike = {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: NodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createGain(): GainLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  createBufferSource(): SourceLike;
  createOscillator(): OscillatorLike;
  createBiquadFilter(): FilterLike;
  createDynamicsCompressor(): NodeLike;
};

/** A tone: a frequency glide over `dur` seconds. */
export type ToneOpts = { freq: number; to?: number; dur: number; type?: OscillatorType; vol?: number; delay?: number };

/** A noise burst (hits, whooshes), optionally filtered. */
export type NoiseOpts = {
  dur: number;
  vol?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; freq: number };
};

/** The primitives a sound recipe plays with. */
export type SfxKit = { tone(o: ToneOpts): void; noise(o: NoiseOpts): void };

/** One-shot sounds by name: each recipe plays primitives (solitaire/garbage sfx.ts). */
export type SfxRecipe = (s: SfxKit) => void;

/** The game's sound (src/game/audio.ts). */
export type AudioHooks = {
  sfx?: Record<string, SfxRecipe>;
  /** Background music: a Web Worker that runs a MusicCore (src/game/music-worker.ts), and the song message. */
  music?: {
    worker: () => Worker;
    /** The same core on the main thread, when Workers fail (the fallback host). */
    core?: (sampleRate: number) => MusicCore;
    song: Json;
    /** Opt in to an AudioWorklet (secure contexts only; the Worker stays the default). */
    worklet?: { url: string; name: string };
  };
};

/** What the kit gives the game. */
export type KitAudio = {
  /** Play a named sound (nothing when sound is off, or before the first tap). */
  play(name: string): void;
  startMusic(): void;
  stopMusic(): void;
};

/** One synth, three hosts (Worker, main thread, AudioWorklet): bubblepop's core contract. */
export type MusicCore = {
  /** A message from the game (the song, a tempo change, a stem on/off). */
  handle(msg: Json): void;
  /** Fill `left` (and `right`) starting at absolute sample `frame`. Pure in (messages, frame): deterministic. */
  render(left: Float32Array, right: Float32Array | null, frame: number): void;
};
