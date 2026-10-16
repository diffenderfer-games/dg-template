/**
 * tests/hub-events: boot the game on a FakeHub, the way the hub would load it.
 * Source: dg-template tests/hub-events/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Hub-event tests"
 *
 * The suites run the KIT against the game's real hooks (src/game/hooks.ts)
 * with a recording view instead of a renderer, so they test the kit contract,
 * not pixels. They ask the game for everything else (its saved games, its
 * profile, its race param) and need only the test contract
 * (docs/kit/testing.md § "What the kit's tests need from your game"); the
 * suites of features the game doesn't declare are skipped (`HAS`).
 */
import { describe } from 'vitest';
import { game as block } from '../../../package.json';
import { field, isJson, isJsonObject, type Json, type JsonObject } from '../../../src/kit/core/json.ts';
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

/** A booted game. */
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
    step: (ctx, run, dt) => {
      calls.record('step');
      game.step(ctx, run, dt);
    },
    result: (run, outcome) => {
      const numbers = game.result?.(run, outcome) ?? {};
      calls.record('result', numbers);
      return numbers;
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

/** Boot the game on a fresh FakeHub (the previous one is disposed). */
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

// ---- What this game declares, and its shapes (the suites ask the game instead of assuming one) ----

/** The game's hooks, once, to see which optional features it has (and ask it for its shapes). */
export const PROBE = createGame(() => ({ mount: () => Promise.resolve(), draw: () => undefined }));

/** The features this game has (hooks and package.json `game` block); the other features' suites are skipped. */
export const HAS = {
  daily: PROBE.daily !== undefined && field(block, 'dailyChallenges') === true,
  race: PROBE.race !== undefined && field(block, 'race') !== undefined,
  online: PROBE.online !== undefined && field(block, 'multiplayer') !== undefined,
  turns: PROBE.turns !== undefined && field(block, 'turns') !== undefined,
  resume: field(block, 'resumable') === true,
  /** src/game/avatar.ts: the title's bust and players' reactions. */
  avatar: PROBE.avatar !== undefined,
};

/** `describe` for a feature this game has, else `describe.skip` with the reason in the name. */
export function describeIf(has: boolean, why: string): (name: string, fn: () => void) => void {
  return (name, fn) => (has ? describe(name, fn) : describe.skip(`${name} [skipped: ${why}]`, fn));
}

/** The first race param (`game.race.params[0]`): its key and default. */
export const RACE_PARAM: { key: string; value: string | number | boolean } | null = (() => {
  const params = field(field(block, 'race'), 'params');
  const first: unknown = Array.isArray(params) ? params[0] : undefined;
  const key = field(first, 'key');
  const value = field(first, 'default');
  const ok = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  return typeof key === 'string' && ok ? { key, value } : null;
})();

/** What `resume.save` stores. */
export type SavedGame = Parameters<FakeHub['resume']['save']>[0];

/** A game in progress as this game saves it: a new normal game, `score` added, paused (which saves). */
export async function savedGame(score: number): Promise<SavedGame> {
  const g = await bootGame();
  await g.start();
  await g.frames(2);
  g.hook.addScore?.(score);
  g.hook.pause?.();
  const saved = g.fake.resume.stored;
  if (!saved) throw new Error('pausing a normal game saved nothing for Continue (is game.resumable set?)');
  const { savedAt: _, ...input } = saved;
  return input;
}

/** A day in progress as this game saves it (`daily.save`): the day started, `score` added, paused. */
export async function savedDay(day: string, score: number): Promise<{ state: JsonObject; version: number }> {
  const g = await bootGame();
  await g.fake.daily.start(day);
  await g.frames(2);
  g.hook.addScore?.(score);
  g.hook.pause?.();
  const input = field(g.fake.log.last('daily.save')?.args[0], 'state');
  const version = field(g.fake.log.last('daily.save')?.args[0], 'version');
  if (!isJsonObject(input)) throw new Error('pausing a daily saved nothing to the day');
  return { state: input, version: typeof version === 'number' ? version : 0 };
}

/** Finish a normal game with `score` points (the test contract's `addScore`, then `loseNow`). */
export async function playTo(g: Booted, score: number): Promise<void> {
  await g.start();
  g.hook.addScore?.(score);
  g.hook.loseNow?.();
  await g.frames(2);
}

/** The profile save (`{ v, data }`) this game pushes after normal games ending with these scores. */
export async function profileAfter(...scores: number[]): Promise<Json> {
  const g = await bootGame();
  for (const score of scores) {
    await playTo(g, score);
    g.hook.toTitle?.();
  }
  await g.frames(100);
  const pushed = g.fake.log.last('putSave')?.args[1];
  if (!isJson(pushed)) throw new Error('a finished normal game pushed no profile');
  return pushed;
}

/** The boards the game's last `result()` named, as `[board, number]` pairs. */
export function resultBoards(g: Booted): [string, number][] {
  const boards = field(g.calls.last('result')?.args[0], 'boards');
  if (typeof boards !== 'object' || boards === null || Array.isArray(boards)) return [];
  return Object.entries(boards).filter((e): e is [string, number] => typeof e[1] === 'number');
}
