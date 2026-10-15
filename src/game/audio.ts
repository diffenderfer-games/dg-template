/**
 * The game's sounds and music. (GAME: yours to edit; docs/kit/audio.md.)
 *
 * Sound effects are recipes of short primitives (tones, noise). Music is a
 * MusicCore in a Web Worker: it works over plain http too (no AudioWorklet).
 * The player's sound and music settings are applied by the kit.
 */
import type { AudioHooks } from '../kit/audio/types.ts';
import { SongCore, type Song } from './music-core.ts';

const SONG: Song = { bpm: 108, root: 45, volume: 0.18 };

/** TODO(game): your sounds and song. */
export const audio: AudioHooks = {
  sfx: {
    coin: (s) => {
      s.tone({ freq: 880, to: 1320, dur: 0.09, type: 'triangle', vol: 0.25 });
      s.tone({ freq: 1320, to: 1760, dur: 0.12, type: 'triangle', vol: 0.18, delay: 0.06 });
    },
    win: (s) =>
      [523, 659, 784, 1047].forEach((f, i) =>
        s.tone({ freq: f, dur: 0.18, type: 'square', vol: 0.12, delay: i * 0.1 }),
      ),
    lose: (s) => s.tone({ freq: 330, to: 140, dur: 0.5, type: 'sawtooth', vol: 0.1 }),
    tap: (s) => s.noise({ dur: 0.05, vol: 0.15, filter: { type: 'highpass', freq: 2000 } }),
  },
  music: {
    worker: () => new Worker(new URL('./music-worker.ts', import.meta.url), { type: 'module' }),
    core: (sampleRate) => new SongCore(sampleRate),
    song: SONG,
  },
};
