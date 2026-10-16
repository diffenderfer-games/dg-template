/**
 * kit/world: the page side: your room's key and Adventure Mode link; game tables and Quick match (W2, coming).
 * Source: dg-template src/kit/world/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md
 *
 * The world is live (hub client next.9) and a game's own room is data
 * (`game.world`: a map file or a generated room; kit/world/room.ts makes and
 * checks it for scripts and tests). Players walk it in Adventure Mode
 * (next.10): `/world`, and `/world/game.<slug>` opens this game's room
 * (`roomPath`); nothing here talks to the world. Tables that launch a game are still
 * planned (world.md §3, W2): `worldBlock` derives the default tables world.md
 * §3.1 describes from `game.multiplayer` and `game.race` (not in the manifest
 * yet: its strict schema refuses `world.tables`), and launches from a table
 * will arrive as ordinary host/guest launches with `launch.table` (kit/online
 * passes its options to the game's `start`). Everything here is behind a
 * feature check.
 */
import type { HubLike } from '../core/hub-like.ts';

/** The world key the hub serves a game's room under (`game.<slug>`). */
export function worldKey(slug: string): string {
  return `game.${slug}`;
}

/** The Adventure Mode page that opens straight into this game's room (`/world/game.<slug>`), for a link. */
export function roomPath(slug: string): string {
  return `/world/${encodeURIComponent(worldKey(slug))}`;
}

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
