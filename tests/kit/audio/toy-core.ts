/**
 * tests/kit/audio: a kit-owned MusicCore for the audio tests, so changing a game's song never fails a kit test.
 * Source: dg-template tests/kit/audio/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 */
import type { MusicCore } from '../../../src/kit/audio/types.ts';
import type { Json } from '../../../src/kit/core/index.ts';

/** A pure tone that steps through a small scale each beat; `{ bpm, root, volume }` changes it. */
export class ToyCore implements MusicCore {
  private bpm = 120;
  private root = 57;
  private volume = 0.2;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  handle(msg: Json): void {
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;
    if (typeof msg.bpm === 'number') this.bpm = msg.bpm;
    if (typeof msg.root === 'number') this.root = msg.root;
    if (typeof msg.volume === 'number') this.volume = msg.volume;
  }

  render(left: Float32Array, right: Float32Array | null, frame: number): void {
    const beatLen = (60 / this.bpm) * this.sampleRate;
    for (let i = 0; i < left.length; i++) {
      const n = frame + i;
      const note = this.root + ([0, 4, 7, 12][Math.floor(n / beatLen) % 4] ?? 0);
      const s = Math.sin((2 * Math.PI * 440 * 2 ** ((note - 69) / 12) * n) / this.sampleRate) * this.volume;
      left[i] = s;
      if (right) right[i] = s;
    }
  }
}
