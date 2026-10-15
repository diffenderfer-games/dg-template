/**
 * kit/testing: builders for the hub's room shapes (RoomInfo, RoomSeat, PlayerLite).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 */
import type { PlayerLite, RoomInfo, RoomSeat } from '@diffenderfer-games/hub';

/** A player as invites and launches carry them. */
export function fakePlayer(id: number, username = `Player${id}`): PlayerLite {
  return { id, username, avatar: `a${id}`, guest: false };
}

/** A seat in a room. */
export function fakeSeat(userId: number, extra: Partial<RoomSeat> = {}): RoomSeat {
  return { userId, name: `Player${userId}`, avatar: `a${userId}`, ready: false, connected: true, ...extra };
}

/** A room as the `room` event carries it. */
export function fakeRoomInfo(extra: Partial<RoomInfo> = {}): RoomInfo {
  return {
    id: 'room-1',
    code: 'ABCDE',
    game: 'mygame',
    hostId: 1,
    public: false,
    phase: 'lobby',
    maxPlayers: 4,
    model: 'host',
    seats: [fakeSeat(1)],
    spectators: 0,
    chatMode: 'on',
    ...extra,
  };
}
