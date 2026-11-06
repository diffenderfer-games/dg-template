# kit/challenges

Source: `src/kit/challenges/` (KIT: copy byte-identical; change it in the template first).

A **challenge** is a short seeded goal in this game, played for another game that the hub vouches for.
Diffenopoly's Game mode is the first user: a player wins a space, pays half rent or escapes Game Over by
beating that space's game's challenge ("Sudoku: solve this Easy grid", "Rosco: grab 40 biscuits"). The hub
side is in [docs/hub.md "Challenges"](../hub.md#challenges-one-games-short-goal-for-another-game).

Diffenopoly opens this game at `/<game>/?hub_challenge=<id>`. The kit reads `hub.challenges.active` at boot,
plays the challenge with the game's `challenge` hook, shows a "Challenge for Diffenopoly" banner, reports
won or lost to the hub (`hub.challenges.complete`) and takes the player back to Diffenopoly. The game writes
one hook.

## What the game does

Add a `challenge` block. `play` builds the game in progress for a short goal from the hub's `seed` and the
`level`, using only `opts.rng` (like `newRun`); the game's own `outcome` ends it (`'won'` or `'lost'`).

```ts
import type { ChallengeHooks } from '../kit/boot/index.ts';

export const challenge: ChallengeHooks<Profile, Run> = {
  // A minute or two for Easy, a few minutes for Hard. Same seed, same challenge.
  play: (_ctx, { seed, level, rng }) => newChallengeRun(seed, level, rng),
  // Optional: the goal in a few words, under "Challenge for Diffenopoly".
  goal: (level) => `Solve this ${level} grid`,
};

// in the game definition
{
  challenge;
}
```

- `level` is `'easy' | 'medium' | 'hard'` (Diffenopoly picks it from the space's price).
- Keep it short and winnable: a challenge decides a space on a board others are waiting on. A goal with a
  clock or a target ("40 biscuits in 60 seconds", "mate in 2") fits better than a full game.
- `outcome(run)` returns `'won'` the moment the goal is met and `'lost'` the moment it can't be any more.
  The kit finishes it the frame `outcome` first says so ([hooks.md](hooks.md#endings-take-time-keep-outcome-null-until-theyre-done)).
- `step`, `render`, the HUD and the result screen are the game's own, as in normal play.

A game without the hook still opens: the player is told the game doesn't have challenges yet, with a
"Back to Diffenopoly" button, and the title shows. Diffenopoly shows "Challenge coming soon" for it.

## What the kit does for you

- Routes the challenge first at boot (after a race or a launch): it waits up to 8 s
  (`CHALLENGE_LOOKUP_MS`) for `hub.challenges.active`, then plays an `open` one at once (no title).
- Sets the activity to `challenge`: no profile, board, stat or Continue writes, and no `onResult`.
  A normal game in progress is saved first.
- Shows the banner (`data-testid="challenge-banner"`, CSS `.kit-challenge`: theme it like the rest) under the HUD.
- Pause works; Restart plays the same challenge again from its seed; Quit asks "Give up the challenge?"
  (a loss) first.
- At the end: reports it once (`hub.challenges.complete(id, { won })`; a failure shows "Try again"), shows
  the result screen with **Back to Diffenopoly** (`challenge-back`) instead of Play again and Quit, and goes
  back by itself `CHALLENGE_RETURN_MS` (5 s) after the hub answered. Back or Esc on the result goes back too.
- A reload after the end reports the same result again (the hub keeps the first) and goes straight back.
- One out of time (30 minutes) or unreadable: a note with the way back; the title shows.

## Rules it enforces

- A challenge is played once from the hub's seed; its result never reaches the profile, the boards or
  Continue (the isolation guard is `Activity`).
- The kit never decides the result: the game's `outcome` does.
- An online game's result reaches the board as the hub's own move (`$hub`); nothing here can send one:
  [docs/multiplayer.md §16.2](../multiplayer.md#162-the-rules-module).

## Options / API

| Name                                         | What it is                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ChallengeHooks<P, R>`                       | The game's hook: `play(ctx, { seed, level, rng })`, `goal?(level, run)` (kit/boot types) |
| `installChallenges(hub, options)`            | The adapter `defineGame` installs; null when the hub client has no `hub.challenges`      |
| `ChallengeOptions`                           | `clock`, `playable`, `onPlay(challenge)`, `notify(text, action?)`                        |
| `ChallengeHandle`                            | `requested`, `current`, `route()`, `finish(won)`, `goBack()`, `dispose()`                |
| `CHALLENGE_LOOKUP_MS`, `CHALLENGE_RETURN_MS` | 8 s to find the challenge; 5 s on the result before going back                           |

`hub.challenges` is newer than the pinned hub client (next.21): `core/planned.ts` has its shapes
(`ChallengesLike`, `KitChallenge`), and the kit uses it only when the client has it. The FakeHub has it
with `createFakeHub({ planned: { challenges: true } })`; `fake.challenges.open({ ... })` before boot opens
the page for one.

## Tests

- `tests/kit/challenges/challenges.test.ts` (the adapter)
- `tests/hub-events/challenge.test.ts` (the game booted for a challenge: banner, isolation, the result, give up)

## Hub API used:

- `hub.challenges.requested`, `hub.challenges.active`, `hub.challenges.complete`, `hub.challenges.goBack`
