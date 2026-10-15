/**
 * kit/audio: music as PCM chunks from a MusicCore, scheduled ahead (dinodasher musicStream).
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md § "Music"
 *
 * Decision 6: music must work over plain http (a LAN IP is not a secure
 * context, so no AudioWorklet there). The default host is a Web Worker that
 * renders chunks; the main thread queues them as AudioBufferSourceNodes about
 * 2.5 s ahead, back to back on sample boundaries. When Workers fail, the same
 * core runs on the main thread. An AudioWorklet is used only when the game
 * opts in AND `isSecureContext` is true.
 */
import type { Clock } from '../core/clock.ts';
import { field, isJson, numField, strField, type Json } from '../core/json.ts';
import type { AudioContextLike, GainLike, MusicCore } from './types.ts';

/** Main → core. */
export type ToCore =
  { type: 'init'; sampleRate: number } | { type: 'msg'; msg: Json } | { type: 'render'; frame: number; frames: number };

/** Core → main: one rendered chunk. */
export type Chunk = { frame: number; left: Float32Array; right: Float32Array; ms: number };

/** Where the core runs (a Worker, or the main thread). */
export type MusicPort = { post(msg: ToCore): void; onChunk: ((c: Chunk) => void) | null; close(): void };

/** Which host to use: the Worker by default; the worklet only when asked for AND secure; the main thread as the fallback. */
export function chooseMusicHost(o: {
  secure: boolean;
  workers: boolean;
  wantWorklet: boolean;
}): 'worklet' | 'worker' | 'main' {
  if (o.wantWorklet && o.secure) return 'worklet';
  return o.workers ? 'worker' : 'main';
}

/** Read a chunk message from the worker (untrusted until checked). */
export function parseChunk(x: unknown): Chunk | null {
  const left = field(x, 'left');
  const right = field(x, 'right');
  if (strField(x, 'type') !== 'chunk' || !(left instanceof Float32Array) || !(right instanceof Float32Array))
    return null;
  return { frame: numField(x, 'frame'), left, right, ms: numField(x, 'ms') };
}

/** The main-thread side of a Worker host. */
export function workerPort(worker: Worker): MusicPort {
  const port: MusicPort = {
    onChunk: null,
    post: (msg) => worker.postMessage(msg),
    close: () => worker.terminate(),
  };
  worker.onmessage = (e: MessageEvent<unknown>) => {
    const c = parseChunk(e.data);
    if (c) port.onChunk?.(c);
  };
  return port;
}

/** The fallback: the same core on the main thread (dinodasher MusicRenderer). */
export function mainThreadPort(makeCore: (sampleRate: number) => MusicCore, clock: Clock): MusicPort {
  let core: MusicCore | null = null;
  const port: MusicPort = {
    onChunk: null,
    post(msg) {
      if (msg.type === 'init') core = makeCore(msg.sampleRate);
      else if (msg.type === 'msg') core?.handle(msg.msg);
      else {
        const c = core;
        if (!c) return;
        clock.after(0, () => port.onChunk?.(renderChunk(c, msg.frame, msg.frames, clock)));
      }
    },
    close: () => (core = null),
  };
  return port;
}

/** Render one chunk with a core (also used inside the worker). */
export function renderChunk(core: MusicCore, frame: number, frames: number, clock: Pick<Clock, 'now'>): Chunk {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const t0 = clock.now();
  core.render(left, right, frame);
  return { frame, left, right, ms: clock.now() - t0 };
}

/** Run a core inside a Worker (call from src/game/music-worker.ts). */
export function hostWorker(
  makeCore: (sampleRate: number) => MusicCore,
  scope: {
    postMessage(msg: unknown, transfer: Transferable[]): void;
    onmessage: ((e: MessageEvent<unknown>) => void) | null;
  },
): void {
  let core: MusicCore | null = null;
  const now = { now: () => performance.now() };
  scope.onmessage = (e) => {
    const type = strField(e.data, 'type');
    if (type === 'init') core = makeCore(numField(e.data, 'sampleRate', 48000));
    else if (type === 'msg') {
      const msg = field(e.data, 'msg');
      if (isJson(msg)) core?.handle(msg);
    } else if (type === 'render' && core) {
      const c = renderChunk(core, numField(e.data, 'frame'), numField(e.data, 'frames'), now);
      scope.postMessage({ type: 'chunk', ...c }, [c.left.buffer, c.right.buffer]);
    }
  };
}

