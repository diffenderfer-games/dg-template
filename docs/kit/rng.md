# kit/rng

Source: `src/kit/rng/` (KIT: copy byte-identical; change it in the template first).

Seeded randomness. A seed in, the same numbers out, on every device. Dailies and races depend on this: everyone must get the same puzzle from the same seed. The module also has `SeededRng`, a generator whose whole state is one number, so a game in progress can be saved and restored exactly. `defineGame` makes the `SeededRng` for you and passes it to `newRun` as `opts.rng`. The functions that already existed in the daily-puzzle kit are re-exported from here, so the kit has one `mulberry32`.

## What the game does

Use only `opts.rng` inside `newRun` and store `rng.snapshot()` in the saved game. Do not call `Math.random` in game rules.

```ts
import { SeededRng, deriveSeed, shuffle } from '../kit/rng/index.ts';

// in newRun(ctx, opts): the only randomness is opts.rng
const rng = opts.rng;
const start = { x: rng.int(0, 1600), y: rng.int(0, 1000) };
const enemies = rng.fork('enemies'); // its own sequence
const order = shuffle(enemies.rng, [1, 2, 3, 4]);
const state = { seed: opts.seed, rng: rng.snapshot(), start, order };

// when restoring a saved game
const again = SeededRng.restore(state.rng); // continues exactly where it left off
const sub = deriveSeed(state.seed, 'music'); // a stable sub-seed from a name
```

## What the kit does for you

- Builds `new SeededRng(seed)` for every `newRun` call and passes it as `opts.rng`.
- Picks the seed: `randomSeed()` for a normal game, the hub's seed for a daily, the race seed for a race.
- Gives a daily a calendar seed offline too (`seedForDay(slug, day)`), so the offline day is the same puzzle.
- Keeps `new SeededRng(s).next()` equal to `mulberry32(s)()`, so games that already use `mulberry32` keep their golden values.

## Rules it enforces

- Same seed, same puzzle for a race: [docs/multiplayer.md §14.3](../multiplayer.md#143-fairness-same-seed-same-puzzle).
- Dailies use the hub's seed, never a random one: [docs/hub.md Daily challenges](../hub.md#daily-challenges).
- `randomSeed()` is the only `Math.random` in the kit. Use it for normal games, never for dailies or races (stated in its TSDoc; nothing checks it).

## Options / API

| Export | What it is |
| --- | --- |
| `SeededRng` | Generator with one-number state |
| `SeededRng#next()` | Float in [0, 1) |
| `SeededRng#int(lo, hi)` | Whole number, both ends included |
| `SeededRng#chance(p)` | True with probability `p` |
| `SeededRng#rng` | The same generator as a plain `Rng` function (shares state) |
| `SeededRng#fork(name)` | Independent generator for a named purpose; does not advance this one |
| `SeededRng#snapshot()` / `SeededRng.restore(state)` | Save and restore the state |
| `randomSeed()` | A fresh random seed (never 0) |
| `hashString(text)` | FNV-1a, a 32-bit seed from text |
| `deriveSeed(seed, name)` | A sub-seed for a named stream |
| `randFloat(rng, lo, hi)` | Float in [lo, hi) from an `Rng` |
| `rngFrom(seed)` | A plain `Rng` from a seed (alias of `mulberry32`) |
| `mulberry32`, `hashSeed`, `seedForDay`, `pick`, `randInt`, `shuffle`, `weighted`, `Rng` | Re-exported from the daily-puzzle kit |

Note: `fork(name)` derives its seed from the generator's current state, so the same name gives a different stream if you fork at a different moment. Fork right after construction when you need a stable stream, or use `deriveSeed(seed, name)`.

## Tests

- `tests/kit/rng/rng.test.ts`
- `tests/game/` and `src/game/sim.ts` rely on it for repeatable sims ([testing](testing.md#sim)).

## Hub API used:

- None. This module is pure and never touches the hub.
