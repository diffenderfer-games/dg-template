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
