/**
 * tests/hub: the shared header of every browser hub suite (node --test, real hub, system Chrome).
 * Source: dg-template tests/hub/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Browser hub suites"
 *
 *   import { env, e2e, game, waitGame, L } from './_kit.ts';
 *   e2e('opening the hub menu pauses the game', env(), async (t) => { … });
 *
 * It loads the hub's own e2e kit (`test/e2e/helpers.mjs` in DG_HOST, default
 * ../diffenderfer-games): one real test host per file with this game linked
 * in, a browser context per player, console errors failing the test,
 * screenshots on failure. `DG_TEST_URL` points it at a running `npm run local`
 * instead. The kit's JS is untyped, so this file checks each export once and
 * gives it a type (a trust boundary).
 */
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ElementHandle, Page } from 'puppeteer-core';
import type {} from '../../src/kit/test-hook/index.ts';
import type { JsonObject } from '../../src/kit/core/json.ts';

/** This game's folder and slug (the folder name, lowercased, like the hub). */
export const ROOT = resolve(import.meta.dirname, '..', '..');
export const SLUG = (process.env.DEPLOY_SLUG ?? basename(ROOT)).toLowerCase();

/** The hub checkout with the test kit. */
export const HUB = resolve(process.env.DG_HOST ?? join(ROOT, '..', 'diffenderfer-games'));

/** The hub UI's shadow root prefix for selectors (toasts, dialogs, the race HUD). */
export const L = '#hub-social-layer >>> ';

/** A player: a browser context signed in as one account (the hub's Player). */
export type Player = {
  readonly page: Page;
  readonly id: number;
  readonly name: string;
  goto(path: string, opts?: { social?: boolean }): Promise<void>;
  openMenu(): Promise<void>;
  openFriends(): Promise<void>;
  closeMenu(): Promise<void>;
  find(sel: string, text?: string | RegExp, opts?: { timeout?: number }): Promise<ElementHandle>;
  click(sel: string, text?: string | RegExp, opts?: { timeout?: number }): Promise<void>;
  gone(sel: string, text?: string | RegExp, opts?: { timeout?: number }): Promise<void>;
  tid(testid: string): Promise<void>;
  newTab(path: string): Promise<Player>;
};

/** One test's toolkit (the hub's E2eTest). */
export type E2eTest = {
  readonly url: string;
  newPlayer(
    name?: string,
    path?: string | null,
    opts?: { mobile?: boolean; viewport?: { width: number; height: number } },
  ): Promise<Player>;
  newGuest(path?: string, opts?: { mobile?: boolean }): Promise<Player>;
};

/** The host shared by a file's tests. */
export type E2eEnv = { readonly host: { url: string } | null };

type Fn = (...args: unknown[]) => unknown;

async function load(file: string): Promise<Record<string, Fn>> {
  const path = join(HUB, file);
  if (!existsSync(path))
    throw new Error(`the hub test kit is missing: ${path} (set DG_HOST to the diffenderfer-games checkout)`);
  const mod: unknown = await import(pathToFileURL(path).href);
  const out: Record<string, Fn> = {};
  if (typeof mod === 'object' && mod !== null) {
    for (const k of Object.keys(mod)) {
      const v: unknown = Reflect.get(mod, k);
      if (typeof v === 'function') out[k] = (...args: unknown[]): unknown => Reflect.apply(v, undefined, args);
    }
  }
  return out;
}

const kit = await load('test/e2e/helpers.mjs');
const client = await load('test/helpers/client.mjs');

function need(mod: Record<string, Fn>, name: string): Fn {
  const f = mod[name];
  if (!f) throw new Error(`the hub test kit has no ${name}() (has the hub moved it?)`);
  return f;
}

/** The trust boundary: the hub kit's objects have the shapes above (checked by duck type). */
function isEnv(x: unknown): x is E2eEnv {
  return typeof x === 'object' && x !== null && 'host' in x;
}
function isTest(x: unknown): x is E2eTest {
  return typeof x === 'object' && x !== null && 'newPlayer' in x && 'newGuest' in x;
}
function isPlayer(x: unknown): x is Player {
  return typeof x === 'object' && x !== null && 'page' in x && 'tid' in x;
}

/** One host for this file, with this game linked in (and the hub's demo games when asked). */
export function env(o: { env?: Record<string, string>; apps?: Record<string, string> } = {}): E2eEnv {
  const e = need(kit, 'e2eEnv')({ apps: { [SLUG]: ROOT, ...o.apps }, env: o.env ?? {} });
  if (!isEnv(e)) throw new Error('e2eEnv() returned something unexpected');
  return e;
}

/** One test (a fresh toolkit; page errors fail it; screenshots on failure). `skip`: false, or the reason. */
export function e2e(
  name: string,
  e: E2eEnv,
  fn: (t: E2eTest) => Promise<void>,
  opts: { skip?: string | false; timeout?: number } = {},
): void {
  need(kit, 'e2e')(
    name,
    e,
    async (t: unknown) => {
      if (!isTest(t)) throw new Error('e2e() passed something unexpected');
      await fn(t);
    },
    opts,
  );
}

/** The hub's demo game for invites and jumps (apps-test/mpdemo). */
export async function mpdemoDir(): Promise<string> {
  const mod: unknown = await import(pathToFileURL(join(HUB, 'test', 'helpers', 'server.mjs')).href);
  const dir: unknown = typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'MPDEMO_DIR') : undefined;
  if (typeof dir !== 'string') throw new Error('no MPDEMO_DIR in the hub test kit');
  return dir;
}

