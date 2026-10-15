// KIT suites for planned hub APIs: written now, skipped with the hub phase that unblocks them.
// (No host boots while every test here is skipped.) Turn one on by moving it into its own file with env().
import { test } from 'node:test';
import { shipped, waitsOn } from '../../../src/kit/testing/phases.ts';

const skip = (...phases: Parameters<typeof waitsOn>): string | false =>
  shipped(...phases) ? false : waitsOn(...phases);

void test(
  'saved: "Your games" → open a day in progress → win → the credit goes to that day',
  { skip: skip('savedGames01') },
  () => {
    // Plan (saved-games.md §8 e2e): start a daily, reload mid-day, advance the hub clock a day,
    // open it from the hub menu's "Your games", solveNow, assert the completion is for the original day.
  },
);

void test(
  'turns: create → invite → move → the other page gets the move → reload → history replays',
  { skip: skip('savedGames3') },
  () => {
    // Plan: two players, `npm run build:rules` bundle declared in game.turns; move with __game drivers;
    // the opponent's page gets TurnGame `move`; a reload calls history(lastSeq) and animates it.
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
  'avatar: every human seat shows a face; a design change re-renders live',
  { skip: skip('avatars0', 'avatars2') },
  () => {
    // Plan (avatars.md §11): lobby seats render <dg-avatar>; open the designer, save, and the title bust
    // and the seat badge update without a reload.
  },
);

void test(
  'turns: "your turn" reaches the other player as an alert while they are away',
  { skip: skip('savedGames3', 'savedGames4') },
  () => {
    // Plan (saved-games.md phase 4): A moves while B is on another page; B gets the hub's "your turn"
    // notice, opens it, and lands on the turn game at the new move.
  },
);

void test(
  'avatar: the Pixi and three.js adapters draw the same face as <dg-avatar>',
  { skip: skip('avatars0', 'avatars4') },
  () => {
    // Plan (avatars.md phase 4): src/game/avatar.ts uses the hub's adapter for the starter's renderer;
    // a shot of the title bust matches the DOM avatar for the same design.
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
