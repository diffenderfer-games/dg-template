/**
 * kit/saved: "Your games" (hub.saved), with today's hub.resume as the fallback.
 * Source: dg-template src/kit/saved/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/saved.md
 *
 * Planned hub API (saved-games.md §3.1, phases 0–1). Until the pinned client
 * has `hub.saved`, `continueRows` is the one Continue row from kit/resume and
 * nothing else changes. Once it ships:
 * - the title lists every saved instance of this game ("Continue: Level 12",
 *   "Daily challenge · Oct 14 (34 cards left)", "Online with Sam · your turn");
 * - `opened` (a card, the menu, `?hub_open=`) is routed at boot;
 * - `onOpen` switches instances without a reload;
 * - a daily instance goes to `hub.daily.resume(id)` (→ play with `challenge.saved`),
 *   a run to the saved game, a turn game to kit/turns.
 * Wording: never "run", "turn game" or "instance" (kit/core strings).
 */
import type { HubLike } from '../core/hub-like.ts';
import type { SavedGame, SavedKind } from '../core/planned.ts';
import { shortDay, t } from '../core/strings.ts';

/** One Continue row on the title. */
export type ContinueRow = { id: string; kind: SavedKind; label: string };

/** Where an opened instance goes (the session implements it). */
export type SavedRoutes = {
  continueRun(): void;
  resumeDaily(id: string): void;
  openTurns(id: string): void;
};

/** The words for a saved instance, by kind, in the hub's wording. */
export function rowLabel(g: SavedGame): string {
  if (g.kind === 'daily' && g.daily) return `${t('dailyOn', { date: shortDay(g.daily.day) })} (${g.progress.label})`;
  if (g.kind === 'turns') {
    const others = (g.turns?.seats ?? []).filter((s) => !s.isMe).map((s) => s.name);
    const name = others.join(', ') || '…';
    return g.turns?.isMyTurn === true ? t('onlineWithTurn', { name }) : t('onlineWith', { name });
  }
  return t('continueLabel', { label: g.progress.label });
}

/** The adapter. */
export type SavedHandle = {
  /** Does the pinned hub have `hub.saved` (saved-games phases 0–1)? */
  readonly available: boolean;
  /** The title's Continue rows (with hub.saved: every instance; without: the one saved game, if any). */
  continueRows(fallback: () => Promise<string | null>): Promise<ContinueRow[]>;
  /** The instance this page was opened for, routed (true when one was). */
  routeOpened(): boolean;
  /** Open one row. */
  open(id: string, kind: SavedKind): void;
};

/** Create the adapter; installs `onOpen` when the hub has it. */
export function createSaved(
  hub: Pick<HubLike, 'saved'>,
  routes: SavedRoutes,
  onChange: () => void = () => undefined,
): SavedHandle {
  const saved = hub.saved;
  const open = (id: string, kind: SavedKind): void => {
    if (kind === 'daily') routes.resumeDaily(id);
    else if (kind === 'turns') routes.openTurns(id);
    else routes.continueRun();
  };
  if (saved) {
    saved.onOpen((g) => open(g.id, g.kind));
    saved.on('change', () => onChange());
  }
  return {
    available: saved !== undefined,
    async continueRows(fallback) {
      if (!saved) {
        const label = await fallback();
        return label === null ? [] : [{ id: 'run', kind: 'run', label: t('continueLabel', { label }) }];
      }
      const games = await saved.list();
      return games.filter((g) => g.status === 'active').map((g) => ({ id: g.id, kind: g.kind, label: rowLabel(g) }));
    },
    routeOpened() {
      const o = saved?.opened ?? null;
      if (o === null) return false;
      open(o.id, o.kind);
      return true;
    },
    open,
  };
}
