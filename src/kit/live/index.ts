/**
 * kit/live: live (realtime) games the hub runs: the sim module, its conformance check, the page's connection and flow.
 * Source: dg-template src/kit/live/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/live.md
 *
 * The game writes a PURE fixed-step sim (src/game/live/sim.ts, its default
 * export, bundled by `npm run build:live` into a self-contained
 * dist-live/sim.mjs) and declares it in `game.live`, with a hub-room lobby
 * (`game.multiplayer`). The hub's live server runs it authoritatively; the
 * page runs the same sim to predict, so its own player moves at once.
 * `GameDefinition.live` (`LiveRoomGame`) is the page's side: the kit runs
 * the lobby, the loading screen, joining (`live.join`) and the result.
 * `joinLive` connects directly; `checkLiveSimRuns` is for tests.
 */
export * from './sim.ts';
export type { LiveRoomGame, LiveSeat, LiveStart } from './types.ts';
export { LiveRoomMatch, type LiveRoomEvents } from './room-match.ts';
export { joinLive, joinLiveRoom, live, LivePredictor, LiveClock } from '@diffenderfer-games/hub/live';
export type { LiveDrawn, LiveJoinOptions, LiveMatch, LiveView } from '@diffenderfer-games/hub/live';
