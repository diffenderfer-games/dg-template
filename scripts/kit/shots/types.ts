/**
 * scripts/kit/shots: what a screenshot scenario is, and what it can do.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Writing a scenario"
 */
import type { Page } from 'puppeteer-core';
import type { SizeName } from '../lib/browser.ts';

/** Where a scenario runs: the built game alone (no hub), or a real hub. */
export type ShotTarget = 'static' | 'hub';

/** A signed-in player on the hub (a context of its own). */
export type ShotPlayer = { page: Page; id: number; name: string };

/** What a scenario gets. */
export type ShotContext = {
  readonly target: ShotTarget;
  readonly size: SizeName;
  /** The site origin (`http://127.0.0.1:PORT`). */
  readonly origin: string;
  /** The game's URL (`…/<slug>/`). */
  readonly base: string;
  /** Player A's page (a fresh context; signed in as a claimed player on the hub). */
  readonly page: Page;
  /** Open the game (with an optional query, e.g. `?daily=2026-10-15`) and wait until it is ready. */
  open(query?: string, page?: Page): Promise<void>;
  /** Another player, in their own context (hub only). */
  player(): Promise<ShotPlayer>;
  /** Player A's account. */
  me(): Promise<ShotPlayer>;
  /** Make two players friends. */
  befriend(a: ShotPlayer, b: ShotPlayer): Promise<void>;
  /** Call a `window.__game` driver: `drive('newGame')`, `drive('online.host')`. */
  drive(path: string, ...args: (string | number | boolean)[]): Promise<void>;
  /** Wait for the game's screen. */
  screen(name: string, page?: Page): Promise<void>;
  /** Click a kit button by data-testid. */
  press(testid: string, page?: Page): Promise<void>;
  /** Click a hub UI element (inside its shadow roots) by selector and text. */
  hubClick(selector: string, text?: string, page?: Page): Promise<void>;
  /** Wait for a hub UI element. */
  hubFind(selector: string, text?: string, page?: Page): Promise<void>;
  wait(ms: number): Promise<void>;
};

/** A named screenshot scenario. */
export type Scenario = {
  name: string;
  target: ShotTarget;
  /** What the shot checks (shown on the contact sheet). */
  checks: string;
  /** Skip it, saying why (a planned hub phase). */
  skip?: string;
  /** Get to the scene; the runner takes the shot when it returns. */
  run(c: ShotContext): Promise<void>;
};
