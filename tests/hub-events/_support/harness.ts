/**
 * tests/hub-events: boot the stub game on a FakeHub, the way the hub would load it.
 * Source: dg-template tests/hub-events/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Hub-event tests"
 *
 * The suites run the KIT against the stub game's real hooks (src/game/hooks.ts)
 * with a recording view instead of a renderer, so they test the kit contract,
 * not pixels: a game that replaces the stubs keeps them green.
 */
import { defineGame, type GameDefinition, type GameHandle } from '../../../src/kit/boot/index.ts';
import { createStore } from '../../../src/kit/core/index.ts';
import type { KitStrings } from '../../../src/kit/core/strings.ts';
import { setKitStrings } from '../../../src/kit/core/strings.ts';
import {
  CallLog,
  createFakeHub,
  fakeStorage,
  type FakeHub,
  type FakeHubOptions,
} from '../../../src/kit/testing/index.ts';
import type { GameTestHook } from '../../../src/kit/test-hook/index.ts';
import { createGame } from '../../../src/game/hooks.ts';
import type { Profile, Run } from '../../../src/game/state.ts';

/** A booted stub game. */
export type Booted = {
  fake: FakeHub;
  /** The game's hook calls (newRun, onResult, screens…). */
  calls: CallLog;
  handle: GameHandle<Profile, Run>;
  hook: GameTestHook;
  /** Run `n` frames (16 ms each), letting promises settle. */
  frames(n: number): Promise<void>;
  /** Let promises settle without moving time. */
  settle(): Promise<void>;
  /** The kit UI's element. */
  ui: HTMLElement;
  /** Press a kit button by its data-testid. */
  press(testid: string): void;
  /** Start a new normal game and let it settle (newGame is async: the late-load guard). */
  start(): Promise<void>;
};

/** Wrap a definition so its hook calls are recorded. */
function recording(game: GameDefinition<Profile, Run>, calls: CallLog): GameDefinition<Profile, Run> {
  return {
    ...game,
    newRun: (ctx, opts) => {
      calls.record('newRun', { mode: opts.mode, seed: opts.seed, day: opts.day ?? null });
      return game.newRun(ctx, opts);
    },
    onResult: (ctx, run, outcome) => {
      calls.record('onResult', outcome);
      game.onResult?.(ctx, run, outcome);
    },
    screens: {
      ...game.screens,
      title: (ctx, el, info) => {
        calls.record('screen.title', info);
        game.screens?.title?.(ctx, el, info);
      },
      pause: (ctx, el) => {
        calls.record('screen.pause');
        game.screens?.pause?.(ctx, el);
      },
      result: (ctx, el, info) => {
        calls.record('screen.result', info.outcome, info.mode);
        game.screens?.result?.(ctx, el, info);
      },
    },
  };
}

let previous: GameHandle<Profile, Run> | null = null;

/** Boot the stub game on a fresh FakeHub (the previous one is disposed). */
export async function bootGame(
  o: {
    fake?: FakeHubOptions;
    search?: string;
    patch?: Partial<GameDefinition<Profile, Run>>;
    before?(fake: FakeHub): void;
    strings?: Partial<KitStrings>;
  } = {},
): Promise<Booted> {
  previous?.dispose();
  document.body.replaceChildren();
  const app = document.createElement('div');
  app.id = 'app';
  const ui = document.createElement('div');
  ui.id = 'ui';
  document.body.append(app, ui);
  delete document.body.dataset.ready;
  setKitStrings(o.strings ?? {});
  const fake = createFakeHub({ events: new EventTarget(), ...o.fake });
  o.before?.(fake);
  const calls = new CallLog();
  const base = createGame(() => ({
    mount: () => Promise.resolve(),
    draw: () => undefined,
    collected: () => calls.record('view.collected'),
  }));
  const kv = fakeStorage();
  const handle = defineGame(
    fake,
    { ...recording(base, calls), ...o.patch },
    {
      clock: fake.clock,
      store: createStore(() => kv),
      events: fake.events,
      search: o.search ?? '',
      drivers: true,
      stage: app,
      uiRoot: ui,
    },
  );
  previous = handle;
  let booted = false;
  void handle.booted.then(() => (booted = true));
  const settle = (): Promise<void> => fake.clock.settle();
  for (let i = 0; i < 100 && !booted; i++) {
    await settle();
    fake.clock.advance(50);
  }
  await settle();
  const hook = window.__game;
  if (!hook) throw new Error('window.__game was not installed');
  return {
    fake,
    calls,
    handle,
    hook,
    ui,
    settle,
    async frames(n) {
      for (let i = 0; i < n; i++) {
        fake.clock.advance(16);
        if (i % 4 === 3) await settle();
      }
      await settle();
    },
    async start() {
      hook.newGame?.();
      await settle();
    },
    press(testid) {
      const el = ui.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
      if (!el) throw new Error(`no [data-testid="${testid}"] on screen ${ui.dataset.screen ?? '?'}`);
      el.click();
    },
  };
}
