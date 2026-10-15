/**
 * kit/audio: the hooks a game gives for sound, and what the kit gives back.
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md
 */
import type { Json } from '../core/json.ts';

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
  /** Background music: a Web Worker that runs a MusicCore (src/game/music-worker.ts), and the message that starts a song. */
  music?: { worker(): Worker; song: Json };
};

/** What the kit gives the game. */
export type KitAudio = {
  /** Play a named sound (a no-op when sound is off or before the first tap). */
  play(name: string): void;
  startMusic(): void;
  stopMusic(): void;
};
