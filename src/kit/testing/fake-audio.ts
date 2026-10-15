/**
 * kit/testing: a fake AudioContext (the Web Audio subset the kit uses), with a clock you move.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 */
import type {
  AudioContextLike,
  BufferLike,
  FilterLike,
  GainLike,
  NodeLike,
  OscillatorLike,
  ParamLike,
  SourceLike,
} from '../audio/types.ts';

/** A fake context plus what it recorded. */
export type FakeAudioContext = AudioContextLike & {
  currentTime: number;
  state: string;
  /** Every source started, with its start time and length in seconds. */
  readonly started: { at: number; duration: number; kind: 'buffer' | 'osc' }[];
  /** Calls to resume (unlock attempts). */
  resumes: number;
  /** Gains by creation order (index 0 and 1 are the engine's music and SFX buses). */
  readonly gains: GainLike[];
};

function param(initial = 0): ParamLike {
  const p: ParamLike = {
    value: initial,
    setValueAtTime: (v) => (p.value = v),
    linearRampToValueAtTime: (v) => (p.value = v),
    exponentialRampToValueAtTime: (v) => (p.value = v),
    setTargetAtTime: (v) => (p.value = v),
  };
  return p;
}

function node(): NodeLike {
  return { connect: (d) => d, disconnect: () => undefined };
}

/** A fake AudioContext starting `suspended` (like a real one before a gesture). */
export function fakeAudioContext(sampleRate = 48000): FakeAudioContext {
  const started: FakeAudioContext['started'] = [];
  const gains: GainLike[] = [];
  const ctx: FakeAudioContext = {
    currentTime: 0,
    sampleRate,
    state: 'suspended',
    resumes: 0,
    started,
    gains,
    destination: node(),
    resume() {
      ctx.resumes++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      ctx.state = 'suspended';
      return Promise.resolve();
    },
    createGain() {
      const g: GainLike = { ...node(), gain: param(1) };
      gains.push(g);
      return g;
    },
    createBuffer(channels, length, sr): BufferLike {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, duration: length / sr, getChannelData: (c) => data[c] ?? new Float32Array(length) };
    },
    createBufferSource(): SourceLike {
      const s: SourceLike = {
        ...node(),
        buffer: null,
        onended: null,
        start: (when = 0) => started.push({ at: when, duration: s.buffer?.duration ?? 0, kind: 'buffer' }),
        stop: () => undefined,
      };
      return s;
    },
    createOscillator(): OscillatorLike {
      return {
        ...node(),
        type: 'sine',
        frequency: param(440),
        start: (when = 0) => started.push({ at: when, duration: 0, kind: 'osc' }),
        stop: () => undefined,
      };
    },
    createBiquadFilter(): FilterLike {
      return { ...node(), type: 'lowpass', frequency: param(350) };
    },
    createDynamicsCompressor: node,
  };
  return ctx;
}
