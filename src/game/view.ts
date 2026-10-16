/**
 * What the game's renderer (src/game/render/) gives the game. (GAME: yours to edit.)
 *
 * The starters (PixiJS, three.js, DOM) each implement it; `new-game` copies
 * the chosen one into src/game/render/.
 */
import type { OnlineView, Run } from './state.ts';

/** The renderer. */
export type View = {
  /** Create the canvas (or DOM) inside `stage` and load what it needs. */
  mount(stage: HTMLElement): Promise<void>;
  /** Draw the game (`run` is null on menus: draw an idle scene). `alpha` is between two steps. */
  draw(run: Run | null, alpha: number): void;
  /** Draw an online match (`me` is this player's user id). */
  drawOnline?(view: OnlineView | null, me: number): void;
};
