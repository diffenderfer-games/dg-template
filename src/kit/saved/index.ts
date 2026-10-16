/**
 * kit/saved: "Your games" (hub.saved): the title's Continue rows, and opening a saved game.
 * Source: dg-template src/kit/saved/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/saved.md
 *
 * hub.md "Saved games". The title lists every saved game of this game:
 * "Level 12" (the saved game, from hub.resume), "Daily challenge ·
 * Oct 14 (34 cards left)" (a day in progress), "Online with Sam · your turn"
 * (an online game). Then:
 * - `opened` (Your games, the hub menu, `?hub_open=`) is routed at boot;
 * - `onOpen` switches games picked from the hub menu without a reload;
 * - a day in progress goes to `hub.daily.resume(id)` (→ play with
 *   `challenge.saved`), the saved game to Continue, an online game to the
 *   game's `openTurns` (without one, online games are left to the hub, which
 *   reloads the page with `?hub_open=`);
 * - if the list can't be read, the one saved game from kit/resume stands in.
 * Wording: never "run", "turn game" or "instance" (kit/core strings).
 */
import type { SavedEntry, SavedKind } from '@diffenderfer-games/hub';
import type { HubLike } from '../core/hub-like.ts';
import { shortDay, t } from '../core/strings.ts';

/** One Continue row on the title. */
export type ContinueRow = { id: string; kind: SavedKind; label: string };

/** Where an opened saved game goes (the session implements it). */
export type SavedRoutes = {
  continueRun(): void;
  resumeDaily(id: string): void;
  /** The game's own screen for an online game; leave it out when the game has none. */
  openTurns?(id: string): void;
};

/** The words for a saved game, by kind, in the hub's wording. */
export function rowLabel(g: SavedEntry): string {
  if (g.kind === 'daily' && g.daily) return `${t('dailyOn', { date: shortDay(g.daily.day) })} (${g.progress.label})`;
  if (g.kind === 'turns') {
    const others = (g.turns?.seats ?? []).filter((s) => !s.isMe && s.status !== 'open').map((s) => s.name);
    const name = others.join(', ') || '…';
    return g.turns?.isMyTurn === true ? t('onlineWithTurn', { name }) : t('onlineWith', { name });
  }
  return g.progress.label; // under the button's own "Continue"
}

/** The adapter. */
export type SavedHandle = {
  /** The title's Continue rows: every saved game this game can open (the one from kit/resume if the list fails). */
  continueRows(fallback: () => Promise<string | null>): Promise<ContinueRow[]>;
  /** The saved game this page was opened for, routed (true when one was). */
  routeOpened(): boolean;
  /** Open one row. */
  open(id: string, kind: SavedKind): void;
  /** Give a day in progress or the saved game up (ask the player first). */
  discard(id: string): Promise<void>;
  /** This game's days in progress. */
  dailiesInProgress(): Promise<SavedEntry[]>;
};

/** Create the adapter; takes the hub menu's picks of the kinds it can open (`onOpen`). */
export function createSaved(
  hub: Pick<HubLike, 'saved' | 'daily'>,
  routes: SavedRoutes,
  onChange: () => void = () => undefined,
): SavedHandle {
  const kinds: SavedKind[] = routes.openTurns ? ['run', 'daily', 'turns'] : ['run', 'daily'];
  const open = (id: string, kind: SavedKind): void => {
    if (kind === 'daily') routes.resumeDaily(id);
    else if (kind === 'turns') routes.openTurns?.(id);
    else routes.continueRun();
  };
  hub.saved.onOpen((g) => open(g.id, g.kind), { kinds });
  hub.saved.on('change', () => onChange());
  return {
    async continueRows(fallback) {
      let games: SavedEntry[];
      try {
        games = await hub.saved.list({ kinds });
      } catch {
        const label = await fallback();
        return label === null ? [] : [{ id: 'run', kind: 'run', label }];
      }
      return games.filter((g) => g.status === 'active').map((g) => ({ id: g.id, kind: g.kind, label: rowLabel(g) }));
    },
    routeOpened() {
      const o = hub.saved.opened;
      if (o === null || !kinds.includes(o.kind)) return false;
      open(o.id, o.kind);
      return true;
    },
    open,
    discard: (id) => hub.saved.discard(id),
    dailiesInProgress: () => hub.daily.inProgress(),
  };
}
