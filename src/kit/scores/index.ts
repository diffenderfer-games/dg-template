/**
 * kit/scores: leaderboards and stats, with the daily / race / online suppression rules.
 * Source: dg-template src/kit/scores/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/scores.md
 *
 * - Normal games submit to the boards and stats.
 * - A daily submits nothing, unless the spec names a daily board (weston `daily-score`).
 * - A race writes nothing: the hub keeps the race history (multiplayer.md §14.4).
 * - Online play: stats (each client records its own), and only the boards named
 *   for online play (uno's online wins).
 * - Every board is declared (`game.leaderboards`; `kit:check` compares).
 * - Fire and forget: a hub error never reaches the game.
 */
import type { PlayMode } from '../core/activity.ts';
import { fireAndForget } from '../core/async.ts';
import type { HubLike } from '../core/hub-like.ts';
import { ruleBroken } from '../core/log.ts';

/** The game's boards, as declared in `game.leaderboards`. */
export type BoardDecl = { title: string; sort?: 'asc' | 'desc' };

/** What the game scores. */
export type ScoreSpec = {
  boards: Record<string, BoardDecl>;
  /** A board that takes daily results (else dailies submit nothing). */
  dailyBoard?: string;
  /** Boards that take online results (else online play submits to none). */
  onlineBoards?: readonly string[];
};

/** One finished game's numbers. */
export type ResultNumbers = {
  mode: PlayMode;
  boards?: Record<string, number>;
  incr?: Record<string, number>;
  max?: Record<string, number>;
};

/** Which boards a result in `mode` may reach. */
export function boardsFor(spec: ScoreSpec, mode: PlayMode): Set<string> {
  if (mode === 'normal') return new Set(Object.keys(spec.boards));
  if (mode === 'daily') return new Set(spec.dailyBoard === undefined ? [] : [spec.dailyBoard]);
  if (mode === 'online') return new Set(spec.onlineBoards ?? []);
  return new Set();
}

/** Record a finished game (boards and stats), by the rules above. Returns the boards submitted to. */
export function recordResult(
  hub: Pick<HubLike, 'submitScore' | 'incrStat' | 'maxStat'>,
  spec: ScoreSpec,
  r: ResultNumbers,
): string[] {
  const allowed = boardsFor(spec, r.mode);
  const sent: string[] = [];
  for (const [key, score] of Object.entries(r.boards ?? {})) {
    const decl = spec.boards[key];
    if (decl === undefined) {
      ruleBroken(`board "${key}" is not declared (add it to game.leaderboards and the ScoreSpec)`);
      continue;
    }
    if (!allowed.has(key)) continue;
    fireAndForget(
      hub.submitScore(
        key,
        score,
        decl.sort === undefined ? { title: decl.title } : { title: decl.title, sort: decl.sort },
      ),
    );
    sent.push(key);
  }
  if (r.mode === 'normal' || r.mode === 'online') {
    for (const [key, n] of Object.entries(r.incr ?? {})) fireAndForget(hub.incrStat(key, n));
    for (const [key, n] of Object.entries(r.max ?? {})) fireAndForget(hub.maxStat(key, n));
  }
  return sent;
}
