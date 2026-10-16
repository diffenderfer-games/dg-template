// KIT suites still waiting: written now, skipped with what unblocks them. (No host boots while every
// test here is skipped.) Turn one on by moving it into its own file with env(), as saved.test.ts and
// avatar.test.ts were when saved games and avatars went live (client next.6).
import { test } from 'node:test';
import { shipped, waitsOn } from '../../../src/kit/testing/phases.ts';

const skip = (...phases: Parameters<typeof waitsOn>): string | false =>
  shipped(...phases) ? false : waitsOn(...phases);

/** Online games over days are live (next.6), but the template has no screen for them to test yet. */
const NO_TURNS_SCREEN =
  'the template declares no game.turns: the kit has no screen for online games over days yet (docs/kit/turns.md)';

void test(
  'turns: create → invite → move → the other page gets the move → reload → history replays',
  { skip: NO_TURNS_SCREEN },
  () => {
    // Plan: two players, `npm run build:rules` bundle declared in game.turns; move with __game drivers;
    // the opponent's page gets TurnGame `move`; a reload calls history(lastSeq) and animates it.
  },
);

void test(
  'turns: "your turn" reaches the other player as an alert while they are away',
  { skip: NO_TURNS_SCREEN },
  () => {
    // Plan (multiplayer.md §16.6): A moves while B is on another page; B gets the hub's "your turn"
    // notice, opens it, and lands on the turn game at the new move.
  },
);

void test(
  'avatar: the Pixi and three.js adapters draw the same face as <dg-avatar>',
  {
    skip: "the template's renderer draws no faces in its canvas: src/starters/*/avatar-*.ts are opt-in (the hub's own e2e covers the adapters)",
  },
  () => {
    // Plan: src/game/render uses seatFaces / seatSprites for the online view; a shot of a seat's face
    // matches the DOM avatar for the same look.
  },
);

void test(
  'online/table: three players sit at a world table and are launched into the same room',
  { skip: skip('worldW2') },
  () => {
    // Plan (world.md §3.4): three contexts sit at the game's table in the Hall; each gets a host/guest
    // launch with launch.table; all land in one room; the game used launch.table.options.
  },
);

void test(
  "world: npm run world:build converts the game's Tiled room and the hub serves it",
  { skip: skip('worldW4') },
  () => {
    // Plan (world.md §7): world/room.tmj → world/room.json (dg-room@1) with `dg-room from-tiled`;
    // world:check validates it, and the hub's room viewer loads it.
  },
);
