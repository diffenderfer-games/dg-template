# kit/daily-puzzle

Source: `src/kit/daily-puzzle/` (KIT: copy byte-identical; change it in the template first).


Plain TypeScript for a **short, solver-checked daily**: a slice of the game, set
up from the day's seed, with only one or two winning lines (Pop Four's
"win in N" is the model; the host's `docs/plans/daily-puzzles.md` is the plan).
It isn't a package and doesn't import the hub: **copy the folder** into your
game and plug in your engine.

```bash
cp -r ../dg-template/src/kit/daily-puzzle src/kit/   # byte-identical: change it here first, then re-copy
```

Your `tsconfig.json` needs `"allowImportingTsExtensions": true` (the kit
imports `./rng.ts`, so it also runs under Node's type stripping, e.g. a game
server or `node --test`). Puzzles and actions must be JSON: declare them with
`type`, not `interface`.

| File | What it gives you |
|---|---|
| `rng.ts` | `mulberry32`, `hashSeed`, `seedForDay` (the hub's own seed: use it offline), `randInt`/`pick`/`shuffle`/`weighted` |
| `search.ts` | `PuzzleRules<S, A>` (your engine: `moves`, `apply`, `won`), `findWinningLines` (distinct lines, merged by `stepKey`; `limit`, `maxDepth`, `maxNodes`), `hasWinningLine`, `firstMoveOutcomes`, `choicesAlong` |
| `generate.ts` | `generate(rng, { scenario, solve, accept? }, { attempts, solutions, prefer?, band, timeBudgetMs, fallback })`: the generate → solve → filter loop |
| `attempts.ts` | `starsFor` (3 / 2 / 1 by try), `recordFail`/`recordWin`/`mergeBooks`/`pruneBook` for your save, `PuzzleRun` (one try, with the **instant fail** when no winning line is left) |
| `version.ts` | `versionFor(versions, day)`: the pinned generator version with a `from` cutoff, so back-filled days rebuild identically |
| `replay.ts` | `replayLine`, `verifyDailyLine`: replay a reported `meta.line` through the real engine |
| `hub.ts` | `completeDaily(hub.daily, { stars, attempts, gen, line })`, `cancelDaily(hub.daily)`, `inDaily` |
| `harness.ts` | `assertDailyHarness({ game, from, days: 365, build, solutions, timeBudgetMs, engine })`, `dailyHashes` |

The shape of a game's daily:

```ts
import * as kit from './kit/daily-puzzle/index.ts';

const VERSIONS: kit.GenVersion<(seed: number) => kit.Generated<Puzzle, Action>>[] = [{ version: 1, from: null, build: buildV1 }];
export const buildDaily = (seed: number, day: string) => kit.versionFor(VERSIONS, day).build(seed);

function buildV1(seed: number) {
  const rng = kit.mulberry32(seed);
  const tier = kit.pick(rng, TIERS);               // the day's difficulty, from the seed
  return kit.generate(rng, {
    scenario: (r) => makeScenario(r, tier),        // a candidate position
    solve: (p) => {                                // your engine through PuzzleRules
      const r = kit.findWinningLines(rules, startOf(p), { limit: 3, stepKey });
      return { lines: r.lines, difficulty: score(p, r.lines), exact: r.stopped !== 'nodes' };
    },
  }, { attempts: 2000, solutions: { min: 1, max: 2 }, band: tier.band, timeBudgetMs: 1500, fallback });
}

hub.daily.define({ play: (ch) => startPuzzle(ch.day, buildDaily(ch.seed, ch.day)) });
// play: run = new kit.PuzzleRun(rules, startOf(puzzle)); run.play(action) → 'playing' | 'won' | 'failed'
// win:  kit.completeDaily(hub.daily, { stars, attempts, gen: 1, line: run.line })
// quit: kit.cancelDaily(hub.daily) on every way out that isn't a win
```

Rules that keep it fair: only the seeded RNG in the generator and solver (no
`Math.random`, `Date` or `Intl`); the time budget is measured, never used to
stop early (that would make slow devices get other puzzles); a new generator
gets a new `GenVersion` with a future `from` day; and a daily never touches
normal progress, the Resume run or the normal leaderboards. In your tests, run
`assertDailyHarness` over 365 days with your real engine, and snapshot
`dailyHashes` for a few fixed days.

## Also exported

These are in the folder but were not in the original table:

| File | What it gives you |
|---|---|
| `days.ts` | UTC day keys as the hub uses them: `isDayKey`, `todayUTC`, `addDays`, `daysBetween`, `dayRange` |
| `json.ts` | `Json`, `JsonObject`, `stableStringify`, `jsonEqual`, `hashJson` |
| `search.ts` | also `choiceCount` |
| `version.ts` | also `checkVersions`, `versionNumbered` |
| `harness.ts` | also `runDailyHarness` (the report without the assertions) |
| `generate.ts` | also `Range`, `inRange` |

## Relationship to the other kit modules

`kit/rng` and `kit/core/json` currently re-export from this folder (`kit/rng` re-exports `mulberry32`, `hashSeed` and the rest from `daily-puzzle/rng.ts`; `kit/core/json.ts` re-exports `Json`, `stableStringify` and `jsonEqual` from `daily-puzzle/json.ts`). So there is one `mulberry32` in the kit. The planned change is the reverse: daily-puzzle will import from `kit/rng` and `kit/core/json`. Until then, a game that copies `kit/rng` or `kit/core` must copy this folder too.

## Tests

`tests/kit/daily-puzzle/` has `basics`, `generate`, `harness`, `play` and `search` suites, plus `toy.ts`, a tiny engine they share. Copy them with the folder.

## Hub API used

`hub.daily` only, through `completeDaily(hub.daily, ...)`, `cancelDaily(hub.daily)` and `inDaily`. The rest of the folder does not touch the hub. See [Daily challenges](../hub.md#daily-challenges).
