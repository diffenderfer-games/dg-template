/**
 * kit/audio: the game's sound as the kit runs it (settings, unlock, SFX by name, music by host choice).
 * Source: dg-template src/kit/audio/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/audio.md
 */
import type { Clock } from '../core/clock.ts';
import type { JsonObject } from '../core/json.ts';
import type { SettingsStore } from '../save/settings.ts';
import type { KitSettings } from '../settings-ui/index.ts';
import { AudioEngine } from './engine.ts';
import { chooseMusicHost, hostWorklet, mainThreadPort, MusicStream, workerPort, type MusicPort } from './music.ts';
import { sfxKit, throttleSfx } from './sfx.ts';
import type { AudioContextLike, AudioHooks, KitAudio } from './types.ts';

/** The running audio, with telemetry for tests and screenshots. */
export type RunningAudio = KitAudio & {
  readonly engine: AudioEngine;
  /** `{ unlocked, host, underruns, maxRenderMs }` (the `play` screenshot and the http audio check read it). */
  telemetry(): JsonObject;
  /** Lower the music (pause screen). */
  duck(on: boolean): void;
  dispose(): void;
};

/** The browser's AudioContext, or null where there is none. */
export function browserContext(): AudioContextLike | null {
  return typeof AudioContext === 'function' ? new AudioContext() : null;
}

/** Wire the game's sound: unlock on gestures, follow the settings, suspend when hidden. */
export function createKitAudio(o: {
  hooks: AudioHooks | undefined;
  settings: SettingsStore<KitSettings>;
  clock: Clock;
  create?: () => AudioContextLike | null;
  target?: EventTarget;
  doc?: Document;
  secure?: boolean;
}): RunningAudio {
  const engine = new AudioEngine(o.create ?? browserContext);
  const applySettings = (s: KitSettings): void => {
    engine.setSfx(s.sound);
    engine.setMusic(s.music);
    engine.setSfxVolume(s.sfxVolume);
    engine.setMusicVolume(s.musicVolume);
  };
  applySettings(o.settings.data);
  const offs = [o.settings.onChange(applySettings), engine.installUnlock(o.target), engine.watchVisibility(o.doc)];
  const throttle = throttleSfx(() => o.clock.now());
  let stream: MusicStream | null = null;
  let host: string = 'none';
  let wantMusic = false;

  const secure = o.secure ?? (typeof isSecureContext === 'boolean' && isSecureContext);
  const startStream = (ctx: AudioContextLike, allowWorklet = true): void => {
    const music = o.hooks?.music;
    const bus = engine.music;
    if (!music || !bus || stream) return;
    const worklet = allowWorklet ? music.worklet : undefined;
    host = chooseMusicHost({ secure, workers: typeof Worker === 'function', wantWorklet: worklet !== undefined });
    if (host === 'worklet' && worklet) {
      void hostWorklet(ctx, bus, worklet.url, worklet.name, music.song, secure).then((ok) => {
        if (!ok) startStream(ctx, false);
      });
      return;
    }
    let port: MusicPort | null = null;
    if (host === 'worker') {
      try {
        port = workerPort(music.worker());
      } catch {
        host = 'main';
      }
    }
    if (port === null && music.core) {
      host = 'main';
      const makeCore = music.core;
      port = mainThreadPort((sr) => makeCore(sr), o.clock);
    }
    if (port === null) return;
    stream = new MusicStream(ctx, bus, port, o.clock);
    stream.start(music.song);
  };

  // Music asked for before the first gesture starts on that gesture.
  const lateStart = (): void => {
    if (wantMusic && engine.ctx && !stream) startStream(engine.ctx);
  };
  const target = o.target ?? window;
  for (const e of ['pointerdown', 'keydown', 'touchend']) target.addEventListener(e, lateStart, { passive: true });
  offs.push(() => {
    for (const e of ['pointerdown', 'keydown', 'touchend']) target.removeEventListener(e, lateStart);
  });

  return {
    engine,
    play(name) {
      const recipe = o.hooks?.sfx?.[name];
      if (!recipe || !engine.sfxOn || !engine.running) return;
      throttle(name, () => recipe(sfxKit(engine)));
    },
    startMusic() {
      wantMusic = true;
      engine.unlock();
      if (engine.ctx) startStream(engine.ctx);
    },
    stopMusic() {
      wantMusic = false;
      stream?.stop();
      stream = null;
    },
    duck: (on) => engine.duck(on),
    telemetry: () => ({
      unlocked: engine.running,
      host,
      wantMusic,
      underruns: stream?.underruns ?? 0,
      maxRenderMs: Math.round(stream?.maxRenderMs ?? 0),
    }),
    dispose() {
      stream?.stop();
      for (const off of offs) off();
    },
  };
}
