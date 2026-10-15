/**
 * kit/world: the game's tables in the hub's world (game.world), and Quick match.
 * Source: dg-template src/kit/world/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md
 *
 * Planned hub (world.md §3, W2–W4). The world is the hub's: a game mostly
 * declares data. `worldBlock` derives the `game.world` block world.md §3.1
 * would default to from `game.multiplayer` and `game.race`, so `new-game` can
 * write it once the pinned contract accepts it (the manifest is strict, so
 * until W2 it stays out of package.json). Launches from a table arrive as
 * ordinary host/guest launches with `launch.table` (kit/online passes its
 * options to the game's `start`).
 */
import type { HubLike } from '../core/hub-like.ts';

/** One table type (world.md §3.1). */
export type TableDecl = {
  key: string;
  title: string;
  mode?: string;
  players: [number, number];
  maxWaitSec?: number;
  count?: number;
  options?: Record<string, string | number | boolean>;
};

/** The parts of the game block the defaults come from. */
export type WorldSource = {
  multiplayer?: { players?: [number, number]; modes?: { key: string; title?: string; players?: [number, number] }[] };
  race?: { players?: [number, number] } | boolean;
};

/** The default tables: one per mode (or Play), plus Race for race games (world.md §3.1 "Defaults"). */
export function worldBlock(game: WorldSource): { tables: TableDecl[] } | null {
  const tables: TableDecl[] = [];
  const mp = game.multiplayer;
  if (mp) {
    const players = mp.players ?? [2, 8];
    const modes = mp.modes ?? [];
    if (modes.length === 0) tables.push({ key: 'play', title: 'Play', players });
    for (const m of modes)
      tables.push({ key: m.key, title: (m.title ?? m.key).slice(0, 24), mode: m.key, players: m.players ?? players });
  }
  if (game.race !== undefined && game.race !== false) {
    const duel: [number, number] = [2, 2];
    const players = typeof game.race === 'object' && game.race.players ? game.race.players : duel;
    tables.push({ key: 'race', title: 'Race', mode: 'race', players });
  }
  return tables.length === 0 ? null : { tables };
}

/** Quick match: is it available (the hub has it, world W2)? Then sit at a matching table. */
export function quickMatch(hub: Pick<HubLike, 'mp'>): ((mode?: string) => Promise<void>) | null {
  const qm = hub.mp.quickMatch;
  if (!qm) return null;
  return (mode) => qm(mode === undefined ? {} : { mode });
}
