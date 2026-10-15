// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  AudioEngine,
  chooseMusicHost,
  createKitAudio,
  curve,
  mainThreadPort,
  MusicStream,
  parseChunk,
  renderChunk,
  sfxKit,
  throttleSfx,
} from '../../../src/kit/audio/index.ts';
import { createStore, hashJson } from '../../../src/kit/core/index.ts';
import { createSettings } from '../../../src/kit/save/settings.ts';
import { kitSettingsDefaults } from '../../../src/kit/settings-ui/index.ts';
import { fakeAudioContext, fakeClock, fakeStorage, type FakeAudioContext } from '../../../src/kit/testing/index.ts';
import { SongCore } from '../../../src/game/music-core.ts';

function engineWith(): { engine: AudioEngine; ctx: FakeAudioContext } {
  const ctx = fakeAudioContext();
  return { engine: new AudioEngine(() => ctx), ctx };
}

describe('audio engine', () => {
  it('unlock creates the context once and resumes it every time, also after iOS "interrupted"', () => {
    let made = 0;
    const ctx = fakeAudioContext();
    const engine = new AudioEngine(() => {
      made++;
      return ctx;
    });
    engine.unlock();
    engine.unlock();
    expect(made).toBe(1);
    expect(engine.running).toBe(true);
    ctx.state = 'interrupted';
    engine.unlock();
    expect(ctx.state).toBe('running');
    expect(ctx.resumes).toBe(2);
  });

  it('unlocks on a gesture, suspends while hidden and resumes when shown', () => {
    const { engine, ctx } = engineWith();
    const off = engine.installUnlock(window);
    const offVis = engine.watchVisibility(document);
    window.dispatchEvent(new Event('pointerdown'));
    expect(engine.running).toBe(true);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.state).toBe('suspended');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.state).toBe('running');
    off();
    offVis();
  });

  it('volumes follow a v² curve, off is silence, and duck lowers the music', () => {
    expect(curve(true, 0.5)).toBe(0.25);
    expect(curve(false, 1)).toBe(0);
    const { engine, ctx } = engineWith();
    engine.unlock();
    engine.setMusicVolume(0.5);
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.25);
    engine.duck(true);
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.075);
    engine.setSfx(false);
    expect(ctx.gains[1]?.gain.value).toBe(0);
  });

  it('sfx primitives start sources; a burst of the same sound is throttled', () => {
    const { engine, ctx } = engineWith();
    engine.unlock();
    const s = sfxKit(engine);
    s.tone({ freq: 440, dur: 0.1 });
    s.noise({ dur: 0.1, filter: { type: 'lowpass', freq: 800 } });
    expect(ctx.started.map((x) => x.kind)).toEqual(['buffer', 'osc', 'buffer']);
    let t = 0;
    let plays = 0;
    const throttle = throttleSfx(() => t, 3, 100);
    for (let i = 0; i < 10; i++) throttle('coin', () => plays++);
    t = 150;
    throttle('coin', () => plays++);
    expect(plays).toBe(4);
  });
});

describe('music', () => {
  it('only uses an AudioWorklet in a secure context when asked; the Worker is the default over plain http', () => {
    expect(chooseMusicHost({ secure: false, workers: true, wantWorklet: true })).toBe('worker');
    expect(chooseMusicHost({ secure: true, workers: true, wantWorklet: true })).toBe('worklet');
    expect(chooseMusicHost({ secure: true, workers: true, wantWorklet: false })).toBe('worker');
    expect(chooseMusicHost({ secure: false, workers: false, wantWorklet: false })).toBe('main');
  });

  it('a MusicCore renders the same samples for the same song (snapshot)', () => {
    const render = () => {
      const core = new SongCore(48000);
      core.handle({ bpm: 108, root: 45, volume: 0.18 });
      return renderChunk(core, 96000, 512, { now: () => 0 });
    };
    const a = render();
    expect([...a.left.slice(0, 64)]).toEqual([...render().left.slice(0, 64)]);
    expect(hashJson([...a.left].map((v) => Math.round(v * 1e6)))).toMatchInlineSnapshot(`"042e72d1918d5b6f"`);
  });

  it('the stream schedules chunks back to back on sample boundaries, ahead of time, and counts underruns', async () => {
    const clock = fakeClock(0);
    const ctx = fakeAudioContext(48000);
    ctx.state = 'running';
    const port = mainThreadPort((sr) => new SongCore(sr), clock);
    const stream = new MusicStream(ctx, ctx.createGain(), port, clock, { chunk: 4800, aheadS: 0.5, maxInflight: 2 });
    stream.start({ bpm: 108, root: 45, volume: 0.18 });
    for (let i = 0; i < 20; i++) clock.advance(10);
    await clock.settle();
    const starts = ctx.started.map((s) => s.at);
    expect(starts.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeCloseTo((starts[i - 1] ?? 0) + 0.1, 6);
    expect(stream.underruns).toBe(0);
    ctx.currentTime = 100; // a long stall: the next chunk is late
    clock.advance(400);
    expect(stream.underruns).toBe(1);
    stream.stop();
  });

  it('chunk messages from a worker are checked', () => {
    expect(
      parseChunk({ type: 'chunk', frame: 1, left: new Float32Array(2), right: new Float32Array(2), ms: 3 }),
    ).not.toBeNull();
    expect(parseChunk({ type: 'chunk', left: [1], right: [1] })).toBeNull();
  });

  it('the kit plays named sounds only when sound is on, and reports telemetry', () => {
    const ctx = fakeAudioContext();
    const kv = fakeStorage();
    const settings = createSettings(
      { key: 's', version: 1, defaults: kitSettingsDefaults },
      createStore(() => kv),
    );
    let played = 0;
    const audio = createKitAudio({
      hooks: { sfx: { coin: () => void played++ } },
      settings,
      clock: fakeClock(0),
      create: () => ctx,
      secure: false,
    });
    audio.play('coin');
    expect(played).toBe(0); // not unlocked yet
    window.dispatchEvent(new Event('pointerdown'));
    audio.play('coin');
    settings.set({ sound: false });
    audio.play('coin');
    expect(played).toBe(1);
    expect(audio.telemetry()).toMatchObject({ unlocked: true, underruns: 0 });
    audio.dispose();
  });
});