/** A player's REST client (the hub kit's ApiClient, signed in as them): paths are under /_api. */
export type PlayerApi = {
  get(path: string): Promise<{ status: number; body: unknown }>;
  post(path: string, body?: JsonObject): Promise<{ status: number; body: unknown }>;
  put(path: string, body?: JsonObject): Promise<{ status: number; body: unknown }>;
};

/** The trust boundary: the hub kit's ApiClient has these methods. */
function isApi(x: unknown): x is PlayerApi {
  return typeof x === 'object' && x !== null && 'get' in x && 'post' in x && 'put' in x;
}

/** Player `p`'s REST client. */
export function api(p: Player): PlayerApi {
  const a: unknown = Reflect.get(p, 'api');
  if (!isApi(a)) throw new Error('the hub kit player has no api client (has the hub moved it?)');
  return a;
}

/** Make two players friends (REST). */
export async function befriend(a: Player, b: Player): Promise<void> {
  await need(client, 'befriend')(api(a), api(b));
}

/** Let animations and coalesced updates settle. */
export const settle = (ms = 150): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Wait for a condition polled in Node. */
export async function until<T>(
  fn: () => Promise<T | null | undefined | false>,
  what: string,
  timeout = 15_000,
): Promise<T> {
  const end = Date.now() + timeout;
  let last: T | null | undefined | false;
  while (Date.now() < end) {
    last = await fn();
    if (last !== null && last !== undefined && last !== false) return last;
    await settle(100);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

/** The game's test hook, read in the page. */
export const game = {
  screen: (p: Player): Promise<string> => p.page.evaluate(() => window.__game?.screen() ?? ''),
  mode: (p: Player): Promise<string | null> => p.page.evaluate(() => window.__game?.mode() ?? null),
  paused: (p: Player): Promise<boolean> => p.page.evaluate(() => window.__game?.paused() ?? false),
  snap: (p: Player): Promise<JsonObject> => p.page.evaluate(() => window.__game?.snap() ?? {}),
  newGame: (p: Player): Promise<void> => p.page.evaluate(() => window.__game?.newGame?.()),
  solveNow: (p: Player): Promise<void> => p.page.evaluate(() => window.__game?.solveNow?.()),
  autoplay: (p: Player, on = true): Promise<void> => p.page.evaluate((v) => window.__game?.autoplay?.(v), on),
  toTitle: (p: Player): Promise<void> => p.page.evaluate(() => window.__game?.toTitle?.()),
  pause: (p: Player): Promise<void> => p.page.evaluate(() => window.__game?.pause?.()),
};

/** Wait until the game is mounted (`body[data-ready]`) and the hook is there. */
export async function ready(p: Player, timeout = 30_000): Promise<void> {
  await p.page.waitForFunction(() => document.body.dataset.ready === '1' && window.__game !== undefined, { timeout });
}

/** Wait for the game's screen; on timeout the error shows the game's state. */
export async function waitScreen(p: Player, screen: string, timeout = 15_000): Promise<void> {
  try {
    await p.page.waitForFunction((s) => window.__game?.screen() === s, { timeout, polling: 100 }, screen);
  } catch (e) {
    const state = await p.page.evaluate(() => ({
      screen: window.__game?.screen(),
      mode: window.__game?.mode(),
      snap: window.__game?.snap(),
    }));
    throw new Error(
      `[${p.name}] waited for screen "${screen}": ${e instanceof Error ? e.message : String(e)}\nstate: ${JSON.stringify(state)}`,
      { cause: e },
    );
  }
}

declare global {
  interface Window {
    __HUB_MENU_VISIBLE__?: boolean;
  }
}

/**
 * Open the hub menu, also while the kit hides its button during play: tap the
 * peek hotspot first, the way a player does (hub.md "Hiding the menu").
 */
export async function openMenu(p: Player): Promise<void> {
  const hidden = await p.page.evaluate(() => window.__HUB_MENU_VISIBLE__ === false);
  if (hidden) {
    const peek = await p.page.waitForSelector('#hub-menu-root >>> .peek');
    await peek?.click();
  }
  await p.openMenu();
}

/** The hub's overlay log (`__HUB_TEST__.overlayLog`), when the page has it. */
export function overlayLog(p: Player): Promise<{ ev: string; reason: string; canPause: boolean }[]> {
  return p.page.evaluate(() => {
    const t: unknown = Reflect.get(window, '__HUB_TEST__');
    const log: unknown = typeof t === 'object' && t !== null ? Reflect.get(t, 'overlayLog') : undefined;
    return Array.isArray(log)
      ? log.map((e: unknown) => ({
          ev: String(Reflect.get(Object(e), 'ev')),
          reason: String(Reflect.get(Object(e), 'reason')),
          canPause: Reflect.get(Object(e), 'canPause') === true,
        }))
      : [];
  });
}

/** Today's UTC day (the hub's daily calendar), or `offset` days from it. */
export const today = (offset = 0): string => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Assert-friendly: the player object as Player (the kit's newPlayer result). */
export function asPlayer(x: unknown): Player {
  if (!isPlayer(x)) throw new Error('not a player');
  return x;
}
