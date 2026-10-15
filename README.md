# dg-template — diffenderfer.games game starter

A ready TypeScript + [Vite](https://vitejs.dev) + [PixiJS v8](https://pixijs.com)
starter for building a game for the **diffenderfer.games** catalog, with the
shared **hub** client (accounts, saves, stats, leaderboards, inventory, and a
unified keyboard/mouse/touch/gamepad input system) vendored in.

## Where games live: the diffenderfer-games organization

Every game is a repo in the GitHub organization
**[diffenderfer-games](https://github.com/diffenderfer-games)** (the host is
[diffenderfer-games/diffenderfer-games](https://github.com/diffenderfer-games/diffenderfer-games)).
To start a new game:

1. **Create the repo in the org from this template**:
   [diffenderfer-games/dg-template](https://github.com/diffenderfer-games/dg-template) →
   **Use this template** → Create a new repository → Owner **diffenderfer-games**,
   name = the game's slug (lowercase `a-z0-9-`), **Private**. Then clone it beside
   the host repo (`git clone https://github.com/diffenderfer-games/<slug>.git`).
   Locally, `tools/New-Game.ps1` makes the folder from this template instead;
   then create an empty private repo in the org and push to it.
2. **Add the deploy secrets to the repo** (Settings → Secrets and variables →
   Actions, or `gh`):
   `gh secret set DEPLOY_SSH_KEY -R diffenderfer-games/<slug> < ~/.ssh/diffenderfer_deploy`
   and `gh secret set DEPLOY_HOST -R diffenderfer-games/<slug> -b diffenderfer.games`
   (`DEPLOY_HOST` defaults to `diffenderfer.games` if unset). Add `DEPLOY_PATH` only
   when the server folder isn't the repo name. Each repo has its own copies: org
   secrets would need a paid plan for private repos.
3. **The org's self-hosted Windows runner deploys it automatically**: one runner on
   the owner's machine serves every private repo in the org, so there is nothing to
   register. The deploy runs only there (GitHub-hosted runners aren't used), and only
   for a push to the default branch or a manual run.
4. **Push to `main`/`master`: the first deploy puts it on the host.** When the
   droplet has no clone yet, the deploy clones the repo into `/root/<repo>`
   (the droplet's `gh` login reads private org repos), runs `npm install`,
   links it as `/root/diffenderfer-games/apps/<slug>` (slug = the repo name,
   lowercased; set the repo variable `DEPLOY_SLUG` to override) and restarts the
   catalog. Later pushes just pull, install and restart. Check
   https://diffenderfer.games/<slug>/. (The manual way still works: the host's
   [RUNNERS.md](https://github.com/diffenderfer-games/diffenderfer-games/blob/master/RUNNERS.md)
   "New game checklist" and
   [DEPLOY.md](https://github.com/diffenderfer-games/diffenderfer-games/blob/master/DEPLOY.md)
   § 12 "Adding a new game".)

**This template repo itself is public** (so it can be used as a template and read
freely). Public repos never get the org's self-hosted runner, and it has no deploy secrets: its
deploy job is guarded off (`if: github.repository != 'diffenderfer-games/dg-template'`),
so it runs on no runner at all. A game made from it is private and uses the org runner.

## Quick start

```bash
npm install
npm run dev      # play the starter ("collect the coins")
npm run build    # produces dist/  (what the catalog serves)
node scripts/shots.mjs   # screenshots of dist/ (desktop + phone) into shots/; see CLAUDE.md
```

## What's here

```
index.html            Vite entry
vite.config.ts        base:'./' (required — games mount under /<slug>/)
package.json          the `game` block the catalog reads (incl. `changes`: the
                      player-facing "What's new" list; add a line per visible change,
                      and `labels`: tags for the catalog filter, see below)
src/
  main.ts             starter game — Pixi + hub input + saves + leaderboard + daily
  kit/daily-puzzle/   reusable daily-puzzle kit (copy into a game; see "Daily puzzle kit")
tests/kit/            the kit's unit tests (`npm test`, vitest)
scripts/sync-docs.mjs re-copies the three docs below from ../diffenderfer-games
HANDOFF.md            how the catalog builds & mounts a game (read this; synced from the host)
docs/hub.md           full hub API: accounts, saves, leaderboards, input, … (synced from the host)
docs/multiplayer.md   friends, presence, invites, rooms, chat, races (§14) (read if online or racing; synced from the host)
docs/audio.md         music/continuous audio in a background Web Worker (required pattern)
CLAUDE.md             brief for an AI assistant building the game
```

## Building a game

Point a fresh Claude Code instance at this folder and tell it to make a game —
it reads `CLAUDE.md`. Or do it yourself: rewrite `src/main.ts`, set your
`game.title`/`description` in `package.json`, keep `base:'./'`, and use
`import { hub } from '@diffenderfer-games/hub'` for online features and input. See `CLAUDE.md`
and `docs/hub.md`. Online games (invites, rooms, chat) follow
`docs/multiplayer.md`.

Set `game.labels` so players can find the game with the catalog's filter. Use
only these, chosen from what the code really does: a genre (`cards`, `board`,
`puzzle`, `arcade`, `platformer`, `real-time-strategy`, `physics`, `typing`,
`word`, `sports`, `racing`), `2d` or `3d`, `phone` (touch or on-screen controls
and a phone layout), `controller` (gamepad bindings), `desktop` (only if it
needs a keyboard or mouse), and `single-player` and/or `multiplayer`.

## Daily puzzle kit (`src/kit/daily-puzzle/`)

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

## Updating the hub client

The hub client is the npm package
[`@diffenderfer-games/hub`](https://www.npmjs.com/package/@diffenderfer-games/hub),
pinned to an exact version in `package.json` (a `2.0.0-next.N` prerelease for
now). Never copy its sources into the game.

```bash
npm install --save-exact @diffenderfer-games/hub@<version>   # then npm run build
npm run hub-doctor   # supported by the live hub, game.* is valid, no vendored copy
```

## Updating the docs and the game-server SDK

```bash
npm run sync-docs                      # from ../diffenderfer-games
npm run sync-docs -- ../path/to/host   # or DG_HOST=... npm run sync-docs
```

This copies `docs/hub.md`, `docs/multiplayer.md` and `HANDOFF.md` from the
host. Never hand-edit these copies.

Own-server games (with a `server/` folder) keep a copy of the game-server SDK
in `server/hub-server.mjs`. It is not on npm: `npm run sync-hub-server` copies
the build from the sibling host checkout (`../diffenderfer-games`, after
`npm ci` in its `next/`). Then run the game's tests and commit just that file.

## Hosting

Clone this beside the [diffenderfer-games](https://github.com/diffenderfer-games/diffenderfer-games)
host repo and symlink it into `apps/<slug>/` (see the host's `DEPLOY.md`). The
catalog discovers it, runs `npm run build`, and serves `dist/` under `/<slug>/`.

Deploys: `.github/workflows/deploy.yml` deploys on every push to `main`/`master`
once the repo secret `DEPLOY_SSH_KEY` is set ("Where games live", step 2). By default the deploy runs
on the org's self-hosted Windows runner (no Actions minutes; nothing to register
per repo — see the host's
[RUNNERS.md](https://github.com/diffenderfer-games/diffenderfer-games/blob/master/RUNNERS.md)).
It runs only for a push to the default branch or a manual run (never for pull
requests); in this template repo itself it never runs.
