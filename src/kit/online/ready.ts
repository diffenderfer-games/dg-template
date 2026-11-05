/**
 * kit/online: who is ready in a room's lobby, and the newer hub's room calls (hand the host role over, rematch),
 * feature-detected so an older hub simply goes without them.
 * Source: dg-template src/kit/online/ (kit v1.36). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Lobby"
 *
 * The hub's rule for `room.start`: every guest is connected and ready, or sat down at least
 * {@link AUTO_READY_MS} ago (`seat.joinedAt`). The page waits a little longer
 * ({@link AUTO_READY_MARGIN_MS}) before it counts someone as ready by time, for clocks that differ.
 * A hub without `joinedAt` counts the ready flags only. `joinedAt` is the hub's clock and a device's can be
 * minutes off, so readiness is read at {@link hubNow}, never the device's own time.
 */
import type { HubRoom, RoomInfo, RoomSeat } from '@diffenderfer-games/hub';

/** A guest seated this long counts as ready (the hub's rule). */
export const AUTO_READY_MS = 60_000;
/** The page waits this much more before it counts it (clock skew). */
export const AUTO_READY_MARGIN_MS = 3_000;

/** The newer hub's room calls (absent on an older hub). */
export type RoomExtras = {
  /** Host only, in the lobby: give the host role to a seated, connected player. */
  setHost?: (userId: number) => Promise<void>;
  /** On an ended room: join its rematch room (or start it) and get the new room. */
  rematch?: () => Promise<HubRoom>;
};

/** An ended room's rematch: the new room's code, who started it, who sits in it. */
export type RematchInfo = { code: string; hostId: number; userIds: number[] };

function canSetHost(room: HubRoom): room is HubRoom & { setHost(userId: number): Promise<void> } {
  return 'setHost' in room && typeof room.setHost === 'function';
}

function canRematch(room: HubRoom): room is HubRoom & { rematch(): Promise<HubRoom> } {
  return 'rematch' in room && typeof room.rematch === 'function';
}

/** The calls this hub's room has. */
export function roomExtras(room: HubRoom): RoomExtras {
  return {
    ...(canSetHost(room) ? { setHost: (userId: number) => room.setHost(userId) } : {}),
    ...(canRematch(room) ? { rematch: () => room.rematch() } : {}),
  };
}

/** When the seat's player sat down (epoch ms), or null on a hub that doesn't say. */
export function joinedAt(seat: RoomSeat): number | null {
  return 'joinedAt' in seat && typeof seat.joinedAt === 'number' ? seat.joinedAt : null;
}

/** The ended room's rematch, or null (none yet, or an older hub). */
export function rematchOf(info: RoomInfo): RematchInfo | null {
  const r = 'rematch' in info ? info.rematch : null;
  if (typeof r !== 'object' || r === null) return null;
  const code = 'code' in r ? r.code : null;
  const hostId = 'hostId' in r ? r.hostId : null;
  const ids = 'userIds' in r ? r.userIds : null;
  if (typeof code !== 'string' || typeof hostId !== 'number') return null;
  const userIds = Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
  return { code, hostId, userIds };
}

/**
 * How far this device's clock runs ahead of the hub's (ms), as far as the page can tell: a seat can't
 * have sat down after the page first saw it, so (first seen − `joinedAt`) bounds it from above, and the
 * smallest bound is kept. Seats first seen long after they sat only make the estimate larger: someone
 * then counts as ready later than the hub would, never earlier. Null until a seat with `joinedAt` shows.
 */
let clockAhead: number | null = null;
/** Seats already sampled (room code, user, when they sat). */
const sampled = new Set<string>();

/** The hub's time now (epoch ms), from the device's `localNow`; `info`'s seats sharpen the estimate. */
export function hubNow(info: RoomInfo, localNow: number): number {
  for (const seat of info.seats) {
    const at = joinedAt(seat);
    if (at === null) continue;
    const key = `${info.code}:${String(seat.userId)}:${String(at)}`;
    if (sampled.has(key)) continue;
    if (sampled.size > 500) sampled.clear();
    sampled.add(key);
    const ahead = localNow - at;
    if (clockAhead === null || ahead < clockAhead) clockAhead = ahead;
  }
  return clockAhead === null ? localNow : localNow - clockAhead;
}

/** Forget the clock estimate (tests). */
export function resetHubClock(): void {
  clockAhead = null;
  sampled.clear();
}

/** Where a seat stands: the host, ready (pressed it, or `auto` by time), waiting, or away. */
export type SeatReady = {
  kind: 'host' | 'ready' | 'auto' | 'waiting' | 'away';
  /** When a waiting seat counts as ready by time (epoch ms), or null. */
  readyAt: number | null;
};

/** One seat's readiness at `now`. */
export function seatReady(seat: RoomSeat, hostId: number, now: number): SeatReady {
  if (seat.userId === hostId) return { kind: 'host', readyAt: null };
  if (!seat.connected) return { kind: 'away', readyAt: null };
  if (seat.ready) return { kind: 'ready', readyAt: null };
  const at = joinedAt(seat);
  if (at === null) return { kind: 'waiting', readyAt: null };
  const readyAt = at + AUTO_READY_MS + AUTO_READY_MARGIN_MS;
  return now >= readyAt ? { kind: 'auto', readyAt: null } : { kind: 'waiting', readyAt };
}

/** The lobby at `now`: enough players, who isn't ready yet, and whether the host may start. */
export type LobbyReadiness = { enough: boolean; waiting: RoomSeat[]; canStart: boolean };

export function lobbyReadiness(info: RoomInfo, minPlayers: number, now: number): LobbyReadiness {
  const waiting = info.seats.filter((s) => {
    const kind = seatReady(s, info.hostId, now).kind;
    return kind === 'waiting' || kind === 'away';
  });
  const enough = info.seats.length >= minPlayers;
  return { enough, waiting, canStart: enough && waiting.length === 0 };
}

/** `m:ss` for a wait. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;
}
