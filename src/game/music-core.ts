/**
 * The game's music synth: a MusicCore (no Web Audio nodes inside, so it runs in a Worker,
 * on the main thread, or in an AudioWorklet). (GAME: yours to edit; docs/kit/audio.md § "Music".)
 *
 * Pure in (song, frame): the same song renders the same samples, so it can be
 * snapshot-tested. TODO(game): your song.
 */
import type { MusicCore } from '../kit/audio/types.ts';
import type { Json } from '../kit/core/index.ts';

/** The song message. */
export type Song = { bpm: number; root: number; volume: number };

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const PROGRESSION = [0, 5, 3, 4];

const isSong = (x: Json): x is Song =>
  typeof x === 'object' &&
  x !== null &&
  !Array.isArray(x) &&
  typeof x.bpm === 'number' &&
  typeof x.root === 'number' &&
  typeof x.volume === 'number';

/** A soft bass + arpeggio loop. */
export class SongCore implements MusicCore {
  private song: Song = { bpm: 108, root: 45, volume: 0.18 };
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  handle(msg: Json): void {
    if (isSong(msg)) this.song = msg;
  }

  render(left: Float32Array, right: Float32Array | null, frame: number): void {
    const { bpm, root, volume } = this.song;
    const beatLen = (60 / bpm) * this.sampleRate;
    for (let i = 0; i < left.length; i++) {
      const n = frame + i;
      const beat = Math.floor(n / beatLen);
      const inBeat = (n % beatLen) / beatLen;
      const chord = PROGRESSION[Math.floor(beat / 4) % PROGRESSION.length] ?? 0;
      const step = Math.floor(inBeat * 4);
      const arpNote = root + 12 + chord + (SCALE[(beat * 4 + step) % SCALE.length] ?? 0);
      const t = n / this.sampleRate;
      const bassF = 440 * 2 ** ((root + chord - 69) / 12);
      const arpF = 440 * 2 ** ((arpNote - 69) / 12);
      const arpEnv = Math.exp(-((inBeat * 4) % 1) * 6);
      const bass = Math.sin(2 * Math.PI * bassF * t) * 0.6 * (1 - inBeat * 0.5);
      const arp = (Math.sin(2 * Math.PI * arpF * t) > 0 ? 1 : -1) * 0.18 * arpEnv;
      const s = (bass + arp) * volume;
      left[i] = s;
      if (right) right[i] = bass * volume + arp * volume * 0.7;
    }
  }
}