/** The stream: requests chunks ahead and schedules them back to back. */
export class MusicStream {
  /** Chunks that arrived too late to play on time. */
  underruns = 0;
  /** The slowest chunk render (ms). */
  maxRenderMs = 0;
  private nextFrame = 0;
  private nextTime = 0;
  private inflight = 0;
  private started = false;
  private stopTimer: (() => void) | null = null;
  private readonly ctx: AudioContextLike;
  private readonly out: GainLike;
  private readonly port: MusicPort;
  private readonly clock: Clock;
  private readonly chunk: number;
  private readonly aheadS: number;
  private readonly maxInflight: number;

  constructor(
    ctx: AudioContextLike,
    out: GainLike,
    port: MusicPort,
    clock: Clock,
    o: { chunk?: number; aheadS?: number; maxInflight?: number } = {},
  ) {
    this.ctx = ctx;
    this.out = out;
    this.port = port;
    this.clock = clock;
    this.chunk = o.chunk ?? 8192;
    this.aheadS = o.aheadS ?? 2.5;
    this.maxInflight = o.maxInflight ?? 4;
    port.onChunk = (c) => this.schedule(c);
  }

  /** Start with a song message. */
  start(song: Json): void {
    this.port.post({ type: 'init', sampleRate: this.ctx.sampleRate });
    this.port.post({ type: 'msg', msg: song });
    const loop = (): void => {
      this.tick();
      this.stopTimer = this.clock.after(200, loop);
    };
    loop();
  }

  /** A message for the core (a stem, the tempo). */
  send(msg: Json): void {
    this.port.post({ type: 'msg', msg });
  }

  /** Ask for chunks until `aheadS` seconds are queued (at most `maxInflight` at once). */
  tick(): void {
    if (this.ctx.state !== 'running') return;
    const queued = this.nextTime - this.ctx.currentTime;
    const pending = (this.inflight * this.chunk) / this.ctx.sampleRate;
    if (queued + pending >= this.aheadS || this.inflight >= this.maxInflight) return;
    this.port.post({ type: 'render', frame: this.nextFrame, frames: this.chunk });
    this.nextFrame += this.chunk;
    this.inflight++;
  }

  private schedule(c: Chunk): void {
    this.inflight = Math.max(0, this.inflight - 1);
    this.maxRenderMs = Math.max(this.maxRenderMs, c.ms);
    const now = this.ctx.currentTime;
    if (!this.started || this.nextTime < now + 0.01) {
      if (this.started) this.underruns++;
      this.nextTime = now + 0.05;
      this.started = true;
    }
    const buf = this.ctx.createBuffer(2, c.left.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(c.left);
    buf.getChannelData(1).set(c.right);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    src.start(this.nextTime);
    this.nextTime += c.left.length / this.ctx.sampleRate;
    this.tick();
  }

  stop(): void {
    this.stopTimer?.();
    this.stopTimer = null;
    this.port.close();
  }
}

/**
 * OPT-IN: run the core in an AudioWorklet (sample-accurate; bubblepop). Only in
 * a secure context, only on a real AudioContext, and any failure returns
 * false so the caller falls back to the Worker. The processor file (`url`)
 * registers `name` and answers `{ type: 'msg', msg }` like hostWorker.
 */
export async function hostWorklet(
  ctx: AudioContextLike,
  out: GainLike,
  url: string,
  name: string,
  song: Json,
  secure: boolean,
): Promise<boolean> {
  if (!secure || typeof AudioWorkletNode !== 'function' || !(ctx instanceof AudioContext) || !(out instanceof GainNode))
    return false;
  try {
    await ctx.audioWorklet.addModule(url);
    const node = new AudioWorkletNode(ctx, name, { outputChannelCount: [2] });
    node.connect(out);
    node.port.postMessage({ type: 'msg', msg: song });
    return true;
  } catch {
    return false;
  }
}
