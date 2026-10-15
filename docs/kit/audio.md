# kit/audio

Source: `src/kit/audio/` (KIT: copy byte-identical; change it in the template first).

Your game's sound: effects by name, and music that is synthesized off the main thread.

## The rules

- Music and other continuous procedural audio are synthesized in a Web Worker and streamed to the main thread as PCM chunks. The main thread only queues finished buffers. Do not build music from live Web Audio nodes on the main thread.
- Short one-shot sound effects may stay on the main thread.
- AudioWorklet is opt-in, and only used when `isSecureContext` is true. It silently fails on the `http://192.168.x.x` LAN URLs used for phone testing. The Worker is the default.
- The context is created and resumed on every user gesture (iOS), and suspended while the page is hidden.
- Test on a phone with a production build over the LAN. No gaps under load.

Why: on phones, building every note from live nodes and scheduling them from `setInterval` breaks up. Game frames delay the scheduler, and dozens of live nodes overload the real-time audio thread. Dino Dasher shipped that way and stuttered. Moving the synth into a worker fixed it (a 170 ms chunk took 2 to 13 ms to render on a laptop, and a 90-second run had zero gaps).

## What the game does

Three files, all yours to edit:

- `src/game/audio.ts` exports `audio: AudioHooks`. It holds the `sfx` recipes and the `music` hook.
- `src/game/music-core.ts` holds your `MusicCore` (the template has `SongCore`, a bass and arpeggio loop).
- `src/game/music-worker.ts` is a three-line host. It usually never changes.

A sound effect is a recipe of primitives:

```ts
import type { AudioHooks } from '../kit/audio/types.ts';
import { SongCore, type Song } from './music-core.ts';

const SONG: Song = { bpm: 108, root: 45, volume: 0.18 };

export const audio: AudioHooks = {
  sfx: {
    coin: (s) => {
      s.tone({ freq: 880, to: 1320, dur: 0.09, type: 'triangle', vol: 0.25 });
      s.tone({ freq: 1320, to: 1760, dur: 0.12, type: 'triangle', vol: 0.18, delay: 0.06 });
    },
    tap: (s) => s.noise({ dur: 0.05, vol: 0.15, filter: { type: 'highpass', freq: 2000 } }),
  },
  music: {
    worker: () => new Worker(new URL('./music-worker.ts', import.meta.url), { type: 'module' }),
    core: (sampleRate) => new SongCore(sampleRate), // the main-thread fallback
    song: SONG,
  },
};
```

A `MusicCore` has two methods and no Web Audio nodes inside, so the same code runs in a Worker, on the main thread, or in an AudioWorklet:

- `handle(msg)`: a message from the game (the song, a tempo change, a stem on or off).
- `render(left, right, frame)`: fill the buffers starting at absolute sample `frame`. It is pure in (messages, frame), so the same song renders the same samples and can be snapshot-tested.

Render at the `sampleRate` the core is given. Mismatched rates make chunk seams click.

## What the kit does

`defineGame` calls `createKitAudio` for you and puts the result on `ctx.audio`. The game calls `ctx.audio.play('coin')`.

- **Engine** (`AudioEngine`): music and SFX buses, then a compressor, then the output. The context is created on the first gesture and resumed on every later one, including from iOS `interrupted`. A silent buffer is started inside the gesture. It suspends on `visibilitychange` when hidden and resumes when shown.
- **Volumes** follow a v-squared curve (a slider at half is a quarter of the power). Sound and music on/off and both volumes follow the player's settings. `duck(true)` lowers the music to 0.3 (the pause screen does this).
- **SFX**: `play(name)` does nothing when sound is off or before the first tap. A burst of the same sound is throttled to 3 plays per 100 ms. Noise comes from a fixed pattern, not `Math.random`.
- **Music host**, chosen by `chooseMusicHost`: the worklet only when the game opts in AND the context is secure; otherwise a Worker; otherwise the main thread (when the game gives `core`). If the worklet fails to load, the Worker is used.
- **MusicStream**: asks for 8192-frame chunks, keeps about 2.5 s queued with at most 4 in flight, and schedules them back to back on sample boundaries. A chunk that arrives late counts an underrun. Chunks are transferred, not copied.
- Music asked for before the first gesture starts on that gesture.
- Instant controls (volume, duck, pause) stay on the main thread. Tempo, mood and stems are messages to the core (`stream.send`); their latency of about 2 s is fine.

## Rules enforced

- Music in a Worker, not main-thread node graphs: this doc is the rule (the hub docs do not cover audio), and `chooseMusicHost` enforces it.
- The context unlocks on a gesture, which matches the pause and focus behaviour in [Pausing when the hub opens](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).
- The hub UI ducks the music: `session` calls `duck(true)` on pause.

## API

| Name | What it is |
|---|---|
| `AudioHooks` | `{ sfx?, music? }`, the game's sound (`src/game/audio.ts`) |
| `MusicCore` | `handle(msg)` and `render(left, right, frame)` |
| `SfxRecipe`, `SfxKit` | a recipe calls `tone(ToneOpts)` and `noise(NoiseOpts)` |
| `createKitAudio(o)` | wires settings, unlock, SFX and music; returns `RunningAudio` |
| `RunningAudio` | `play`, `startMusic`, `stopMusic`, `duck`, `telemetry`, `dispose`, `engine` |
| `AudioEngine` | `unlock`, `installUnlock`, `watchVisibility`, `setMusic`, `setSfx`, volumes, `duck` |
| `curve(on, volume)` | the v-squared loudness curve |
| `sfxKit(engine)`, `throttleSfx(now, cap, windowMs)` | the primitives and the burst throttle |
| `chooseMusicHost({ secure, workers, wantWorklet })` | `'worklet'`, `'worker'` or `'main'` |
| `hostWorker(makeCore, scope)` | run a core inside a Worker (`music-worker.ts`) |
| `workerPort`, `mainThreadPort`, `renderChunk`, `parseChunk` | the hosts and the checked chunk message |
| `MusicStream` | `start(song)`, `send(msg)`, `tick()`, `stop()`, `underruns`, `maxRenderMs` |
| `hostWorklet(ctx, out, url, name, song, secure)` | opt-in worklet; returns false on any failure |
| `AudioContextLike` and friends | the Web Audio subset the kit uses, so tests can use `fakeAudioContext()` |

## Telemetry

`window.__game.audio()` returns `{ unlocked, host, wantMusic, underruns, maxRenderMs }`. `host` is `none`, `worker`, `main` or `worklet`. The `play` screenshot and the http audio check read it. Expect `underruns` to stay 0 and `maxRenderMs` to stay well under the chunk length (about 170 ms) on a phone.

## Tests

`tests/kit/audio/audio.test.ts` covers: unlock once and resume every time (also after iOS `interrupted`), gesture and visibility handling, the volume curve and duck, the SFX primitives and throttle, the host choice (worklet only when secure and asked), the deterministic core snapshot, back-to-back scheduling with underrun counting, checked chunk messages, and the kit's telemetry. Use `fakeAudioContext()` and the fake clock from `kit/testing`.

## Hub API used

None. Audio does not call the hub. It reads the player's sound settings from `kit/save` settings.
