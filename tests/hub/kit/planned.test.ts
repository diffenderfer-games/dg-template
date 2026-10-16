// KIT suites still waiting: written now, skipped with what unblocks them. (No host boots while every
// test here is skipped.) Turn one on by moving it into its own file with env(), as saved.test.ts and
// avatar.test.ts were when saved games and avatars went live (client next.6), and turns.test.ts and
// world.test.ts when online games on the server (next.8) and a game's own room (next.9) did.
import { test } from 'node:test';
import { shipped, waitsOn } from '../../../src/kit/testing/phases.ts';

const skip = (...phases: Parameters<typeof waitsOn>): string | false =>
  shipped(...phases) ? false : waitsOn(...phases);

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
    // Plan (world.md §3.4): three contexts sit at the game's table in its room; each gets a host/guest
    // launch with launch.table; all land in one room; the game used launch.table.options.
  },
);

void test(
  'turns/table: a table in the world opens an online game the hub runs, with no host step',
  { skip: skip('worldW2') },
  () => {
    // Plan (world.md §3.4, saved-games phase 3): two players sit at a duel table; the join launch opens the
    // online game on the kit's screen (kit/turns), seated and started.
  },
);
