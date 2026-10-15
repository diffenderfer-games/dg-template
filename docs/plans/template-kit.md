# Plan: the dg-template game kit (a complete, standardized starter)

Status: **draft, revised after the user's review (2026-10-15). Planning only:
nothing in this file is built yet**, except the daily-puzzle kit
(`src/kit/daily-puzzle/`), the first kit module. The user's answers are in
§12.1 "Decisions" and override anything above them.

**Existing games are not migrated now.** The approach is to build the kit,
make a few new games with it, and improve the template's code and context
(docs, CLAUDE.md) after each one (§10). Moving the existing games onto the kit
is a future endeavour, planned in
[template-kit-migration.md](template-kit-migration.md).

> **The ask (the user, trimmed):** *"document common code and unit tests and
> scripts that could go into dg template to completely flesh common things out.
> Like implement all the hub things and just leave files with empty functions
> with Todo comments for the game to implement. Always assume typescript. Have a
> pixijs or threejs starter. Have premade scripts for helping with screenshotting
> common scenarios like splash screen or after hub events. Unit tests for all hub
> events. The dg template implementor just needs to implement game specific
> things but all reusable code should be extracted from the other games … I want
> to standardize how games are made and tested so out of the box it gets easier
> and easier to make a game. … Also plan what additional documentation or doc
> refactoring should go into the template."*

**Sources.** The hub's game-facing docs (`HANDOFF.md`, `docs/hub.md`,
`docs/multiplayer.md`), the plans `docs/plans/saved-games.md` (with its §11
decisions), `docs/plans/daily-puzzles.md`, `docs/plans/avatars.md` and
`docs/plans/world.md`, and a read-only survey of all 28
game repos plus this template (2026-10-14). The hub is moving from `next/` to its
repo root, so this plan names **packages** (`@diffenderfer-games/hub`,
`@diffenderfer-games/hub-contract`, the private `@dg/hub-testkit`) and the
test-kit files that keep their paths (`test/helpers/*.mjs`,
`test/e2e/helpers.mjs`), not `next/...` paths.

---

## Contents

- [Summary](#summary)
- [1. Goals and principles](#1-goals-and-principles)
- [2. The proposed repo layout](#2-the-proposed-repo-layout)
- [3. How a game is wired: `defineGame` and the hooks](#3-how-a-game-is-wired-definegame-and-the-hooks)
- [4. Kit modules, one at a time](#4-kit-modules-one-at-a-time)
- [5. Starters: PixiJS and three.js](#5-starters-pixijs-and-threejs)
- [6. Testing](#6-testing)
- [7. Screenshot tooling](#7-screenshot-tooling)
- [8. Scripts and tooling](#8-scripts-and-tooling)
- [9. Docs: what to add, split, merge and rewrite](#9-docs-what-to-add-split-merge-and-rewrite)
- [10. Making new games with the kit (the iteration loop)](#10-making-new-games-with-the-kit-the-iteration-loop)
- [11. Phasing and effort](#11-phasing-and-effort)
- [12. Decisions and open questions](#12-decisions-and-open-questions)
- [Appendix A. Every common piece found](#appendix-a-every-common-piece-found)
- [Appendix B. Hub events and callbacks, with the kit handler and test for each](#appendix-b-hub-events-and-callbacks-with-the-kit-handler-and-test-for-each)
- Separate file: [template-kit-migration.md](template-kit-migration.md) (future: moving existing games onto the kit)

---

## Summary

**What the survey found.** All 28 games re-implement the same hub glue by hand,
and each copy is at a different stage:

- **Hub wiring is the same in every game.** Register `autoPause`, `mp.onLaunch`
  and `race.define` before the first `await`. Queue anything that arrives early,
  then route from the URL (`?daily=`, `?race`, `?mp=lobby`, `hub_resume`).
- **Saves are guarded five different ways.** Every game has its own version of
  "don't push over a cloud save you haven't read". Three games still have no
  guard (helixdrop, downfall, geometrydungeon).
- **Resume has about 19 copies.** Each has its own late-load race guard.
- **The daily rule is still broken in three games.** The rule is "a daily never
  touches normal progress", but dinodasher, helixdrop and bubblepop still let
  it.
- **Races have 10 copies.** Each has its own race-bar offset, reload stash and
  status throttle.
- **Online play has 5 copies of the host-backup logic.** That covers successor
  election, host backups and computer seats.
- **Small helpers are copied everywhere:**
  - at least 16 copies of `mulberry32`;
  - 3 copies of the worker-music engine;
  - 4 copies of `haptics.ts`, byte-identical;
  - 2 identical copies of `juice.ts`;
  - about 10 hand-made toast and modal systems.
- **No two games have the same `tests/hub/` boilerplate**, and test-hook names
  differ in every game.
- **Unit tests use 5 different runners.**
- **There are 22 different `deploy.yml` files.**
- **`autoPause` is missing in 8 games**, even though CLAUDE.md requires it.

**What the plan proposes.** Turn dg-template into a starter with two clearly
separated areas:

1. **`src/kit/`: reusable and copied byte-identical, don't edit.** About 20
   small TypeScript modules extracted from the best version in each game. Each
   module:
   - takes the hub as an injected, structural `HubLike`, so a `FakeHub` can
     unit-test it;
   - has its own vitest suite;
   - follows the copy rule the daily-puzzle kit already uses: change it in the
     template first, then re-copy.
2. **`src/game/`: yours to edit.** Files with the hook functions stubbed, each
   with a `TODO` comment. There is one entry point:
   `defineGame({ ... })` in `src/main.ts`. The kit does every hub duty: pause,
   resume, daily, race, launch routing, save guards, the test hook, and
   screenshot scenes. The game fills in `newGame`, `step`, `render`,
   `serialize`, and so on.

Around those two areas:

- **Two starters.** `starters/pixi/` (PixiJS 8) and `starters/three/`
  (three.js r186). `npm run new-game -- --renderer pixi|three` keeps one and
  deletes the other.
- **A test pyramid:**
  - kit unit tests;
  - one **hub-event unit test for every hub event and callback**, against the
    `FakeHub` (Appendix B);
  - browser hub suites against a real local hub, using the hub's own test kit;
  - multiplayer scenarios;
  - a seeded simulation harness.
- **A screenshot runner with premade scenarios:** title, intro, menu, gameplay,
  pause, hub menu open, daily started and completed, the "Your games" card,
  invite received, race HUD, toast, avatar, table launch. Each runs at phone and desktop sizes, and
  the results go into one contact sheet.
- **Versioning without an npm package.** A `kit.json` manifest with a kit
  version and a file hash per module. Two scripts use it:
  - `npm run kit:sync` copies modules from `../dg-template`;
  - `npm run kit:check` fails when a copy was edited.
  - `docs/kit/CHANGELOG.md` says what changed.
- **Docs refactored.** A short README, a getting-started guide ("make a new
  game in 10 steps"), one doc per kit module, a testing doc and a screenshots
  doc. `CLAUDE.md` becomes a short brief that points at those docs instead of
  repeating `hub.md`.

**The approach: build the kit, then make new games with it.** Existing games
are not migrated now (the user, 2026-10-15). The order is:
1. build the kit, the starters, the tests, the screenshot tooling and the docs
   in the template (P0–P5);
2. make **a few new games** from the template, each a different shape (§10);
3. after each one, feed what was learned back into the template: kit code,
   stubs, docs and CLAUDE.md. Each new game should be faster to make than the
   one before.

Moving the existing 28 games onto the kit is a future endeavour:
[template-kit-migration.md](template-kit-migration.md).

**Planned hub work is built in.** Three hub plans, none built yet:
- `saved-games.md`: days in progress, `hub.saved`, turn games with
  server-run rules, and "your turn" alerts;
- `avatars.md`: the look, the renderer, the animator, the designer,
  `<dg-avatar>` and the Pixi/three.js adapters;
- `world.md`: `game.world.tables`, `launch.table`, `dg-room@1` room files,
  the People panel and `setRoster`.

Each gets a kit module, stubs, tests and docs that a new game has out of the
box (§4.23–§4.26). Anything that needs an unpublished hub API is written
against a feature check, and its tests are skipped with a reason that names the
hub phase it waits on.

**Effort.** About 4 weeks of agent time for the kit and template (P0–P5), then
1 to 2 weeks per new game, with the template improved after each one (§11).

---

## 1. Goals and principles

1. **TypeScript, always.**
   - Kit, starters, tests and scripts are all `.ts`.
   - Scripts run with Node's built-in type stripping: `node scripts/x.ts`. It is
     on by default from Node 22.18; this machine has 22.22.
   - Browser hub suites are `.ts` too (decision 8, §6.3).
   - **Strict everywhere** (decision 4): `tsconfig` sets `strict: true` for
     the kit, the game, the tests and the scripts. The template is
     `strict: false` today.
2. **Every hub duty comes pre-implemented.** A new game writes only game rules,
   rendering and copy.
   - The kit owns everything the hub docs say every game must do:
     - pause on hub open;
     - the save guards;
     - resume and saved games;
     - the daily's isolation from normal progress;
     - race wiring;
     - the launch handlers, registered within 8 s and before any `await`;
     - presence, busy and quiet;
     - leave guards;
     - the test hook.
   - The game implements **hooks**: typed functions in `src/game/`, delivered
     as stubs with `// TODO(game):` comments. They throw a clear "not
     implemented yet" error, or return a safe default when the feature is
     optional.
3. **One standard shape.** Every game uses the same layout, the same
   `defineGame` entry point, the same test-hook name (`window.__game`), the same
   scripts, the same tests and the same screenshot scenario names. An agent that
   has worked on one game can work on any of them.
4. **Out of the box it gets easier.**
   - A fresh copy builds, passes `npm run check`, and passes the hub-event unit
     tests and the pause hub test with the stub game.
   - The stub game is a playable "collect the coins", kept from today's
     starter but rebuilt on the hooks.
   - Its screenshot scenarios render on day one.
5. **Easy to keep up to date, with no npm package.**
   - Kit modules are **copied byte-identical** from the template, following the
     daily-puzzle rule.
   - `kit.json` records the kit version and a hash for each file.
   - `npm run kit:sync [module…]` pulls from `../dg-template`, or from
     `DG_TEMPLATE`.
   - `npm run kit:check` (part of `npm run check`) fails when a game edited a
     kit file.
   - `docs/kit/CHANGELOG.md` lists every change by version.
   - **Fixes always land in the template first.** Games made from the
     template pick them up with `kit:sync`.
   - **No npm package** (decision 1).
6. **The hub stays the source of truth.**
   - The kit wraps `@diffenderfer-games/hub` and never re-implements it: no
     accounts, chat, invites or menus.
   - When the hub grows a feature, such as `hub.saved` and `hub.turns` from
     `saved-games.md`, the kit gets a thin adapter, and the game hooks stay
     the same.
   - The hub's docs (`hub.md`, `multiplayer.md`, `HANDOFF.md`) stay synced
     copies. Kit docs link to them by heading and never paraphrase their rules.
7. **Kit modules are small, layered and dependency-free.**
   - Each module is a folder with an `index.ts`.
   - No module imports a renderer: Pixi and three.js live only in the starters.
   - A module never imports the hub client directly. It imports only
     `import type` from `@diffenderfer-games/hub` (`kit/core/hub-like.ts`),
     and the real `hub` is passed in once by `defineGame`. That is what makes
     unit tests with a `FakeHub` possible.
   - Pure modules (`rng`, `daily-puzzle`, `save/merge`, `online/wire`) also run
     under Node, for game servers and sims.
8. **Player-facing wording follows the hub.**
   - Kit UI strings never say "run", "turn game" or the kind names
     (saved-games.md §11). The UI says "Continue", "Your saved game",
     "Daily challenge · Oct 14" and "Online with Sam · your turn".
   - There are no violent words in UI copy (multiplayer.md).
   - Kit strings sit in one `kit/core/strings.ts` table, so a game can
     override them, and later localize them (§4.21).
9. **Never weaker than the best game.** Each kit module starts from the best
   version found (Appendix A) and merges in the guards from the others. The
   recent progress-reset audit's fixes become kit tests, so no game can
   regress on them.
10. **Improve from real use.** The template grows from making new games with
    it (§10). Each game ends with a retro, and its findings go back into the
    kit, the stubs, the docs and CLAUDE.md before the next game starts.
11. **Ready for the planned hub.** The planned hub APIs (saved games, turn
    games, avatars, world tables) have their kit adapters, stubs, tests and
    docs in place before the hub ships them. Turning them on is a kit minor
    version, not a rewrite (§4.23–§4.26).

---

## 2. The proposed repo layout

There are three kinds of file:

- **KIT**: synced from the template, don't edit. `kit:check` enforces this.
- **GAME**: yours to edit, delivered as stubs or examples.
- **SYNCED**: copied from the hub repo by `sync-docs` or `sync-hub-server`.

```
dg-template/
├─ README.md                    GAME  short: what this is, 10-step quick start, links (template keeps the long version in docs/)
├─ CLAUDE.md                    GAME  short agent brief, not synced (decision 12): rules, where things live, links to synced + kit docs (§9.3)
├─ HANDOFF.md                   SYNCED from the hub (catalog build/mount rules)
├─ kit.json                     KIT   { kitVersion, modules: { name: { version, files: { path: sha256 } } } } – what kit:check verifies
├─ package.json                 GAME  scripts (standard set, §8) + the `game` block
├─ index.html                   GAME  Vite entry; #app, #ui overlay root, viewport-fit=cover
├─ vite.config.ts               GAME  base:'./' (required), es2022, worker format 'es', optional /ws proxy for own-server
├─ vitest.config.ts             GAME  projects: kit, game, hub-events (jsdom where needed)
├─ tsconfig.json                GAME  strict, allowImportingTsExtensions (kit imports './x.ts' so it also runs under node)
├─ .github/workflows/deploy.yml KIT   the current self-hosted-only deploy (dg-template's) + the check and hub-suite gate (§6.6)
├─ cover.png                    GAME  catalog tile (make it with `npm run cover`)
├─ docs/
│  ├─ hub.md, multiplayer.md    SYNCED from the hub
│  ├─ getting-started.md        KIT   "make a new game in 10 steps" (§9.1)
│  ├─ game.md                   GAME  this game's design notes, controls, race/daily design (the per-game section CLAUDE.md used to carry)
│  ├─ kit/                      KIT   one doc per module + CHANGELOG.md + testing.md + screenshots.md + audio.md (moved from docs/audio.md)
│  └─ plans/                    GAME  plans for this game (the template keeps its own here: this file)
├─ src/
│  ├─ main.ts                   GAME  3 lines: import hub, import game, defineGame(hub, game)
│  ├─ kit/                      KIT   reusable modules (§4); never imports pixi/three
│  │  ├─ core/                  hub-like types, typed events, safe storage, strings, env, log, timeout/single-flight helpers
│  │  ├─ boot/                  defineGame(): the boot order, launch queue, URL routing, routed() guard
│  │  ├─ input/                 controls helpers, menu nav targets, control hints, HUD insets, menu-button room
│  │  ├─ pause/                 autoPause policy (hub vs player pause, race-aware, visibility), pause-screen glue
│  │  ├─ save/                  guarded cloud slot, profile + settings stores, merge helpers, owner tag, auth/reset handling
│  │  ├─ resume/                hub.resume adapter with late-load guard; hub.saved adapter (when the hub ships it)
│  │  ├─ daily/                 hub.daily adapter: define → play → complete/cancel, offline fallback, isolation guard
│  │  ├─ daily-puzzle/          the solver-checked daily kit (landing now; unchanged API)
│  │  ├─ race/                  hub.race adapter: session, throttled status, reload stash, race-bar offset, leave guard
│  │  ├─ online/                launch routing, rooms host/guest, successor + host backup, computer seats, wire validation, chat panel, links, presence
│  │  ├─ saved/                 hub.saved adapter: Continue rows, opened/onOpen routing (saved-games phases 0–1)
│  │  ├─ turns/                 hub.turns adapter + TurnRules helpers, checkTurnRules (saved-games phase 3)
│  │  ├─ avatar/                seat badges, look-at loop, feelOn, result faces, nameAndFace (avatars.md §11)
│  │  ├─ scores/                recordResult(): boards + stats with the daily/race suppression rules
│  │  ├─ audio/                 AudioEngine (buses, unlock, visibility), Sfx primitives, music: worker stream + synth-core contract
│  │  ├─ haptics/               haptic(strong) – Android vibrate + iOS switch trick, settings-gated, throttled
│  │  ├─ rng/                   mulberry32, hashSeed, seedForDay, Rng class with fork/snapshot, shuffle/pick/weighted
│  │  ├─ loop/                  FixedLoop (fixed-step simulate + render(alpha)), variable-dt clamp
│  │  ├─ layout/                onResize (rotation-safe), safe-area, letterbox, layoutRegion (HUD rects + race bar), fitText
│  │  ├─ ui/                    h() DOM builder, screens, modal/sheet, toast (with actions), buttons/segmented/toggle rows, juice + confetti
│  │  ├─ settings-ui/           the standard settings sheet (sound, music, haptics, controls hint, reset) + game rows
│  │  ├─ test-hook/             window.__game: typed, gated, the shape every script and suite uses
│  │  ├─ server/                OPTIONAL own-server: static + SPA + /healthz + /ws upgrade, ticket verify, seat grace
│  │  └─ testing/               FakeHub, fake clock, fake storage – used by tests only (tree-shaken out of the build)
│  ├─ game/                     GAME  yours: every file is a stub with TODO(game) comments
│  │  ├─ game.ts                the GameDefinition passed to defineGame (wires the files below)
│  │  ├─ config.ts              SAVE/RUN versions, board keys, race params/stats, feature switches
│  │  ├─ state.ts               Profile, Settings, Run (JSON-only types) + defaults + merge rules
│  │  ├─ rules.ts               pure game rules (no DOM, no hub): newGame, step/apply, isOver, progress()
│  │  ├─ controls.ts            hub.input groups (play + any extra), virtual layout(s) by width
│  │  ├─ render/                renderer code from the chosen starter (stage, scene, sprites)
│  │  ├─ screens/               title, howto, game over – the game's look on top of kit/ui
│  │  ├─ audio.ts               the game's SFX list + music song() (optional)
│  │  ├─ daily.ts               OPTIONAL: buildDaily(seed, day) / puzzle rules for the daily-puzzle kit
│  │  ├─ race.ts                OPTIONAL: race params → level; stats of a run
│  │  ├─ online.ts              OPTIONAL: host/guest messages, computer move, view redaction, table options, onReaction
│  │  ├─ turns/rules.ts         OPTIONAL: the pure TurnRules module the hub runs (bundled by build:rules)
│  │  ├─ avatar.ts              OPTIONAL: which game events make faces react (feelOn map)
│  │  └─ test-hook.ts           extra hook fields (solveNow, setState…) merged into window.__game
│  └─ starters/                 (template only; `new-game` keeps one renderer and deletes this folder)
│     ├─ pixi/                  Pixi 8 stage, ticker, resize, assets, input binding – copies into src/game/render
│     └─ three/                 three r186 Stage, quality, adaptive resolution, loop – copies into src/game/render
├─ tests/
│  ├─ kit/                      KIT   unit tests per module (vitest)
│  ├─ hub-events/               KIT   one test per hub event/callback against FakeHub + the stub game (Appendix B)
│  ├─ game/                     GAME  rules tests, determinism, sim (stubs + examples)
│  └─ hub/                      browser suites against a real local hub
│     ├─ _kit.ts                KIT   the shared header: DG_HOST, e2eEnv, SLUG, L, waitGame, press, room helpers
│     ├─ pause.test.ts          KIT   required for every game
│     ├─ save.test.ts           KIT   save survives reload / login; guard against blank-overwrite
│     ├─ resume.test.ts         KIT   (resumable games) reload → Continue → same state
│     ├─ daily.test.ts          KIT   (daily games) start → complete → calendar mark; leave → cancel
│     ├─ race.test.ts           KIT   (race games) two players, countdown, status, finish
│     └─ online/*.test.ts       KIT   (online games) the 10 multiplayer.md §12 scenarios + table launch, parameterized by the hook
├─ scripts/
│  ├─ kit/                      KIT   shared tooling (§7, §8): shots runner, contact sheet, procs, free-port, probe,
│  │                                  smoke-prod, ui-survey, kit-sync, kit-check, sync-docs, cover, new-game
│  ├─ shots.config.ts           GAME  which scenarios to shoot + game-specific steps
│  └─ sim.ts                    GAME  seeded simulation entry (uses kit/testing + rules.ts)
├─ world/                       OPTIONAL room.tmj (Tiled) → room.json (dg-room@1) via world:build (world.md §7)
├─ server/                      OPTIONAL own-server games only
│  ├─ server.ts                 GAME  uses kit/server
│  └─ hub-server.mjs            SYNCED by `npm run sync-hub-server`
└─ tools/                       KIT   New-Game.ps1, shortcut helpers (exist today)
```

**The rules that keep the two areas apart:**

- `src/kit/**`, `tests/kit/**`, `tests/hub-events/**`, `tests/hub/_kit.ts` and
  `scripts/kit/**` are listed in `kit.json`.
- `kit:check` compares their hashes with `kit.json`.
- A game that needs different behaviour has two ways to get it:
  1. pass an option, or implement a hook (the preferred way);
  2. propose the change in the template.
- Forking a kit file is allowed only by moving it out of `src/kit/` and saying
  so in `docs/game.md`. `kit:check` then stops tracking it.
- Each kit file starts with a header naming its source, like the daily-puzzle
  kit does today:

  ```ts
  /**
   * kit/<module>: <one line>.
   * Source: dg-template src/kit/<module>/ (kit vX.Y). Copy byte-identical; change it in the template first.
   * Docs: docs/kit/<module>.md
   */
  ```

**About the daily-puzzle kit being added now.** It already follows every rule
above: plain TypeScript, no hub import (a structural `DailyHub` type),
`.ts`-extension imports, byte-identical copies, and tests in
`tests/kit/daily-puzzle/`. It stays where it is: `src/kit/daily-puzzle/`, with
`tests/kit/daily-puzzle/`. Two small follow-ups:

1. Its `rng.ts` becomes a re-export of `kit/rng` (§4.14), so there is a single
   mulberry32 in the kit. The exported names stay the same.
2. Its `hub.ts` (`completeDaily` / `cancelDaily` / `inDaily`) is used by
   `kit/daily`, the general daily adapter, so a puzzle daily and an ordinary
   daily share one exit path.

The README's "Daily puzzle kit" section moves to `docs/kit/daily-puzzle.md`.

---

## 3. How a game is wired: `defineGame` and the hooks

### 3.1 The entry point

```ts
// src/main.ts (GAME – usually never changes)
import { hub } from '@diffenderfer-games/hub';
import { defineGame } from './kit/boot/index.ts';
import { game } from './game/game.ts';

defineGame(hub, game);   // synchronous: registers every hub handler before any await, then boots
```

### 3.2 The definition (what the game fills in)

```ts
// kit/boot/types.ts (KIT) – abridged
export type GameDefinition<P extends Json, S extends Json, R extends Json> = {
  slug?: string;                                   // default: from window.__HUB__ / package name
  versions: { profile: number; run?: number };     // bump → migrate()
  profile: ProfileSpec<P>;                         // defaults, merge, progressOf, migrate (§4.4)
  settings?: SettingsSpec<S>;                      // device-local prefs (sound, haptics, …)

  // Lifecycle hooks (all in src/game/*, stubs with TODO(game))
  mount(ctx: GameContext): Promise<void> | void;   // build renderer/stage; ctx has hub, ui, audio, layout, input
  title(ctx: GameContext, cont: ContinueInfo): void;      // show the title screen; cont = Continue rows (resume/saved)
  newGame(ctx: GameContext, opts: NewGameOpts): R;        // a fresh run (normal, daily or race: opts.mode + opts.rng)
  restore?(ctx: GameContext, run: R): void;               // resume a saved run (required when versions.run is set)
  progress?(run: R): { label: string; fraction?: number }; // the "Your games" label ("Level 12 · 34 cards left")
  step?(dt: number): void;                                 // per frame (or the FixedLoop simulate)
  render?(alpha: number): void;
  pause(ctx: GameContext, why: PauseReason): void;        // show your pause screen
  resume(ctx: GameContext): void;
  onResult?(ctx: GameContext, r: RunResult): void;         // game over UI (kit already recorded scores)

  // Optional features: present → the kit wires them; absent → the kit stays out of the way
  daily?: DailyHooks<R>;          // §4.6
  race?: RaceHooks<R>;            // §4.7
  online?: OnlineHooks;           // §4.8 (rooms or own-server; table options from launch.table, §4.25)
  turns?: TurnHooks;              // §4.23 (the rules module + turn screen; once the hub ships hub.turns)
  avatar?: AvatarHooks;           // §4.24 (feelOn map; seats get faces automatically)
  scores?: ScoreSpec;             // §4.10
  audio?: AudioSpec;              // §4.12
  input: InputSpec;               // §4.2 (groups + virtual layouts)
  testHook?: (ctx: GameContext) => Record<string, unknown>;  // extra window.__game fields
  shots?: ShotScenes;             // §7: how to reach the game's own scenes quickly
};
```

### 3.3 What the stub files look like

```ts
// src/game/rules.ts (GAME)
import type { Run } from './state.ts';
import type { Rng } from '../kit/rng/index.ts';

/** A fresh run. Use ONLY `rng` for randomness (dailies and races pass a seeded one). */
export function newRun(rng: Rng): Run {
  // TODO(game): build the starting state of your game.
  return { score: 0, level: 1 };
}

/** Advance the simulation by dt seconds. Pure: no DOM, no hub, no Math.random. */
export function step(run: Run, dt: number, input: StepInput): void {
  // TODO(game): move things, detect wins/losses, set run.over = 'won' | 'lost'.
}

/** The "Your games" label: plain words for a kid, ≤ 60 chars. Never say "run". */
export function progress(run: Run) {
  // TODO(game): e.g. { label: `Level ${run.level}`, fraction: run.level / 30 }
  return { label: `Score ${run.score}` };
}
```

Every stub can run without changes: a fresh copy of the template plays the
"collect the coins" example built on these hooks. Each `TODO(game)` says what
to put there and which doc explains it. `npm run todo` lists the ones that are
left.

### 3.4 What the kit does at boot (the standard order)

This order is extracted from sliderush (`src/main.ts:88-183`), clue
(`src/main.ts:56-88`), skipbo (`routed()`) and 8ballpool
(`src/hub-online.ts`).

**Synchronously, before any `await`:**
1. `hub.overlay.autoPause(...)`, through `kit/pause`.
2. `hub.mp.onLaunch` and `onJoinInfo`, queued (`kit/online`). The 8-second
   rule.
3. `hub.race.define(...)` (`kit/race`).
4. `hub.daily.define(...)` (`kit/daily`). Each callback is queued until the
   game has mounted.
5. Listeners for `hub:auth`, `hub:reset`, `hub:daily-error`, `hub:race-hud`,
   `hub:menu-visibility` and `visibilitychange`.
6. `hub.input.define(game.input)` and `autoNavigate(kit nav targets, { back })`.

**Then the async boot:**
1. `await game.mount(ctx)`. Show the loading state, and set
   `document.body.dataset.ready='1'` when it finishes (dinodasher's flag).
2. Start the profile load (`kit/save`, guarded; §4.4). Don't block the title on
   it, except under a 2.5 s timeout, or 8 s when the player is resuming
   (solitaire's numbers).
3. **Route once**, through the `routed()` guard. In priority order:
   1. a queued launch (host, guest, join or watch);
   2. a race `start`;
   3. a `?daily=` start, or a queued `daily.play`;
   4. `hub.saved.opened`, or `hub.resume.requested`, which leads to Continue;
   5. `?mp=lobby`, which opens the lobby;
   6. otherwise the title.
4. Reclaim a held room seat, through `roomTask`, with a 6 s timeout (skipbo).
5. Install `window.__game` (§4.20).

---

## 4. Kit modules, one at a time

Each module is listed with:
- **API**: TypeScript signatures, abridged.
- **Hooks**: what the game implements.
- **Extract from**: the best source first, then the others to merge in.
- **Tests**: vitest, against `FakeHub` unless the module is pure.

Every module that talks to the hub receives a `HubLike`
(`kit/core/hub-like.ts`). That is a `Pick<>` of the real `Hub` type, imported
with `import type` from `@diffenderfer-games/hub`, so the kit compiles against
whichever client version the game pins.

### 4.1 `core`: hub types, events, storage, helpers

```ts
export type HubLike = Pick<Hub, 'overlay'|'input'|'menu'|'daily'|'race'|'resume'|'mp'|'rooms'|'presence'|'social'|'notify'
  |'getSave'|'putSave'|'deleteSave'|'me'|'submitScore'|'incrStat'|'maxStat'|'isOffline'|'offline'>;
export const store: { get<T>(k: string, fallback: T): T; set(k: string, v: unknown): void; del(k: string): void };  // try/catch'd localStorage
export function scopedKey(slug: string, name: string, uid: number | null): string;   // `${slug}:${name}::u${uid ?? 'anon'}` (tetrablox/dumplings)
export function onWindow<K extends keyof HubWindowEvents>(ev: K, cb: (d: HubWindowEvents[K]) => void): () => void; // typed hub:* events
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T>;             // arrow-escape progressLoad, garbage soloRun
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>;   // solitaire timeout()
export function serialQueue(opts?: { hangMs?: number }): <T>(task: () => Promise<T>) => Promise<T>; // skipbo roomTask
export const strings: KitStrings;   // every kit-rendered word; games override via defineGame({ strings })
export type Json = …; export type JsonObject = …;   // moved from daily-puzzle/json.ts (re-exported there)
```

- **Extract from:**
  - `daily-puzzle/json.ts`
  - skipbo `roomTask` (`src/main.ts:819-850`)
  - solitaire `timeout()`
  - tetrablox/dumplings `scopedKey`
  - quanta and flux, for the standalone detection (`window.__HUB__` absent)
- **Tests:**
  - storage survives throwing accessors (private mode);
  - `scopedKey` uses the user id;
  - `serialQueue` orders tasks and its hang guard fires;
  - `withTimeout` returns the fallback;
  - typed events subscribe and unsubscribe.

### 4.2 `input`: controls, menus, gamepad, focus

```ts
export function defineControls(hub: HubLike, spec: InputSpec): ControlsHandle;
export type InputSpec = { groups: Record<string, GroupSpec>; virtual?: (width: number) => VirtualList }; // GD width-dependent layouts
export interface ControlsHandle {
  sync(state: { playing: boolean; extra?: Record<string, boolean> }): void; // enable/disable ONLY on change (quanta syncControls)
  relayout(): void;                                                          // re-define virtual layout on resize/rotation (GD)
}
export function navTargets(root?: HTMLElement): HTMLElement[];   // topmost open modal/sheet → else active screen; [data-nav]:not(:disabled), visible (bingo)
export function installMenuNav(hub: HubLike, opts: { back(): void; locked?(): boolean }): void; // autoNavigate(navTargets, {back}) once
export function pixiNavElements(buttons: () => PixiButtonLike[]): NavElement[];  // downfall: getBounds + onAct for canvas menus
export function controlHints(hub: HubLike, cb: (kind: 'keys'|'touch'|'pad') => void): () => void; // weston controlHints.ts
export function setHudInsets(hub: HubLike, els: HTMLElement[]): void;  // hub.input.setInsets?.() from HUD rects (quanta)
export function avoidHubMenu(el: HTMLElement): () => void;             // pad past the menu button (quanta syncMenuRoom)
export function repeatPress(read: () => boolean, opts?: { first: number; next: number }): (dt: number) => boolean; // solitaire pressed()
export const FOCUS_CSS: string;   // .hub-nav-focus + :focus-visible using --hub-focus-* (sliderush / phase10)
```

- **Hooks:** `controls.ts` declares the `play` group (keys, gamepad, touch)
  and the virtual layouts. Extra groups such as `zone` in quanta can be turned
  on and off one by one.
- **Extract from:**
  - quanta: `syncControls`, `syncControlInsets`, `syncMenuRoom`
  - GD `src/core/input.ts`: `virtualControls(w)`
  - bingo `src/main.ts:133`: the nav target function
  - phase10/uno: the back handler that respects `modalLocked`
  - weston `src/ui/controlHints.ts`
  - downfall `src/ui/button.ts`: Pixi nav elements
- **Retire:** the hand-made spatial pad navigation in bubblepop
  (`padFocus`), helixdrop (`menuNav`) and sliderush (`navMove`).
  `autoNavigate` already does this job. Keep sliderush's per-pad local
  multiplayer as a documented exception.
- **Tests:**
  - `sync` calls enable/disable only when something changed;
  - while a hub overlay is open, a sync is recorded but not applied twice;
  - `navTargets` picks the topmost modal and skips hidden or disabled buttons;
  - `back` is ignored while the modal is locked;
  - the virtual layout switches at 520 px;
  - `controlHints` follows `sourcechange`.

### 4.3 `pause`: autoPause, player pause, races, visibility

```ts
export function installPause(hub: HubLike, p: {
  canPause(): boolean;              // false on menus, in a race, during a live online match (setBusy handles mp)
  show(why: 'hub' | 'player' | 'hidden'): void;   // game's pause screen
  hide(): void;
  resumeOnClose: boolean;           // true for turn-based/idle (skipbo), false for action (bingo, sliderush)
}): PauseHandle;
export interface PauseHandle { readonly paused: boolean; readonly byHub: boolean; pause(why): void; resume(): void; }
```

- **The rules it enforces:**
  - Call `autoPause` exactly once, at boot.
  - A hub close never undoes a pause the player made themselves (skipbo's
    `pausedByHub`).
  - Never pause in a race. Instead, the pause button becomes "Leave race?",
    which confirms, then calls `hub.race.leave()` (arrow-escape `guardRace`,
    baseball-typer `askLeaveRace`).
  - Pause when the page is hidden (dinodasher, skipbo).
  - Show the hub menu on the pause screen and hide it during play, using
    bfme's `setHubMenuVisible` (`src/ui/hubMenu.ts`).
  - Swallow the click that closed the hub menu (bubblepop `settleT`).
- **Hooks:** `pause(ctx, why)` and `resume(ctx)` (they show and hide the
  game's pause screen), and `canPause` comes from the game's state.
- **Extract from:**
  - skipbo `src/main.ts:116-120`
  - sliderush (`pauseGame`, `updateQuiet`)
  - dinodasher `boot.ts:90`
  - bubblepop's race-aware pause
  - bfme `hubMenu.ts`
- **Tests** (hub-events; Appendix B):
  - overlay open: pause, with `why='hub'`;
  - overlay close with `resumeOnClose`: resume only if the hub caused the
    pause;
  - nested opens fire once;
  - registering while the overlay is already open pauses at once;
  - no pause when `canPause` is false (a race);
  - `visibilitychange` hidden: pause;
  - menu visibility follows the play state.

### 4.4 `save`: profile, settings, cloud slot, the guards

This is the highest-value module. Each game has a different subset of these
guards. The kit has all of them, and each guard has a test named after the bug
it prevents.

```ts
export function createProfile<P extends Json>(hub: HubLike, spec: ProfileSpec<P>): ProfileStore<P>;
export type ProfileSpec<P> = {
  slot?: string;                       // default 'main'
  version: number;
  defaults(): P;                       // fresh object every call (structuredClone)
  merge(cloud: P, local: P, earnedBeforeLoad: P): P;   // only-grows rules; helpers below
  progressOf?(p: P): number[];         // lexicographic "more progress" (SpaceClicker progressRank)
  migrate?(old: unknown, fromVersion: number): P | null;
  validate?(x: unknown): x is P;
  localMirror?: boolean;               // keep a scoped localStorage copy (games that predate the hub)
  debounceMs?: number;                 // default 1000 (bingo 1.5 s, weston 1.2 s, baseball-typer 800 ms)
};
export interface ProfileStore<P> {
  readonly data: P;                    // usable immediately (defaults), live-updated in place after load (garbage)
  readonly state: 'loading' | 'ready' | 'unknown';   // 'unknown' = read failed/offline-unseen: NEVER push
  update(fn: (p: P) => void): void;    // mutate + schedule a guarded push
  ready(): Promise<void>;              // resolves when loaded (or unknown)
  flush(): Promise<void>;              // on hidden/pagehide
}
export const merge: { max, min, sum, union, keepIfChanged, newer, deep };   // the only-grows helpers
export function createSettings<S extends Json>(spec: { key: string; version: number; defaults(): S; migrate? }): SettingsStore<S>; // device-local (bfme settings.ts)
```

The guards, each with a test:

1. **No push before the cloud read answers.** Sources: dumplings
   `_metaSynced`, weston `cloudRead`, baseball-typer `cloudRead`, bingo.
2. **A failed read or an offline `save_unknown` is "unknown", not "empty".**
   Nothing is pushed until a later read succeeds (dumplings `metaKnown`; hub.md
   "Offline and replay": `SAVE_UNKNOWN_CODE`). A 401 counts as "nothing to
   protect" (solitaire, uno).
3. **Progress earned during a slow load is merged, not lost.** The load uses
   the `earnedBeforeLoad` argument (uno, solitaire's late-profile callback,
   garbage).
4. **A write re-reads and patches.** Pending patches are applied on top of the
   latest save. Writes are serialized, and defaults are never written over a
   save that couldn't be read (8ballpool `src/stats.ts`, the best source).
5. **An account switch never leaks progress between accounts.**
   - On `hub:auth`, cancel any pending debounced push, then re-read.
     SpaceClicker cancels the push; baseball-typer and skipbo re-read.
   - Every async step checks that the user id is still the same (SpaceClicker).
   - Local copies carry an owner tag (bingo `PREFS_OWNER_KEY`).
   - hub.md says to push, not pull, on auth when the local copy is newer. The
     merge decides which.
6. **Legacy local keys fold in once** and are then removed. Keep a
   `::folded` backup (SpaceClicker `foldSave`, tetrablox `syncForUser`).
7. **`hub:reset` wipes the game's own storage** before the hub reloads the
   page (tetrablox, dumplings).
8. **A daily or a race never writes the profile.** `update()` throws in dev
   and is ignored in prod while `kit/daily` or `kit/race` is active, unless the
   caller passes `{ allowInDaily: true }`. That option is for daily-only
   records, such as the attempt book from `daily-puzzle/attempts.ts`. This
   guard closes the dinodasher, helixdrop and bubblepop gaps.

- **Hooks:** `state.ts` exports `Profile`, `defaults`, `merge` and an
  optional `migrate`, and the `Settings` type and its defaults.
- **Extract from:**
  - 8ballpool `src/stats.ts`: write discipline
  - dinodasher `src/game/profile.ts`: class shape and the re-read fold
  - weston `src/game/progress.ts`: local-first and versioning
  - uno `src/main.ts:60-74, 362-383`: the boot gate
  - skipbo `src/main.ts:195-248`: account switch and the pending-wins outbox
  - bingo: the owner tag
  - SpaceClicker: progress rank and fold
  - bfme `src/game/settings.ts`: settings
- **Tests:** one or more per guard above. Plus:
  - defaults are fresh objects;
  - migrate is called for v1 → v2;
  - an invalid cloud blob is ignored, not adopted;
  - debounce coalesces writes;
  - `flush` on `pagehide`;
  - offline writes go to the hub outbox (FakeHub records `putSave`).

### 4.5 `resume` (today) and `saved` (planned): Continue

```ts
export function createResume<R extends Json>(hub: HubLike, spec: {
  version: number; validate(x: unknown): x is R; progress(r: R): { label: string; fraction?: number };
  title?(r: R): string; legacySlot?: string;       // one-time migration from an old getSave slot (flux/quanta/tetrablox/8ballpool/downfall)
}): ResumeSlot<R>;
export interface ResumeSlot<R> {
  readonly known: boolean;            // lookup finished (or failed)
  load(): Promise<R | null>;          // single-flight, cached
  save(r: R): boolean;                // false when blocked (race/room; daily routes to the daily instance once hub ships it)
  clear(): void;                      // win, loss, quit, new game
  flush(): void;                      // visibilitychange hidden
  beforeNewGame(): Promise<'fresh' | R>;   // the late-load guard: wait ≤ 8 s for the lookup before replacing a run (garbage deal, tetrablox savedRun, iansaur)
  offerLate(onPick: (r: R) => void): void; // a run found AFTER a new game started → toast "Keep this game / Continue the saved one" (solitaire offerLateRun)
}
```

- **Wording:** players see "Continue" and "Your saved game". The kit's strings
  never say "run" (saved-games.md §11).
- **The full saved-games coverage** (days in progress, turn games, alerts,
  wording) is in §4.23.
- **Saved games (planned).** When the hub ships `hub.saved` (phase 0/1 of
  saved-games.md), `kit/resume` adds a `kit/saved` adapter:
  - `continueRows()` returns `hub.saved.list()` mapped to title-screen rows:
    "Continue: Level 12", "Daily challenge · Oct 14 (34 cards left)",
    "Online with Sam · your turn".
  - The boot router reads `hub.saved.opened` and installs `hub.saved.onOpen`
    (switching without a reload).
  - `openInstance(id)` dispatches by kind: a saved game goes to
    `game.restore`, a daily to `hub.daily.resume(id)` (then
    `daily.play(challenge)` with `challenge.saved`), and an online game to
    `kit/turns`.
  - The game hooks don't change. `restore(run)` handles a saved run and a
    saved daily the same way, because `daily.play` passes `challenge.saved`
    through to `restore`.
- **Hooks:** `restore`, `progress`, `validate` (from `state.ts`), plus
  `versions.run`.
- **Extract from:**
  - solitaire `src/main.ts:111-166, 299-330`: the late-run toast and
    `runWritable`
  - 8ballpool `src/resume.ts`: module shape
  - phase10 `src/main.ts:728-764`: a new game wins over a late load
  - GD `src/game/resume.ts`: doc comments
  - downfall `src/save/resume.ts`: label helpers, and it has tests
  - The15Puzzle `client/src/resume.ts`: multi-run, a reference for
    `kit/saved`
- **Tests:**
  - `requested` routes to Continue;
  - `save` is a no-op in a race or room;
  - in a daily, it goes to `daily.save` when the hub has it, and is a no-op
    before that;
  - a version mismatch reads null;
  - the legacy slot migrates once, then is deleted;
  - `beforeNewGame` waits, then times out;
  - `offerLate` fires only when the run differs;
  - `clear` on win, loss and quit;
  - `flush` on hidden;
  - `hub:reset` clears.

### 4.6 `daily` (and `daily-puzzle`)

```ts
export function installDaily<R>(hub: HubLike, spec: DailyHooks<R>, deps: { resume: ResumeSlot<R>; profile: ProfileStore<any> }): DailyHandle;
export type DailyHooks<R> = {
  build(seed: number, day: string): R;            // seeded run/puzzle; ONLY the seed (kit passes an Rng)
  meta?(r: R, won: boolean): JsonObject;          // extra complete() fields (stars, attempts, gen, line via daily-puzzle winMeta)
  offline?: 'play-unrecorded' | 'toast';          // on hub:daily-error (garbage/sliderush/weston play the day unrecorded)
};
export interface DailyHandle {
  readonly active: { day: string; seed: number } | null;
  complete(r: R): void;        // once, only while active (daily-puzzle completeDaily)
  leave(): void;               // EVERY non-win exit: quit, new game, room, race (today cancel(); planned: pause semantics)
  discard?(): void;            // planned hub.daily.discard
  save?(r: R): boolean;        // planned hub.daily.save
  status(): Promise<DayStatus[]>;  // for a "done today" badge (weston)
}
```

- **The rules it enforces:**
  - `define` is registered at boot. A `play` that arrives before mount is
    queued (quanta defines it after `boardMade`; the kit's queue makes that
    unnecessary).
  - There is a deep link `?daily=` with an 8 s fallback to the title
    (popfour, bubblepop, helixdrop).
  - `leave()` is called on every exit path. The kit wires it into new game,
    title, launch and race. Missing it today leaves `hub.resume.save` blocked
    for the rest of the page (hub.md "Daily challenges").
  - **The isolation guard:** while a daily is active, `kit/save`,
    `kit/scores` and `kit/resume` refuse normal-progress writes (§4.4 guard 8).
  - Offline fallback: `seedForDay(slug, day)` from `kit/rng`, using the hub's
    own seed, so an offline day matches the online one. Local and UTC days are
    unified here: UTC is the rule.
  - **Saved games (planned):** a `challenge.saved` goes to `restore`.
    `hub.daily.save` is used mid-daily. `leave()` becomes a pause and
    `discard()` is "give up this day".
- **`daily-puzzle`** stays as it is (README section → `docs/kit/daily-puzzle.md`). `DailyHooks.build` for a puzzle game is the README's
  `buildDaily` (`versionFor` + `generate`), and `meta` is `winMeta`.
- **Hooks:** `src/game/daily.ts` holds `build`, and `meta` when needed. A
  puzzle daily also has `rules` (`PuzzleRules`) and `VERSIONS`.
- **Extract from:**
  - weston: offline fallback, `status()` badge, a separate leaderboard
  - GD `main.ts:1015, 1126`: isolation
  - popfour `src/main.ts:685-874`: deep-link flow
  - sliderush: `waitForDaily`
  - the daily-puzzle kit
- **Tests:**
  - `play` before mount is queued, then started;
  - `complete` only once and only while active;
  - every exit path calls `cancel` (new game, title, launch, race start);
  - `hub:daily-error` takes the offline path;
  - the profile, boards and resume are untouched during a daily (the
    regression tests for dinodasher, helixdrop and bubblepop);
  - the same seed gives the same build (determinism);
  - `?daily=` with no answer within 8 s goes to the title;
  - planned: `challenge.saved` goes to `restore`.

### 4.7 `race`

```ts
export function installRace<R>(hub: HubLike, spec: RaceHooks<R>, deps): RaceHandle;
export type RaceHooks<R> = {
  build(seed: number, params: Record<string, string>): R;   // only seed + params (fair)
  stats(r: R): Record<string, number | boolean | `#${string}`>;  // NEVER text (bad_stats); ≤ 12 keys
  progress?(r: R): number;                                    // 0..1 for the HUD
  onResult?(res: RaceResult): void;
};
export interface RaceHandle {
  readonly live: boolean; readonly session: RaceSession | null;   // GD raceSession
  menu(): { create(params): Promise<void>; browse(): void; history(): void };  // the Race button + picker
  report(r: R): void;          // status() throttled ≤ 4/s (GD reportRaceStatus)
  finish(r: R): void; lose(r: R): void; leave(): void;   // leave = "Leave race?" confirm path
  barTop(): number;            // --hub-race-hud-top + hub:race-hud (solitaire raceBarBottom, sliderush raceHudTop)
}
```

- **The rules it enforces:**
  - Skip `start` for spectators.
  - Lock input until `startAt` and after `end`.
  - When `start` arrives with `resumed: true`, restore from a sessionStorage
    stash keyed `roomId:round` (arrow-escape `raceSave`/`raceRestore`).
  - Never pause in a race. Busy and quiet are set by the hub.
  - Races write history only, never boards or stats (kit/scores refuses).
  - The race picker is typed from `game.race.params` (weston `picksOf`).
  - `raceError(e)` maps errors to friendly text (sliderush).
  - A level fingerprint for the tests (weston `levelFingerprint`).
- **Hooks:** `src/game/race.ts` holds `build`, `stats` and `progress`.
  `package.json` holds `game.race`.
- **Extract from:**
  - GD `src/game/race.ts`: session and throttle
  - arrow-escape `src/main.ts:782-890`: reload, `guardRace`, `raceExit`
  - weston `src/race.ts`
  - The15Puzzle `client/src/race.ts`: the store shape
  - sliderush: `raceError`, seed salting
- **Tests:**
  - `start` (normal, `resumed`, spectator);
  - `status` is throttled;
  - `finish` and `lose` are sent once;
  - `exit` and `end` go back to the title;
  - stats never contain text (a type test plus a runtime assert);
  - no pause, no profile write and no score during a race;
  - `barTop` follows `hub:race-hud`.

### 4.8 `online`: launches, rooms, invites, links, rejoin, computer seats

The kit owns the plumbing. The game supplies only its messages and its
"computer move".

```ts
export function installOnline(hub: HubLike, spec: OnlineHooks, deps): OnlineHandle;
export type OnlineHooks = {
  transport: 'hub-rooms' | 'own-server';
  modes?: string[];
  host: {                                         // hub-rooms: the host browser runs the rules
    start(seats: Seat[], opts): HostState;        // GAME
    onGuestMsg(state: HostState, from: number, msg: unknown): HostState | null; // GAME (validate with kit/online/wire)
    view(state: HostState, seat: number): unknown;    // GAME: redaction (phase10 redact)
    computerMove(state: HostState, seat: number): unknown; // GAME: the bot for an away/gone seat
    backup(state: HostState): JsonObject;         // GAME: what the successor needs (uno HostSave)
    restore(b: JsonObject): HostState;            // GAME
  };
  guest: { onView(view: unknown): void; send?: (m: unknown) => void };  // GAME renders
  lobby: { show(room: RoomInfo): void; hide(): void };                  // GAME look; kit wires Invite / 🔔 / names → openPlayer
};
export interface OnlineHandle {
  readonly room: RoomHandle | null; readonly isHost: boolean;
  hostGame(mode?): Promise<void>; joinByCode(code: string): Promise<void>; leave(): Promise<void>;
  inviteLink(): Promise<string>;  // hub.mp.inviteLink, revoke on leave
}
```

What the kit implements, and where each piece comes from:

| Piece | What it does | Best source |
|---|---|---|
| Launch adapter | Registered synchronously, idempotent, and queued until mount. Covers `host`, `guest`, `join` (including `via:'link'`, `via:'rejoin'`, `tournament`) and `watch`. Answers within 8 s. | 8ballpool `src/hub-online.ts` (`LaunchHandlers`), garbage `handleLaunch`, clue's split |
| Routed guard and room queue | `routed()`, `roomTask` (serial, 20 s hang guard), reclaim with a 6 s timeout | skipbo `src/main.ts:819-850` |
| Successor and host backup | `successorOf(info)`, `backupMsg`/`parseBackup`, `freshest(saves, code, id)`, host save in localStorage, `stepDownAsHost` | uno `src/wire.ts` (with `tests/unit/wire.test.ts`); phase10/clue/garbage/skipbo copies |
| Seat resilience | `seat` `away`/`back`/`gone`: the computer plays the seat, and the player gets it back with no reset. Never end a match while a human remains. Re-check `room.me.host` on every `room` event. | phase10/uno `Match.setCtl`, skipbo `computerSeats`, garbage `onAbandoned` |
| Wire validation | `parseMsg` guards, `WIRE_VERSION`, size checks (8 KB `send`, 32 KB state) | skipbo `src/online.ts`, phase10 `net.ts` |
| Error text | `OfflineError`, `suspended`, `room_not_found`, `in_progress`, `room_full`, `banned` → friendly text | garbage `errText` |
| Presence, busy, quiet | `presence.set` per screen; `mp.setBusy(true)` during a live match; `notify.setQuiet` | garbage `show()`, sliderush `showScreen` |
| Lobby chrome | Invite button (`openInvite`), 🔔 (`openNotify`), every name opens `openPlayer` | multiplayer.md §6 checklist |
| Chat panel | Render only delivered text; keep the draft and show `hint` on `ContentRejectedError`; a ✨ hint when words were swapped; `chatMode` on/quick/off; quick chips | phase10 `src/chat.ts`, clue `src/online/chat.ts` |
| Tournaments | `launch.tournament`, report `winnerId`, no "Play again" | clue (wired in batch-2026-10) |

- **Own-server games** use `kit/server` (§4.9) and the same launch adapter.
  They verify tickets in place of the room host role.
- **Turn games (planned, `kit/turns`).** When `hub.turns` ships (saved-games.md
  phases 3–6), `kit/turns` is an adapter:
  - `create`, `join`, `open`, `move` (with `stale` and illegal handling) and
    `history(sinceSeq)` replay for "what happened while you were away";
  - events (`move`, `turn`, `ended`), nudge, rematch and leave.
  - The game provides a **pure rules module** (`setup`, `view`, `toAct`,
    `apply`, `outcome`, `progress`, plus optional `autoMove`, `migrate` and
    `eventView`), which the hub runs on its server.
  - The kit adds a vitest harness, `checkTurnRules(rules)`. It mirrors the
    planned `@dg/hub-testkit` check, so games test locally.
  - **Design rule:** a game's `host.*` hooks above are written as pure
    functions of `(state, seat, move)`. Moving a game from rooms to turns
    (decision 8: Pop Four, Phase 10, Skip-Bo, Garbage) then means mapping
    them onto the rules module, not rewriting them.
  - Player wording: "Online with Sam · your turn", never "turn game".
  - What a new game gets for turn games and alerts, and what waits on which
    hub phase: §4.23. World tables (`launch.table`, Quick match,
    `setRoster`): §4.25.
- **Hooks:** `src/game/online.ts`, all stubs. `package.json` holds
  `game.multiplayer`.
- **Tests** (hub-events; FakeHub drives each launch kind and room event):
  - each launch kind routes once;
  - a launch before mount is queued;
  - a second identical launch is ignored;
  - `seat away` hands the seat to the computer, and `back` hands it back
    without a reset;
  - `host` migration loads the freshest backup;
  - `closed` (each reason) and `kicked` go to the title with text;
  - `abandoned`;
  - `ended` arrives once;
  - chat rejected keeps the draft; a softened message shows the hint;
  - `chatMode` off hides chat;
  - a link launch strips the token;
  - a tournament launch has no rematch.

### 4.9 `server` (optional, own-server games)

```ts
export function createGameServer(opts: { dist: string; healthPath?: string; wsPath?: string;
  onConnection(ws: WebSocket, who: Verified | null): void }): { listen(): Promise<number> };  // PORT/GAME_PORT/argPort, static + MIME + SPA fallback, /healthz, /ws upgrade
export function verifyPlayer(hubServer: HubServer, ticket: string): Verified | null;        // hub-server.mjs verifyTicket; fresh ticket every connect
export class SeatTable<T> { hold(seat, token, graceMs); rejoin(token); expire(seat); }      // 'here'|'away'|'gone' with grace (SpacePong gameManager, 8ballpool)
```

- **Extract from:**
  - bingo `server/server.ts` with `hub-server.mjs` tickets: the best,
    because it is hub-verified
  - 8ballpool `server/server.ts`
  - SpacePong `server/gameManager.js`: seat states
  - bfme `server/relay.mjs`: a lockstep reference only, not extracted
- **Tests:**
  - static and SPA fallback;
  - healthz answers within the catalog's 15 s;
  - a bad ticket closes with 4401;
  - a seat is held during the grace period and freed after;
  - rejoin by token.

### 4.10 `scores`: leaderboards and stats

```ts
export function recordResult(hub: HubLike, spec: ScoreSpec, r: { mode: 'normal'|'daily'|'race'|'online'; boards?: Record<string, number>; incr?: Record<string, number>; max?: Record<string, number> }): void;
```

- Submits to boards in normal mode only. Dailies, races and online play are
  suppressed, unless the spec names a board for that mode, such as weston's
  `daily-score` or uno's online-wins.
- Fire-and-forget (`safe(p)`), and batched (`flushStats`).
- Every board is declared in `game.leaderboards`. `kit:check` checks that
  each key used in code is declared there.
- **Extract from:** 8ballpool `src/stats.ts` (`recordGame`, `safe`), and the
  suppression rule from arrow-escape `win()`.
- **Tests:**
  - normal mode submits;
  - daily and race don't;
  - an online result goes only to the boards named for online play;
  - a `HubError` is swallowed;
  - an undeclared key fails `kit:check`.

### 4.11 What's new, labels, intro, menu

There is no runtime code here, by design: hub.md says these are manifest-only.
The kit adds checks and docs:

- `kit:check`, and `hub-doctor` where it covers the same ground, validate
  `game.changes`:
  - plain strings or `{id, text}`;
  - at most 280 chars;
  - no jargon words such as "refactor", "fix #", "PR" or "bug".
- `kit:check` checks that `game.labels` uses only the allowed set
  (`GAME_LABELS`).
- `docs/kit/whats-new.md` has the kid-language rules and examples.
- Intro: the screenshot runner shows how to capture it (`?hub_intro=` on
  localhost, §7). The game needs no code.

### 4.12 `audio`: engine, SFX, music, unlock

```ts
export class AudioEngine {
  constructor(opts?: { musicGain?: number; sfxGain?: number });
  unlock(): void;                         // lazy AudioContext on first gesture; iOS silent buffer (dinodasher); retries
  installUnlock(): () => void;            // pointerdown/keydown/touchend/click(capture)/pageshow/focus (bfme music.ts:746-761)
  readonly ctx: AudioContext | null; readonly music: GainNode; readonly sfx: GainNode;   // buses → compressor → out (bingo/bubblepop)
  setMusic(on: boolean): void; setSfx(on: boolean): void; setMusicVolume(v: number): void; setSfxVolume(v: number): void; // v² curves
  duck(on: boolean): void;                // pause screen / hub open
}                                          // + suspend on hidden, resume on visible
export const sfx: { tone(e, f, t, dur, type?, vol?): void; noise(e, t, dur, filter?): void; burst(e, …): void }; // solitaire/garbage/tetrablox primitives
export function throttleSfx(e: AudioEngine, capPerKind: number): (kind: string, play: () => void) => void;      // bfme SFX_CAP

// music: one synth-core contract, three hosts
export interface MusicCore<Msg> { constructor(sampleRate: number); handle(msg: Msg): void; render(L: Float32Array, R: Float32Array | null, frame: number): void; }
export class MusicStream<Msg> { constructor(e: AudioEngine, worker: Worker, opts?: { chunk?: 8192; aheadS?: 2.5; maxInflight?: 4; stems?: string[] });
  send(msg: Msg): void; tick(): void; readonly underruns: number; readonly maxRenderMs: number; }  // the default (docs/audio.md)
export function hostWorker<Msg>(core: new (sr: number) => MusicCore<Msg>): void;      // inside musicWorker.ts
export function hostMainThread<Msg>(e: AudioEngine, core): MusicStream<Msg>;         // fallback when Workers fail (dinodasher MusicRenderer)
export function hostWorklet<Msg>(e: AudioEngine, url: string, name: string): Promise<AudioWorkletNode | null>; // OPT-IN, secure contexts only
```

**The rule (decision 6): music and audio must work over plain http.** Testing
uses a LAN IP (`http://192.168.x.x:5173`) or an http dev server, not only
`localhost`. Such a page is **not a secure context**. AudioWorklet
(`audioWorklet.addModule`) is unavailable there. So:
- **The default host never needs a secure context.** It is the Web Worker synth
  feeding PCM buffers to the main thread, which queues them as
  `AudioBufferSourceNode`s about 2–3 s ahead.
- **The fallback is the main thread**: the same core driven from the main
  thread, or a `ScriptProcessorNode`. It is used when Workers fail.
- **AudioWorklet is used only when `isSecureContext` is true,** and only when
  the game asks for it. Even then, a failed `addModule` drops to the default.
- **Tests and the screenshot runner check this.** One test serves the build on
  the machine's LAN address over http and asserts the music telemetry
  (`underruns`, `maxRenderMs`). SFX unlock is checked over http too.

**Where bubblepop fits.** The ask mentions "the AudioWorklet music pattern from
bubblepop", but the two sources conflict:

- bubblepop's music (`src/audio.ts`, `src/music-worklet.ts`,
  `src/music-synth.ts`) runs a sample-accurate `MusicSynth { handle(msg);
  render(out, frame) }` inside an **AudioWorklet**. It falls back to a
  `ScriptProcessorNode` when the worklet can't load.
- The template's `docs/audio.md` and `CLAUDE.md` say **"Not AudioWorklet"**.
  It needs a secure context, so it fails on `http://` LAN test URLs.
  bubblepop gets by on its fallback there.

**The plan takes the good idea from each:**

- bubblepop's **synth-core contract** (`handle(msg)` plus `render(buffer,
  frame)`, with no Web Audio nodes inside) becomes the kit's `MusicCore`.
- That core runs in one of three hosts:
  1. the **Worker PCM stream**, the default (docs/audio.md; dinodasher's
     version, with two stems, telemetry and a main-thread fallback);
  2. **main thread**, the fallback;
  3. **AudioWorklet**, opt-in, only when `isSecureContext` is true.
- A game writes its song once, as a `MusicCore`, and the host is chosen at
  runtime by the rule above.

- **Hooks:**
  - `src/game/audio.ts` lists the SFX by name, as calls to the primitives;
  - optionally a `MusicCore` and a `song(seed)` for the music;
  - settings toggles come from `kit/settings-ui`.
- **Extract from:**
  - dinodasher `src/audio/{musicStream,musicRender,musicWorker,engine}.ts`:
    the best music system
  - bingo `src/audio/` (`AudioEngine`, duck, volumes)
  - sliderush `src/audio/sound.ts`
  - bubblepop `src/music-synth.ts`: the core contract
  - bfme `src/audio/music.ts`: unlock listeners and the `interrupted` state
  - solitaire/garbage `sfx.ts`
- **Tests:**
  - with a fake AudioContext, `unlock` is idempotent and works after the
    context is `interrupted`;
  - suspend on hidden;
  - volume curves;
  - `MusicStream` schedules chunks back-to-back on sample boundaries and
    counts underruns;
  - a `MusicCore` renders deterministically for a seed (a hash snapshot);
  - the worklet host is skipped when the context isn't secure (a fake
    `isSecureContext=false`), and the Worker host is chosen;
  - a browser check over `http://<LAN IP>` (not localhost) plays music with
    no underruns (part of the `test:hub` audio case and the `play`
    screenshot scenario's telemetry).

### 4.13 `haptics`

```ts
export const hapticsSupported: boolean;
export function haptic(strong?: boolean, test?: boolean): void;   // Android vibrate (4 ms / 12 ms); iOS 18+ hidden <input switch> click
export function makeBuzz(opts: { enabled(): boolean; minGapMs?: number }): (strong?: boolean) => void;  // settings-gated, throttled
```

- **Extract from:** bubblepop and helixdrop `src/haptics.ts`, and bingo and
  popfour `src/haptics.ts`. They are identical apart from the DOM id, so the
  kit takes an `idPrefix` option.
- Ship `scripts/kit/vibration-test.html`, from bubblepop
  `vibration-test.html`, as a device diagnostic page that `npm run dev`
  serves.
- **Tests:**
  - no throw when `navigator.vibrate` is missing;
  - throttle;
  - gated by the setting;
  - the iOS path clicks the label once (twice for strong).

### 4.14 `rng`

```ts
export type Rng = () => number;
export function mulberry32(seed: number): Rng;
export function hashSeed(...parts: (string | number)[]): number;      // FNV-1a over parts
export function hashString(s: string): number;
export function seedForDay(game: string, day: string): number;         // the hub's own daily seed
export function randomSeed(): number;                                   // the ONLY Math.random in the kit
export function randInt(r: Rng, lo: number, hi: number): number; export function pick<T>(r: Rng, xs: readonly T[]): T;
export function shuffle<T>(r: Rng, xs: T[]): T[]; export function weighted<T>(r: Rng, items: [T, number][]): T;
export class SeededRng {                                                // saveable state (clue, skipbo, phase10, GD)
  constructor(seed: number); next(): number; int(lo, hi): number; chance(p: number): boolean;
  fork(name: string): SeededRng;                                        // named streams (weston deriveSeed, bfme fork)
  snapshot(): number; static restore(s: number): SeededRng;            // run save/restore (GD PRNG)
}
```

- **Extract from:** `kit/daily-puzzle/rng.ts`, which is the superset. Add
  `hashString` and `randomSeed` (solitaire/garbage `src/rng.ts`), `fork` and
  `deriveSeed` (weston `engine/rng.ts`), and `snapshot`/`restore` (GD
  `core/prng.ts`).
- `daily-puzzle/rng.ts` re-exports from here.
- **Tests:**
  - known sequences (golden values matching today's mulberry32, so seeds
    behave the same as in the existing games);
  - `fork` gives independent streams;
  - `snapshot`/`restore` round-trips;
  - `seedForDay` equals the hub's value for fixed days;
  - `shuffle` is unbiased (chi-square over 10k).

### 4.15 `loop`

```ts
export class FixedLoop { constructor(o: { dt: number; maxFrame?: number; simulate(dt: number): void; render(alpha: number): void });
  start(): void; stop(): void; setDt(dt: number): void; readonly running: boolean; }   // GD src/core/loop.ts
export function clampDt(ms: number, max?: number): number;   // variable-dt games (0.05 default)
```

- The starters drive it from `app.ticker` (Pixi) or `renderer.setAnimationLoop`
  (three.js).
- It respects `kit/pause`: while paused, it doesn't simulate but keeps
  rendering, so the pause screen can animate.
- **Tests:**
  - with a fake clock, N steps for M ms;
  - catch-up is capped by `maxFrame`;
  - `alpha` stays in [0, 1);
  - no steps while paused.

### 4.16 `layout`: responsive, phone, safe areas, HUD space

```ts
export function onResize(cb: (w: number, h: number) => void, opts?: { debounceMs?: number }): () => void;
   // window resize + orientationchange re-settle + visualViewport + double-rAF (tetrablox relayout, GD)
export function safeArea(): { top: number; right: number; bottom: number; left: number };  // the env() probe div (bubblepop/helixdrop)
export function letterbox(vw: number, vh: number, w: number, h: number): { scale: number; x: number; y: number }; // iansaur fit, downfall initApp
export function layoutRegion(o: { top?: HTMLElement[]; bottom?: HTMLElement[]; raceBar?: boolean; menuButton?: boolean }):
  () => { top: number; bottom: number; left: number; right: number };   // solitaire/garbage region(), + race HUD + menu room
export function fitText(el: HTMLElement): () => void;   // bfme src/ui/fit.ts fitWidth
export const isPortrait: () => boolean; export const isPhone: () => boolean;   // < 600 css px short side
export function keepThemeColor(color: string): () => void;  // helixdrop applyThemeColor + MutationObserver
```

- **Extract from:**
  - tetrablox `layout()`/`relayout()`: forces `renderer.resize` during a
    rotation, because Pixi's `resizeTo` lags
  - solitaire and garbage `region()`
  - GD: the double-rAF viewport sync
  - iansaur and downfall: letterboxing
  - bfme `fit.ts`
- **Tests** (jsdom):
  - debounce;
  - the orientation re-settle fires twice;
  - letterbox math;
  - `layoutRegion` includes the race HUD variable and the menu-button room.
- The phone and desktop screenshot sizes (§7) are the visual test.

### 4.17 `ui`: screens, modal, toast, primitives, juice

```ts
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}`, attrs?: Attrs, ...kids: Child[]): HTMLElementTagNameMap[K]; // clue dom.ts, dinodasher, baseball-typer
export class Screens<Name extends string> { constructor(root: HTMLElement, names: Name[]);
  show(name: Name, opts?: { dim?: boolean; presence?: PresenceKind }): void; readonly current: Name; }     // sliderush showScreen / garbage show()
export function openModal(o: { title: string; body: Child; buttons?: Btn[]; locked?: boolean; onClose?(): void }): ModalHandle; // phase10/uno/garbage
export function toast(text: string, o?: { ms?: number; kind?: 'info'|'good'|'warn'; actions?: Btn[] }): void;             // solitaire showToast (actions)
export function button(label: string, onClick: () => void, o?: { cls?: string; icon?: string; sub?: string; testid?: string; nav?: boolean }): HTMLButtonElement; // garbage
export function segmented<T>(items: { value: T; label: string }[], value: T, onPick: (v: T) => void): HTMLElement; // garbage seg
export function toggleRow(label: string, on: boolean, onChange: (on: boolean) => void): HTMLElement;            // garbage optRow / sliderush aria-pressed
export const juice: { letters, stagger, replay, banner, countUp, confetti, irisCover, irisReveal }; // phase10/uno juice.ts + bubblepop/helixdrop ui.ts
export const KIT_CSS: string;  // modal/sheet/toast/button/focus/juice styles; themed by CSS variables the game sets
```

- **Every kit screen is DOM** (an `#ui` overlay over the canvas). That is
  what `autoNavigate`, focus rings, the on-screen keyboard and accessibility
  are built for. Most games already do this. Pixi-drawn menus are still
  supported through `input.pixiNavElements`.
- Every built-in button gets `data-nav` and `data-testid`, so the scripts and
  suites can find them (§6, §7).
- **Standard screens the kit provides:**
  - **Title:** Play, Continue rows, Daily, Race, Online, Settings, How to
    play.
  - **Pause:** Resume, Restart, Settings, Quit to title. In a race it
    becomes "Leave race?".
  - **Leave confirm.**
  - **Error toast.**
  - The game skins them with CSS variables and may replace any of them
    through a hook (`screens/title.ts` and friends).
- **Extract from:**
  - clue `src/ui/dom.ts`
  - baseball-typer `src/ui/screens.ts`: a typed `Screens`
  - phase10 `openModal` (locked modals)
  - solitaire `showToast`
  - garbage `button`, `seg`, `optRow`
  - phase10/uno `juice.ts` (identical) and bubblepop `ui.ts` (iris, confetti)
  - dumplings: the modal focus trap
- **Tests** (jsdom):
  - a locked modal ignores back and Esc;
  - toast actions fire and dismiss;
  - `Screens.show` sets presence;
  - `h()` escapes text, because it uses `textContent`. This matters for chat
    and player names (multiplayer.md: render delivered text only).

### 4.18 `settings-ui`

```ts
export function settingsSheet(o: { settings: SettingsStore<KitSettings & S>; audio?: AudioEngine; haptics?: boolean;
  rows?: (s: S) => HTMLElement[];   // GAME rows (difficulty, colour, hints)
  onReset?(): void }): ModalHandle; // "Reset game" lives in the hub menu (hub:reset); the kit only offers local prefs
export type KitSettings = { sound: boolean; music: boolean; musicVolume: number; sfxVolume: number; haptics: boolean; reducedMotion: boolean };
```

- **Extract from:** garbage `showSettings()`, sliderush's toggles, bfme's
  settings store, and the haptics toggle from bubblepop/helixdrop.
- The dev tuning panels (downfall `devPanel.ts`, GD `core/settings.ts`) stay
  out of the kit. They are noted as a possible later `kit/dev-panel`.
- **Tests:**
  - toggles persist;
  - the audio engine follows the settings;
  - `reducedMotion` turns juice off;
  - focus order works with the gamepad.

### 4.19 `cards`: deferred (decision 13)

**Not built now.** The design below is kept for later. New card and board games
use `kit/rng` (`SeededRng` for decks), `kit/online` or `kit/turns`, and
`kit/avatar` (which replaces the old `avatars.ts`), and write their own deck
and table code. If two or more new games repeat the same card code, the retro
(§10.2) proposes extracting it.

```ts
export class Deck<C> { constructor(cards: C[], rng: SeededRng); draw(n?): C[]; shuffle(): void; snapshot(); static restore() }
export class CardArt<Id extends string> { constructor(renderer: PixiRendererLike, draw: (g, id: Id, w, h) => void, opts);
  build(w: number, h?: number): void; face(id: Id): Texture; readonly back: Texture; }   // atlas via generateTexture, DPR clamp, delayed destroy
export class TurnMatch<S, M> { constructor(o: { seats: SeatCtl[]; apply(s: S, m: M): S; next(s: S): number; bot(s: S, seat: number, level: Level): M;
  hooks: MatchHooks }); setCtl(seat: number, ctl: 'local'|'remote'|'bot'): void; play(m: M): void; }  // uno/phase10 Match
export type Level = 'easy' | 'normal' | 'hard';   // one difficulty enum (games map their names onto it)
export function avatarSvg(seed: number): string; export const BOT_AVATARS: string[];   // phase10/uno avatars.ts (identical)
```

- **Extract from:**
  - uno `src/match.ts`: the best `Match`, with turn deadlines and a queue
    for moves made mid-animation
  - the `cardart.ts` atlas core from phase10, uno and skipbo
  - avatars from phase10/uno
  - skipbo's DOM-measured Pixi overlay (`rectOf(el)`), documented as a
    pattern
- If built later, it would be optional, behind `new-game --cards`.
- **Tests:**
  - deck determinism and snapshot;
  - `TurnMatch` with a bot takeover mid-turn;
  - the deadline fires;
  - a move made during an animation is queued.

### 4.20 `test-hook`: `window.__game`

```ts
export type GameTestHook = {
  readonly slug: string; readonly kit: string;              // kit version
  screen(): string; paused(): boolean; mode(): 'normal'|'daily'|'race'|'online'|null;
  snap(): JsonObject;                                        // game state summary (game supplies)
  ready(): boolean;                                          // body[data-ready]
  // drivers (game supplies; tests/scripts use them to reach scenes fast)
  newGame?(opts?): void; solveNow?(): void; move?(m: unknown): void; setState?(s: unknown): void; autoplay?(on: boolean): void;
  online?: { room(): unknown; inviteLink(): Promise<string> };
};
export function installTestHook(ctx: GameContext, extra?: () => Partial<GameTestHook>): void;
```

- **Gating:** read-only fields are always present, because the screenshot
  runner needs them in prod builds. Drivers (`setState`, `solveNow`) are
  installed only when `window.__HUB_TEST__` is set (the e2e kit sets it with
  `evaluateOnNewDocument`), on `localhost`, or in dev. That matches weston's
  and GD's practice.
- **One name for all games: `window.__game`.** That replaces `__p10`,
  `__uno`, `__sr`, `__bp`, `__GD__`, `__WESTON__` and the rest in new games
  (decision 15).
- **Extract from:** phase10 `P10Hook` (`src/main.ts:1424-1473`), the typed
  one; sliderush `__sr` for the shape; and the weston/GD gating.
- **Tests:**
  - drivers are absent without `__HUB_TEST__`;
  - `snap()` is JSON-serializable;
  - `ready` follows mount.

### 4.21 Localization

None of the 28 games localizes today. All copy is English, inline. The plan
doesn't build i18n. Two cheap steps keep it possible later:
- Every kit-rendered string goes through `kit/core/strings.ts`, an English
  table that the game can override.
- Games are encouraged, though not required, to keep their own copy in
  `src/game/strings.ts`.

Decision 10: no i18n now. If languages are wanted later, add `kit/i18n` with
`t(key, vars)`, `Intl`-free plurals, and the hub's locale once the hub exposes
one.

### 4.22 `testing`: `FakeHub` and friends (used only by tests)

```ts
export function createFakeHub(o?: { user?: FakeUser | null; offline?: boolean; saves?: Record<string, Json>; resumable?: boolean;
  dailyChallenges?: boolean; race?: boolean; multiplayer?: boolean }): FakeHub;
export interface FakeHub extends HubLike {
  calls: FakeCall[];                         // every hub call in order (putSave, submitScore, daily.complete, setBusy …)
  // drive events exactly as the real hub would
  openOverlay(reason?: OverlayReason, canPause?: boolean): void; closeOverlay(): void;
  launch(l: Launch): void; joinInfo(i): void;
  daily: FakeDaily & { start(day: string, seed?: number): void; error(): void };
  race: FakeRace & { start(r: Partial<RaceStart>): void; end(res): void; exit(): void; hud(rect): void };
  room(): FakeRoom;                          // emit room/state/msg/chat/seat/abandoned/kicked/ended/closed
  auth(user: FakeUser | null): void; reset(): void; goOffline(): void; goOnline(): void; saveUnknown(slot: string): void;
  resumeRequested(on: boolean): void; menuVisible(v: boolean): void; sourceChange(kind): void;
  saved?: FakeSaved; turns?: FakeTurns;      // when the hub ships them
}
export function fakeClock(): { now(): number; advance(ms: number): void; raf(): void };
export function fakeStorage(): Storage;      // also a throwing variant
export function fakeAudioContext(): AudioContext;
```

- **Fidelity:** the FakeHub's behaviour is copied from the hub docs, not
  guessed:
  - overlay nesting, and `autoPause` firing at once when it registers while
    UI is open;
  - `resume.save` returning `false` when blocked;
  - `daily.complete` returning `null` when queued;
  - races writing no stats;
  - room grace periods;
  - error codes.
- **Keeping it honest:**
  - `tests/kit/testing/contract.test.ts` checks that FakeHub's TypeScript
    surface is `satisfies HubLike`. The build fails when the hub's types
    change.
  - A short browser suite (`tests/hub/fake-parity.test.ts`) runs the same
    scenario against FakeHub and against the real local hub, then compares
    the call logs for overlay, daily, race and resume.
- Decision 2: FakeHub stays in the template. Moving it into the hub package
  (`@diffenderfer-games/hub/testing`) remains a later option (§6.2).

### 4.23 `saved`, `turns` and alerts: the saved-games plan, in full

The hub plan `docs/plans/saved-games.md` was approved on 2026-10-15 and none of
it is built yet. §4.5 and §4.8 sketch the adapters. This section lists every
§11 decision and says what a new game gets for it.

| Hub plan item (saved-games.md) | What a new game gets out of the box | Waiting on (hub phase) |
|---|---|---|
| **Daily instances with day credit**: one per (player, game, day); any number in progress; resuming and winning gives that day's credit even after the 30-day start window (decisions 1–3); `cancel()` becomes pause and `discard()` is give up | `kit/daily` already routes every non-win exit through one `leave()`, so the meaning change is a one-line switch inside the kit. `restore(run)` handles `challenge.saved`. The stub `src/game/daily.ts` has a `TODO(game)` that says "your daily state must be JSON and resumable". Tests: `daily.test.ts` rows 22–28 (Appendix B); the planned rows are skipped until the hub ships. Doc: `docs/kit/daily.md` § "Days in progress" | Phases 0–1 (foundations, dailies in progress), then a kit minor version to turn the planned tests on |
| **One run per player per game** (`kind:'run'`, today's `hub.resume`, now offline-first and never expiring) | `kit/resume` as specified in §4.5. The API is unchanged, so nothing waits except the expiry text in the docs | Already usable; phase 2 (offline run cut-over) needs no kit change |
| **`hub.saved`**: list, `opened`, `onOpen`, open, discard, counts, `on('change')`; `?hub_open=<id>` | `kit/saved`: `continueRows()` for the title screen, routing in the boot order (§3.4), and `onOpen` switching without a reload. Stub: `src/game/screens/title.ts` renders the rows the kit passes in. Tests: `saved.test.ts` (row 56). Screenshot: `continue` (§7.2) | Phases 0–1 (`hub.saved` published); until then `kit/saved` falls back to `hub.resume` only |
| **Turn games, any number per player**: claimed accounts only; strangers in open-seat lobbies; server-run **rules modules** (`game.turns.rules`, a self-contained ESM bundle); the hub owns the RNG; deadlines 1/3/7 days with the computer playing or skipping (decisions 5–7, 9) | `kit/turns` (§4.8): the `TurnGame` adapter and a pure `TurnRules<S, M, V, E, O>` stub at `src/game/turns/rules.ts`, with every method a `TODO(game)` (`setup`, `view`, `toAct`, `apply`, `outcome`, `progress`, plus optional `autoMove`, `migrate`, `eventView`). Also `npm run build:rules`, which bundles it to `dist-rules/rules.mjs` with no imports, as the manifest needs. Tests: `checkTurnRules(rules)` property tests (determinism with the injected RNG; `view` never leaks another seat's secrets; `apply` never throws; JSON ≤ 64 KB; `autoMove` always legal), plus `turns.test.ts` (row 57). Docs: `docs/kit/turns.md` | Phase 3 (turn engine plus the Pop Four pilot): the contract types land in `hub-contract`, and `@dg/hub-testkit` gets its own `checkTurnRules` |
| **One online implementation** (decision 8): Pop Four, Phase 10, Skip-Bo and Garbage move their online play to turn games, live while everyone is present | A **new** card or board game starts with `kit/turns` as its default online path (`new-game --online turns`). `--online rooms` stays for live, real-time play (Uno's jump-in style), and `--online server` for real-time competitive play | Phase 3 for `--online turns`. Moving the four existing games is in the migration doc |
| **"Your turn" alerts** (decision 4): on for players who already allow push; the one-time prompt; quiet hours; reminders; nudges | The hub does all of it. The kit adds three things: a "Remind them" button in the turn screen (`TurnGame.nudge`), a per-game bell (`setNotify`), and the rule that alert wording comes only from the hub (the game sends no text). Test: nudge is rate-limited in the UI. Doc: one paragraph in `docs/kit/turns.md` | Phase 4 |
| **Chat in turn games** (decision 12): moderated free text between friends, quick-chat for everyone else | The `kit/online` chat panel is reused unchanged: `chatMode` decides between on, quick and off | Phase 3 |
| **Player-facing wording rule**: never "run", "turn game", "instance" or a kind name; only "Continue" / "Your saved game", "Online with Sam · your turn", "Daily challenge · Oct 14"; groups "Your turn", "Daily challenges", "Saved games", "Online games" | `kit/core/strings.ts` has exactly these strings, and the kit renders no other wording. The lint rule (§8.5) flags the banned words in `src/game/**` string literals, and in the `progress()` labels a game returns, which are checked at runtime in dev. Test: `strings.test.ts` | Nothing; it applies now |

### 4.24 `avatar`: the avatars plan

The hub plan `docs/plans/avatars.md` was proposed on 2026-10-14 and none of it
is built yet. Its §11 lists what dg-template should pick up. The hub provides
everything below; the kit adds helpers and wiring on top.

**What the hub provides:**
- **The look:** a versioned, zod-validated data object, with no text, uploads
  or free drawing.
- **The wire code:** `AV1…`, carried on every payload that already carries a
  name.
- **A seeded default** for players who never designed one.
- **The renderer** (`@diffenderfer-games/hub/avatar`), which outputs:
  - SVG strings and elements;
  - the `<dg-avatar>` custom element;
  - Canvas 2D;
  - `ImageBitmap` and data URLs;
  - the server route `/_hub/avatar/<code>.svg`.
- **The animator** (`animator(look).pose(t)`, pure and time-based):
  expressions, look direction, blinking, talking, reactions and `feel`, with
  reduced motion respected.
- **Adapters:**
  - `/avatar/pixi`: `pixiAvatar`, `avatarTexture`, `createAtlas` and
    `createCrowd`;
  - `/avatar/three`: `avatarCanvasTexture` and `avatarSprite`.

  Each takes the library as an argument, so the hub has no peer dependency on
  pixi or three.
- **The designer**, opened with `hub.avatar.openDesigner()`.
- **`hub.avatar`:** `mine`, `of`, `many`, `from`, `bot`, `on('change')` and
  `load`.

**`kit/avatar`** (from avatars.md §11; renderer-neutral, with Pixi and three.js
helpers in the starters):

```ts
export function seatBadge(r: AvatarRenderer, seat: { look?: string; userId?: number; name: string }, o?: { size?: number; nameplate?: boolean }): SeatBadge; // head + name plate placed by layout() anchors
export function useSeatLook(badges: SeatBadge[], activeSeat: () => number | null): () => void;  // every face looks at the active player
export function feelOn<E extends string>(map: Record<E, Feel>): (event: E, seat: number) => void; // game events → anim.feel ('victim', 'cheer', …)
export function resultFaces(results: { seat: number; won: boolean }[]): void;                    // winner cheers, others happy/sad
export function nameAndFace(el: HTMLElement, who: { userId: number; name: string; look?: string }): void; // DOM: <dg-avatar> + name → openPlayer
export function botLook(seed: string): AvatarRef;   // hub.avatar.bot: stable faces for computer players
// starters: render/avatar-pixi.ts (pixiAvatar/createAtlas wrapper), render/avatar-three.ts (avatarSprite wrapper)
```

**What a new game gets out of the box:**
- **Title-screen demo** (avatars.md §11). The player's bust sits in a corner,
  blinking and looking at the pointer, with an **Edit** button that calls
  `hub.avatar.openDesigner()`. It uses `mine()`, the starter's adapter,
  `animator` and `on('change')` in about 20 lines in
  `src/game/screens/title.ts`, and it is easy to delete.
- **Every name the kit renders also shows a face:** lobby seats, the online
  people list, race results and the "Your games" rows. That follows the rule
  "show players' avatars wherever you show their names; never draw your own
  faces for real players" (CLAUDE.md).
- **Character games** (a hero that isn't the player's face) keep `kit/avatar`
  out of the hero. That rule is in `docs/kit/avatar.md`.
- **Stubs:** `src/game/avatar.ts`, a `feelOn` map with `TODO(game)` comments
  (which game events make faces react).
- **Tests:**
  - a vitest snapshot of `render.svg(defaultLook('test'))`, from avatars.md
    §11;
  - `seatBadge` falls back to the silhouette for a hidden player;
  - `feelOn` maps each event;
  - a hub-event test: `hub.avatar.on('change')` re-renders the badge;
  - an online suite case: every human seat renders a `<dg-avatar>` or
    `pixiAvatar`.
- **Screenshot scenario:** `avatar`, which shows the title bust and a lobby
  with faces.
- **Doc:** `docs/kit/avatar.md`.

**Waiting on:**
- Avatars phases 0–1 (data model, API, renderer and launch art) for the
  renderer and `hub.avatar`.
- Phase 2 for the designer.
- Phase 4 for the Pixi and three.js adapters.

Until the hub pin includes `/avatar`, `kit/avatar` compiles against a type-only
shim. The title demo then shows the old 24-creature token, and the avatar tests
are skipped. Then the template's hub pin moves to the first version with
`/avatar` and `/avatar/pixi` (avatars.md §11).

### 4.25 `world`: tables, `launch.table`, room files, the People panel

The hub plan `docs/plans/world.md` was proposed on 2026-10-14 and none of it is
built yet. Its §11.3 lists what the template kit should give new games. The
world itself is hub-owned (Hall, rooms, walking, tables, matchmaking), so a game
mostly declares data.

| Hub plan item (world.md) | What a new game gets out of the box | Waiting on |
|---|---|---|
| **`game.world.tables`** (§3.1): table types (`key`, `title`, `mode`, `players`, `maxWaitSec`, `art`, `count`, `options`), the Any table, `room`, `theme` | `new-game --online …` writes a `game.world` block derived from the game's `multiplayer.modes`, with commented examples for race and own-server tables. `kit:check` validates it the same way `hub-doctor` does (keys, titles of 24 chars at most, player ranges, at most 8 types and 16 tables). The world doc explains the defaults, so most games declare nothing | W2 (contract manifest) |
| **`launch.table`** (§3.4): `{ id, type, title, options? }` on an ordinary `host`/`guest` launch; for turn games, a `join` launch into a new turn instance | `kit/online`'s launch adapter reads `launch.table?.options` and passes them to `host.start(seats, { mode, table })`. The stub `src/game/online.ts` has a `TODO(game)`: "apply table options (e.g. jump-in rules)". A game that handles invites already handles tables. Tests: `launch.test.ts` gains rows for a table host launch, a table guest launch and a table turn-game join, plus the world.md §3.4 failure case ("That table didn't start": the leader never creates the room) | W2 (`Launch.table` published) |
| **`hub.mp.quickMatch({ mode? })`** (§3.6): sit at the matching table from inside the game | A "Quick match" button in the kit's online menu, shown when `multiplayer.quickMatch` is set, and the "Finding players… 2/4" state handled by the hub chip | W2 |
| **`dg-room@1` room files** (§7): a JSON room (tilesets, floor/decor/over layers, solid tiles, props, slots for the door, tables, play area, kiosks and quiet zones, table art, music), authored in Tiled, with limits of 1.5 MB, 64 × 48 tiles and no text | Opt-in, `new-game --world-room`: `world/room.tmj` (a Tiled starter on the default kit's tileset), `npm run world:build` (the `dg-room from-tiled` converter), and `npm run world:check` (the same validator as the registry, run through `hub-doctor`: reachability flood fill, limits, slots). Without a room file the hub generates a themed room, so most new games ship none | W4 (schema in the contract; the converter and checks live in the hub package and are called from the kit scripts) |
| **In-game People panel** (§6.1): who's in this match, friends here, also here, recent players, match and room chat, reactions, "Back to the world" | Free from the hub. The kit's duties are the ones it already has: `presence.set` per screen, hub rooms and races, `setQuiet` during intense play (which collapses floating reactions). Optional `hub.social.on('reaction')` for games that draw reactions in their own UI: a stub hook `onReaction` in `src/game/online.ts` | W3 |
| **`hub.mp.setRoster(userIds)`** (§6.2), for own-server games | `kit/server`'s client side calls `setRoster` whenever the server's match roster message changes. The game does nothing. Test: a roster change triggers one call (FakeHub) | W3 |
| **Avatar in the world while you play** (§4): goggles, Play-area pods, Watch | Nothing for the game. It depends on presence, which `kit/ui.Screens` and `kit/online` already set. The kit doc says to keep `presence.detail` short and kid-friendly ("Round 3"), because friends see it over the avatar | W3 |

**Also added for the world:**
- **Docs:** the "Tables" section of `docs/multiplayer.md` and "The world"
  section of `docs/hub.md` arrive through `sync-docs`. `docs/kit/world.md`
  links to them and covers tables, room files and Quick match.
- **Hub suite:** `tests/hub/online/table.test.ts`. Three contexts sit at a
  table in the world, are launched into the game, and agree on the room. It is
  skipped until the hub has W2.
- **Screenshot scenario:** `table-launch`. The game is opened from a world
  table, and the shot shows the lobby with the table title.

### 4.26 Summary: what a new game gets now, and what waits on the hub

| Area | Out of the box when the kit ships | Turns on when the hub ships |
|---|---|---|
| Saves, pause, resume, daily, race, rooms, scores, input, audio, UI, tests, screenshots | everything in §4.1–§4.22 | — |
| Days in progress, `hub.saved`, "Your games" Continue rows | `kit/saved` and `kit/daily` code paths, skipped tests, docs | saved-games phases 0–1 |
| Turn games, "your turn" alerts | `kit/turns`, the rules-module stub, `checkTurnRules`, `build:rules` | saved-games phases 3–4 |
| Avatars | `kit/avatar` helpers, the title demo, skipped tests | avatars phases 0–2 (renderer, designer), phase 4 (adapters) |
| World tables, `launch.table`, Quick match | the `game.world` block, launch handling, skipped table suite | world W2 |
| Room files | `world:build` / `world:check` scripts, Tiled starter (opt-in) | world W4 |
| People panel, reactions, `setRoster` | presence wiring, the `onReaction` stub, the `setRoster` call | world W3 |

**Rule for every row:** a planned hub API is used only behind a feature check
on the pinned client (`'saved' in hub`, `hub.avatar?.mine`), and its tests
are written now and skipped with a reason that names the hub phase. When the
hub publishes, the kit releases a minor version that removes the skips, and
games made from the template pick it up with `kit:sync`.

---

## 5. Starters: PixiJS and three.js

Both starters plug into the same `defineGame` hooks. The renderer lives only in
`src/game/render/`, and the kit never imports either one.

### 5.1 How to choose

| Pick | When | Examples in the catalog |
|---|---|---|
| **PixiJS 8** | 2D: cards, boards, puzzles, platformers, arcade, pixel art | 22 games: phase10, uno, skipbo, solitaire, garbage, bubblepop, sliderush, GD, weston, arrow-escape… |
| **three.js r186** | 3D or 2.5D: runners, sports, stacks, anything with a camera | dinodasher, helixdrop, baseball-typer, bfme's TA 3D edition |
| **Neither (DOM only)** | Word, typing or menu-heavy games | possible; the kit's `ui` is enough. Use `--renderer none` |

`npm run new-game -- --renderer pixi|three|none [--cards] [--online rooms|server] [--daily puzzle|seeded] [--race]`
does the following:
- copies the chosen starter into `src/game/render/`;
- sets the `labels` (`2d` or `3d`) and the optional `game.*` blocks
  (`dailyChallenges`, `race`, `multiplayer`, `resumable`);
- removes the unused optional hook files and their tests;
- deletes `src/starters/`.

`tools/New-Game.ps1` calls it.

### 5.2 PixiJS starter (`starters/pixi/`)

- **Version:** `pixi.js` `^8.6.0`, the fleet's floor. At template time, pin to
  the newest 8.x that every game builds with. arrow-escape is already on
  8.18.1.
- **Boot:**
  - An `Application` initialised inside the async boot, never with top-level
    `await` (the Pixi v8 chunk deadlock documented in today's `src/main.ts`).
  - Settings: `resizeTo: window`, `autoDensity: true`,
    `resolution: Math.min(2, devicePixelRatio)`, `antialias`, and a background
    colour from a CSS variable.
- **Stage layers:** `world` (camera-transformed), `fx` and `hud`. A camera
  helper does `follow`, `shake` and `zoom`.
- **Loop:** `kit/loop` `FixedLoop`, driven by `app.ticker`. Pausing stops the
  simulation but keeps rendering.
- **Resize:** `kit/layout.onResize`, with the forced `renderer.resize` on
  rotation (tetrablox). `layoutRegion` keeps gameplay clear of the HUD, the
  race bar and the menu button.
- **Assets:**
  - `Assets.init({ basePath: import.meta.env.BASE_URL })` and a typed
    manifest (`assets.ts`), so relative paths are always right under
    `/<slug>/`.
  - A procedural-texture helper (`textures.ts`, from bubblepop) for games
    with no art files.
  - A loading-progress bar that sets `data-ready` when it finishes.
- **Input binding:** `controls.ts` with a `play` group (move axis plus an
  action) and width-dependent virtual layouts (GD). `step()` reads
  `hub.input.vector('move')` and `down('action')`.
- **Avatars:** `render/avatar-pixi.ts` wraps `pixiAvatar`/`createAtlas` from
  `@diffenderfer-games/hub/avatar/pixi` (passing the Pixi namespace), for
  `kit/avatar` seat badges (§4.24).
- **Example scene:** "collect the coins", rebuilt on the hooks. It shows a
  daily from the seed, a race from the seed and params, resume, a
  leaderboard, pause, and haptics on collect.
- **Informed by:** dg-template's `src/main.ts`, bubblepop (textures, juice),
  GD (FixedLoop, virtual layouts), tetrablox (rotation), skipbo (DOM-measured
  overlay, for card games).

### 5.3 three.js starter (`starters/three/`)

- **Version:** `three` `^0.186.1` plus `@types/three` `^0.186.0`, the same
  in all four 3D repos.
- **`Stage`** (trimmed from dinodasher `src/render/stage.ts` and
  baseball-typer `src/render/scene.ts`):
  - `WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })`;
  - SRGB output and ACES tone mapping;
  - a hemisphere plus a directional light, with soft shadows that are off on
    `low` quality;
  - a PMREM room environment;
  - optional `EffectComposer` passes: Render → Bloom → Output, and FXAA on
    `low`.
- **Camera:** a perspective camera with `updateFov()`, which widens the lens
  on portrait phones (dinodasher's `updateFov`, baseball-typer's `fitFov`), and
  exponential follow easing.
- **Resize:** a `ResizeObserver` on the canvas parent. This fills the gap
  both 3D sources have, since neither uses one. It updates the renderer,
  composer, bloom resolution and camera aspect.
- **Quality:**
  - `quality.ts` presets `low`, `medium` and `high`, auto-picked from the GPU
    name, touch support and `deviceMemory`;
  - the `?q=` override;
  - a localStorage preference;
  - `AdaptiveResolution` lowers the pixel ratio when frames are slow
    (dinodasher `render/adaptive.ts`; baseball-typer `autoQuality.ts` is a
    reference).
- **Loop:** `renderer.setAnimationLoop` drives `FixedLoop`. dt is clamped to
  0.05. The game skips updates while paused.
- **Assets:**
  - a `GLTFLoader` and `TextureLoader` wrapper with a `BASE_URL` base and
    progress;
  - `warmup()`, which pre-compiles materials so the first frame doesn't
    stutter (dinodasher `Game.warmup`).
  - All four 3D games are procedural today, so the loader is a stub with an
    example.
- **Input binding:** the same `controls.ts`, plus canvas drag and swipe
  gestures (dinodasher `Controls`, helixdrop drag-to-spin).
- **Avatars:** `render/avatar-three.ts` wraps `avatarSprite`/
  `avatarCanvasTexture` from `@diffenderfer-games/hub/avatar/three` (§4.24).
- **Example scene:** a small 3D "collect the orbs" on a plane, with the same
  hub features as the Pixi example.
- **Screenshots:** `preserveDrawingBuffer` is on only under `__HUB_TEST__` or
  `?shot`. It costs performance, so it is not on everywhere.
- **Informed by:** dinodasher (the best: Stage, quality, adaptive resolution,
  worker music), baseball-typer (quality ladder, shot framings), helixdrop (a
  minimal `World`).

---

## 6. Testing

### 6.1 Conventions (vitest)

- **One runner for unit tests: vitest**, which the template already uses.
  Today the fleet uses five runners (vitest, `node --import tsx --test`,
  `--experimental-strip-types`, esbuild + node, and tsx scripts). New games
  use only vitest.
- `vitest.config.ts` has three projects:
  - `kit`: `tests/kit/**`, Node environment, jsdom per file where needed;
  - `hub-events`: `tests/hub-events/**`, jsdom, FakeHub;
  - `game`: `tests/game/**`.
- There is also a `slow` tag for long sims, as bfme's quick/slow split does.
  `npm test` runs everything except `slow`, and `npm run test:slow` runs
  `slow`.
- **Names:** `<module>.test.ts`. Each `describe` names the rule, and each
  regression test names the bug and game it came from, for example
  `it('never pushes defaults over an unread cloud save (helixdrop 2026-10)')`.
- **Determinism:** tests use `fakeClock`, `SeededRng` and `fakeStorage`, and
  never touch the real `Math.random` or `Date.now`. A lint rule bans
  `Math.random` in `src/game/rules.ts` and `src/game/daily.ts` (§8.5).
- **Template self-test:** the stub game ships with green tests. CI and
  `npm run check` run them on the template itself, so a kit change that
  breaks the stub fails before any game copies it.

### 6.2 Unit tests for every hub event (FakeHub). Recommendation: the template owns it

- **Recommendation: the FakeHub lives in the template** (`src/kit/testing/`),
  and the hub's test kit stays for browser suites. The reasons:
  1. The hub's test kit (`test/helpers`, `test/e2e/helpers.mjs`) boots a
     **real** dg-hub plus dg-host. That takes seconds per suite, needs Chrome,
     and needs a sibling checkout of the hub (`DG_HOST`). It is the right tool
     for integration, and the wrong one for hundreds of fast unit cases.
  2. The kit's modules take a `HubLike`, so a fake that matches that shape is
     all the unit tests need, and it runs in milliseconds in vitest with no
     sibling repo. This also helps other contributors, such as
     Mason.
  3. The FakeHub is kept honest by `satisfies HubLike` (the types) and the
     fake-parity browser suite (behaviour), §4.22.
- **Later (decision 2 keeps this open):** once it has settled, offer it to the hub as
  `@diffenderfer-games/hub/testing`, so the hub team owns fidelity. The kit
  would then re-export it. That is a hub change, so it is not in this plan's
  scope.
- **What is tested:** Appendix B lists every hub event and callback a game can
  receive, with the kit handler and the test file for each. The suites in
  `tests/hub-events/` run **the kit against the stub game**. The stub game's
  hooks record calls, so each test asserts what the hub saw (`fake.calls`) and
  what the game was asked to do (`game.calls`). A game that replaces a stub
  keeps these tests green, because they test the kit contract, not the
  game's pixels.
- **Game-specific hub tests:** `tests/game/hub-*.test.ts`. The template
  includes one example: "the daily builds the same level for the same seed,
  and finishing it records stars".

### 6.3 Hub tests in a real browser against a local hub

- **Kept from today:** the hub's own test kit drives a real host. Each suite
  starts with `e2eEnv({ apps: { [SLUG]: ROOT }, env })` from
  `${DG_HOST}/test/e2e/helpers.mjs`. A script can instead point
  `DG_TEST_URL` at an already-running `npm run local` instance.
  `HUB_IMPL` is gone after the hub's phase 12, so nothing sets it. This
  retires phase10's `process.env.HUB_IMPL ||= 'next'`.
- **New, `tests/hub/_kit.ts` (KIT).** It extracts the near-identical
  `_kit.mjs` files from phase10, uno, skipbo, bingo, clue and garbage, plus the
  race-test headers of bubblepop, GD, weston, tetrablox and quanta.
  - Setup: `ROOT`, `SLUG`, `HUB`, the dynamic import of the test kit, `L =
    '#hub-social-layer >>> '`.
  - Game helpers: `game(page)` (reads `window.__game`), `waitGame(page,
    pred)` (dumps `snap()` on failure), `press(page, testid)`, `landed`.
  - Room helpers: `createRoom`, `joinByCode`, `addBots`, `startGame`,
    `autoplay`, `inviteFromDrawer`, `waitLaunch`.
  - Race helpers: `startRace`, `raceState`, `waitLive`.
  - Re-exported from the hub kit: `befriend`, `settle`, `waitForSocial`,
    `openHubMenu`, `closeHubMenu`, `deepFind`, `until`, `MPDEMO_DIR`.
- **Standard suites (KIT).** They are parameterized by the `game` block, and
  a suite whose feature the game doesn't declare skips itself.

  | Suite | Scenarios | Required for |
  |---|---|---|
  | `pause.test.ts` | Open the hub menu → game paused (`__HUB_TEST__.overlayLog`) → close → pause screen (action) or resumed (turn-based); the intro under webdriver doesn't pause | every game |
  | `save.test.ts` | Play → reload → progress kept; a guest plays then logs in (the merge reloads) → account progress not reset; offline boot with `save_unknown` → nothing overwritten after going online | every game with a profile |
  | `resume.test.ts` | Mid-game reload via `?hub_resume=1` → Continue → same `snap()`; win → the card is gone | `resumable` |
  | `daily.test.ts` | `?daily=today` → `hub:daily-started` → `solveNow()` → `hub:daily-complete` → calendar marked; quit mid-daily → `cancel` → normal play saves again; normal bests untouched | `dailyChallenges` |
  | `race.test.ts` | Two players, `raceCountdownMs:1200`, status reaches the HUD, `finish`, result card, no pause during the race | `race` |
  | `online/*.test.ts` | The 10 multiplayer.md §12 scenarios: invite → jump → accept → lobby; decline, expire, cancel; leave guard; join and watch; pause on hub open; chat (reject, soften, quick-only, off); reconnect; suspended; resilience (seat away → computer → back); invite link | `multiplayer` |

- **Language: `.ts`** (decision 8), run by `node --test` with type stripping
  (Node ≥ 22.18 runs `.ts` directly). They import the hub's `.mjs` test kit
  through a typed wrapper in `tests/hub/_kit.ts`.
- **Planned-hub suites** are written now and skipped with a reason that names
  the hub phase:
  - `saved.test.ts`: "Your games" → open a day in progress → win → day
    credit;
  - `turns.test.ts`: create → invite → move → the other page gets `move`
    → reload → `history`;
  - `online/table.test.ts`: launched from a world table;
  - `avatar.test.ts`: every human seat shows a face; a design change
    re-renders live.
- **Run them** with `npm run test:hub`, which is `node --test
  --test-concurrency=1 tests/hub/`.

### 6.4 Multiplayer test scenarios

- **Two or more players** each get their own browser context (`newPlayer`).
- **Resilience:**
  - kill a guest's page, and check the computer takes the seat within the
    grace period (`HUB_LIMITS_JSON {"roomGraceMs": 3000}`);
  - reopen it, and check the player gets the seat back with the same
    `snap()`;
  - kill the host, and check the successor loads the freshest backup and play
    continues.
- **Determinism across peers:** the host's and the guest's `snap()` agree on
  every public field after N autoplay moves (bfme `mp-e2e` checks lockstep
  hashes the same way).
- **Own-server games** add `server.test.ts`:
  - boot the `start` command exactly as the catalog does (bfme
    `smoke-prod.mjs`);
  - `/healthz` answers;
  - a WebSocket with a ticket is accepted;
  - a bad ticket gets 4401.
- **Turn games (planned):**
  - `checkTurnRules(rules)` runs in unit tests;
  - in the browser: create → invite → move → the other page gets `move` →
    reload → `history` replays.

### 6.5 Seeded simulation harness (AI and rules)

```ts
// kit/testing/sim.ts
export function simulate<S, M>(o: { seeds: number | number[]; setup(rng: SeededRng): S; moves(s: S): M[]; pick(s: S, ms: M[], rng): M;
  apply(s: S, m: M): S; over(s: S): boolean; invariants?: ((s: S) => string | null)[]; maxSteps?: number }): SimReport;
// SimReport: games, steps, wins by seat/level, invariant failures with the seed + move list to reproduce, timings
```

- **Extract from:**
  - uno `tests/unit/simulate.ts`: invariant checks after every move;
  - garbage `scripts/sim.ts`: a 3000-seed soak;
  - phase10 `scripts/sim.ts`;
  - bfme `scripts/simrun.ts`: the pattern of an esbuild bundle written to
    `.tmp` and run with node, plus a balance report.
- **Two entry points:**
  - `tests/game/sim.test.ts`: 200 seeds, part of `npm test`;
  - `npm run sim -- --seeds 5000 --level hard`: prints a balance table to
    `docs/balance.md`.
- **Daily harness:** `daily-puzzle/harness.ts` `assertDailyHarness` (365 days)
  is unchanged. It becomes the `daily` part of `tests/game/`.

### 6.6 CI

- The rule is **self-hosted runners only**: deploys run on the org's Windows
  runner, and GitHub-hosted runners are never used.
- **`deploy.yml`** (KIT) is the current dg-template workflow plus a
  **gate** before the deploy step. Decision 7 says the browser hub suites gate
  deploys. The gate runs:
  1. `npm ci`;
  2. `npm run check` (typecheck, unit and hub-event tests, lint,
     `kit:check`, `hub-doctor`, build);
  3. **`npm run test:hub`** against a hub started by the test kit.
- **What the runner needs for step 3:**
  - a hub checkout at a known path, given as `DG_HOST` in the runner's
    environment and kept current by a scheduled `git pull` plus `npm ci`;
  - Chrome (`CHROME_PATH`);
  - a port range kept for CI runs, so they never clash with local instances.

  bfme's CI-gated deploy already works this way (a quick local tier, full
  suites in CI, every run watched), and it is the model.
- **A gate failure stops the deploy.** Whoever pushed watches the run. A
  `workflow_dispatch` input `skip_hub_suites` exists for emergencies, and
  using it is logged in the job summary.
- **Template CI:** the template is a public repo, so it gets no self-hosted
  runner, and the user's rule forbids GitHub-hosted ones. That means **no CI
  for the template itself**. `npm run check` runs locally before every
  template push, which the CLAUDE.md for the template says.
- Commits that don't change the game use `[skip ci]`, as in bfme.

---

## 7. Screenshot tooling

- **Today:**
  - dg-template `scripts/shots.mjs` serves `dist/` on port 0 under
    `/<slug>/`, at 1280×800 and 390×844. It is the best runner in the fleet.
  - `shots-hub.mjs` runs against a local hub.
  - bfme has the most complete tooling: `shots.mjs` with `__ready` and
    `docs/VISUALS.md`, contact sheets (`ta-contact.mjs`, `art-sheet.mjs`) and
    `procs.mjs` for cleanup.
- **The plan:** one runner with named **scenarios**, two targets, and a
  contact sheet.

### 7.1 The runner

```
npm run shots                      # static: build → serve dist on port 0 → every scenario that needs no hub, phone + desktop
npm run shots:hub                  # hub: --free-port → `npm run local -- --only <slug> --port N` (started and stopped for you) → hub scenarios
npm run shots -- title pause --size phone --theme dark   # filter by scenario / size
npm run shots:sheet                # contact sheet of the last run → shots/sheet.png (+ shots/index.html)
```

- **`scripts/kit/shots.ts`** (KIT) does the following:
  - picks free ports and starts or stops servers;
  - guards its processes with bfme `procs.mjs` (`guardSuite`, a pidfile, and
    a Chrome `--dg-shots=<repo>` tag);
  - launches puppeteer-core from `DG_HOST` with system Chrome
    (`CHROME_PATH`);
  - for each player, opens a separate browser context (its own guest);
  - waits for `document.body.dataset.ready === '1'` and `window.__game`;
  - runs each scenario;
  - saves `shots/<scenario>-<size>.png` (git-ignored);
  - writes `shots/manifest.json` with the scenario, size, URL, console errors
    and `__game.snap()`.
- **Any console error fails the run.** The hub's `BENIGN_CONSOLE` list is
  allowed.
- **Sizes:**
  - `desk` 1280×800;
  - `phone` 390×844 (DPR 2, touch);
  - `phone-land` 844×390;
  - `tablet` 820×1180, optional.
- **How it drives the game:**
  - the **hub UI** through the e2e helpers (`openHubMenu`, `deepClick` with
    `#hub-social-layer >>>`);
  - the **game** through `window.__game` drivers, enabled by
    `__HUB_TEST__ = {}` (`evaluateOnNewDocument`);
  - **hub state** through hub URL params (`?daily=`, `?hub_resume=1`,
    `?hub_intro=spin`) and `HUB_LIMITS_JSON` (a short race countdown).

### 7.2 Premade scenarios (KIT; each game adds its own in `scripts/shots.config.ts`)

| Scenario | Target | How it gets there | What it checks |
|---|---|---|---|
| `title` | static | load, wait `ready` | splash/title, Continue rows, menu button room |
| `intro` | hub | `?hub_intro=spin` on localhost, shot at 600 ms (the intro never plays under webdriver without the param) | the intro over the loading game |
| `menu` | static | `__game.screen('title')` → focus first `[data-nav]` with a gamepad event | focus ring visible (`data-hub-input=keys`) |
| `howto`, `settings` | static | press `settings` testid | the kit sheet + game rows |
| `play` | static | `__game.newGame()`; `autoplay(true)` for 2 s | gameplay, HUD clear of the menu button and safe area |
| `pause` | static | `__game.pause()` | pause screen, menu visible |
| `gameover` | static | `__game.setState(over)` or `solveNow()` | result screen |
| `hub-menu` | hub | `openHubMenu` | game paused under the open hub menu |
| `daily-start` | hub | `?daily=<today>` | daily banner/goal |
| `daily-done` | hub | `?daily=<today>` → `solveNow()` → wait `hub:daily-complete` | win screen + the calendar mark in the menu |
| `continue` | hub | play → `resume.flush()` → reload with `?hub_resume=1` | the Continue card / restored game ("Your games" once `hub.saved` ships) |
| `invite` | hub | player B invites A (`befriend` + `openInvite`) | the invite toast on A over the game |
| `lobby` | hub | A hosts, B joins by code | lobby with names, Invite and 🔔 |
| `race-hud` | hub | A creates a race, B joins, countdown 1200 ms | race HUD clear of the game's HUD |
| `race-result` | hub | both `finish` | result card |
| `toast` | static | `kit/ui.toast` with actions | toast placement on phone |
| `offline` | static | `page.setOfflineMode(true)` after load | the offline title and no errors |
| `avatar` | hub | title with the player's bust; a lobby with faces on every seat (skipped until avatars ships) | faces beside names, Edit opens the designer |
| `table-launch` | hub | three players sit at a world table → launched into the game (skipped until world W2) | lobby shows the table title; the game used `launch.table.options` |
| `your-games` | hub | a day in progress + a saved game → menu "Your games" (skipped until saved-games phase 1) | wording: "Continue", "Daily challenge · Oct 14", never "run" |
| `cover` | static | `?cover` or `__game.cover()` | writes `cover.png` (replaces the 9 different make-cover scripts) |

### 7.3 Contact sheet

- **`scripts/kit/sheet.ts`** (KIT) builds a labelled grid of every shot from
  the last run: one row per scenario, one column per size.
  - Output: `shots/sheet.png` (no larger than 2048², the bfme art rule) and
    `shots/index.html` (filterable, with the manifest data).
  - Built with puppeteer, by rendering an HTML grid and screenshotting it, so
    no image library is added.
  - **Extract from:** bfme `scripts/ta-contact.mjs`, `art-sheet.mjs` and
    `art-index.mjs`.
- **`--diff <dir>`** compares against a saved run. It hashes each image and
  marks the ones that changed, like bfme's `--hash`/`--diff`. This is a cheap
  visual regression check before pushing.
- The memory rule "show images with Read" applies: agents look at
  `shots/sheet.png` with Read instead of guessing.

### 7.4 Related checks (KIT, from bfme)

- `npm run ui:check`, from bfme `ui-survey.mjs` and `textfit.mjs`. At phone
  and desktop sizes it finds:
  - text that is clipped;
  - controls smaller than 44 px;
  - content overflowing the viewport;
  - overlaps with the hub menu button.
- `npm run probe -- <url> "<expr>"` (bfme `probe.mjs`) loads a page, waits for
  `ready`, evaluates the expression and prints JSON plus the console errors.

---

## 8. Scripts and tooling

### 8.1 The standard `package.json` scripts

| Script | Command | Notes |
|---|---|---|
| `dev` | `vite` | `--strictPort` when a port is given |
| `build` | `vite build` | → `dist/` (catalog contract) |
| `preview` | `vite preview --strictPort` | |
| `typecheck` | `tsc --noEmit` | strict |
| `test` | `vitest run` | kit + hub-events + game (not `slow`) |
| `test:slow` | `vitest run --project slow` | long sims, 365-day daily harness |
| `test:hub` | `node --test --test-concurrency=1 tests/hub/` | real local hub via DG_HOST |
| `check` | `node scripts/kit/check.ts` | parallel lanes: typecheck, test, lint, kit:check, hub-doctor, build; logs in `.tmp/check/<lane>.log`; ✗ lines echoed (bfme `check-quick.mjs`) |
| `hub-doctor` | `hub-doctor` | bin from `@diffenderfer-games/hub` |
| `kit:sync` | `node scripts/kit/kit-sync.ts [module…]` | copies from `../dg-template` (or `DG_TEMPLATE`), updates `kit.json`, prints the CHANGELOG since your version |
| `kit:check` | `node scripts/kit/kit-check.ts` | hashes vs `kit.json`; manifest checks (labels, changes, declared boards vs used keys) |
| `shots`, `shots:hub`, `shots:sheet` | `node scripts/kit/shots.ts …` | §7 |
| `cover` | `npm run shots -- cover` | writes `cover.png` |
| `sim` | `node scripts/sim.ts` | game's sim entry (§6.5) |
| `local` | `node scripts/kit/local.ts` | free port → `npm run local -- --only <slug> --port N` in DG_HOST, prints the URL, stops on Ctrl-C |
| `local:link` / `local:unlink` | forwards to the hub's `local:link --only <slug>` | uses the hub's built packages without touching the lockfile |
| `sync-docs` | `node scripts/kit/sync-docs.ts` | `hub.md`, `multiplayer.md`, `HANDOFF.md` from the hub (unchanged behaviour; today's file is byte-identical in 10+ repos) |
| `sync-hub-server` | `node scripts/kit/sync-hub-server.ts` | own-server only; runs the hub's tool from its **root** (today's `cd ../diffenderfer-games && … tools/sync-hub-server.ts` path only works once the hub's phase 12 lands) |
| `build:rules` | `node scripts/kit/build-rules.ts` | turn games only: bundles `src/game/turns/rules.ts` to a self-contained `dist-rules/rules.mjs` (saved-games §4.1) |
| `world:build` / `world:check` | `node scripts/kit/world.ts build\|check` | opt-in room file: Tiled `world/room.tmj` → `dg-room@1`, then the registry's validator via `hub-doctor` (world.md §7) |
| `todo` | `node scripts/kit/todo.ts` | lists remaining `TODO(game)` stubs |
| `clean:procs` | `node scripts/kit/procs.ts --clean` | kill leftover Chrome/vite from this repo's scripts (bfme `procs.mjs`) |
| `lint`, `format` | `eslint .`, `prettier -w .` | §8.5 |
| `new-game` | `node scripts/kit/new-game.ts` | template only: choose renderer and features (§5.1) |

### 8.2 Local-instance helpers

- `npm run local` wraps the hub's `npm run local`. It handles the
  CLAUDE.md "find a free port first" rule:
  - it uses `--free-port` logic from today's `shots-hub.mjs`, checking four
    neighbouring ports because the hub uses P, P+1 and P+2;
  - it passes `--only <slug>`;
  - it waits for health;
  - it writes `.tmp/local.json` (`{ url, port, pid }`), so `shots:hub`,
    `test:hub` (via `DG_TEST_URL`) and `probe` reuse the running instance.
- It never takes port 8099, which the user keeps for their own instance,
  unless asked to.
- The hub assigns game-server ports in a block of 300
  (`20000 + (P % 90) × 300`). The helper prints that block for own-server
  games.

### 8.3 Sync scripts (template → game and hub → game)

| What | From | Script | Rule |
|---|---|---|---|
| Kit modules, kit tests, kit scripts, kit docs | dg-template | `kit:sync` | byte-identical; `kit:check` enforces |
| `hub.md`, `multiplayer.md`, `HANDOFF.md` | the hub | `sync-docs` | never hand-edit |
| `server/hub-server.mjs` | the hub (`packages/server/server-sdk`) | `sync-hub-server` | own-server only |
| hub client | npm `@diffenderfer-games/hub` | `npm i -E` | exact pin; `hub-doctor` |

**How `kit:sync` works:**
- It reads the template's `kit.json`.
- It shows which modules changed since the game's version, with their
  CHANGELOG entries.
- It copies the selected modules, with all modules as the default.
- It refuses a module whose local copy was edited, unless `--force`. That
  case means the game forked a file: move it out of `src/kit/`.
- It runs `npm run check`.
- A kit version is `major.minor`. A **major** bump means a hook signature
  changed. CHANGELOG entries for majors carry a migration note.

### 8.4 Deploy workflow

The current dg-template `deploy.yml` becomes a KIT file. It is already shared
by 8 repos, has a guard, deploys from the self-hosted runner only, and does a
first-deploy clone and link. The plan adds the gate from §6.6. Moving the older
variants in existing games onto it is in the migration doc.

### 8.5 Lint and format

- **New games only** (decision 9): **ESLint** (flat config) plus
  `typescript-eslint`, and **Prettier**, with one config file,
  `eslint.config.ts` (KIT). Existing games are not reformatted.
- Today no game lints. Adding lint is new work, so the rules stay few and
  aimed at real bugs:
  - `no-restricted-properties: Math.random` in `src/game/{rules,daily,race}.ts`
    and `src/kit/**`. The only exception is `randomSeed` in `kit/rng`.
  - `no-restricted-globals: Date` in the same files. Use the injected clock
    instead.
  - No `innerHTML` with a variable. Use `textContent` or `h()`, because of
    the chat and names rule.
  - A banned-words check on string literals in `src/game/**`: no violent
    words, and none of "run", "turn game" or "instance" in the UI copy table.
  - No `localStorage` outside `kit/core/store` (the guards depend on it).
  - No floating promises in `src/kit`.
- Prettier runs on save. In new games, `npm run check` also runs
  `prettier --check`.

---

## 9. Docs: what to add, split, merge and rewrite

Today the template has:
- a long `README.md` (about 230 lines, mixing org setup, the kit and hosting);
- a long `CLAUDE.md` (about 230 lines, much of it repeating `hub.md`);
- `docs/audio.md`;
- the three synced hub docs.

Games copy `CLAUDE.md` and then drift: every copy in the fleet differs, and
`docs/hub.md` has at least 4 different hashes across games.

### 9.1 New and moved docs

| Doc | Kind | Contents |
|---|---|---|
| `README.md` | GAME (template version) | One screen: what this is, the 10-step quick start, the doc map. Org/repo setup moves out. |
| `docs/getting-started.md` | KIT | **"Make a new game in 10 steps":** 1. create the repo from the template (org, private, secrets: today's README "Where games live"); 2. `npm i`; 3. `npm run new-game -- --renderer …`; 4. fill `package.json` `game` (title, labels, features); 5. fill `src/game/state.ts` + `rules.ts`; 6. `controls.ts`; 7. render + screens; 8. optional daily/race/online hooks; 9. `npm run check && npm run test:hub && npm run shots:hub` and look at the sheet; 10. push (first deploy) |
| `docs/kit/README.md` | KIT | The kit map: module → one line → doc; the KIT/GAME/SYNCED rules; how to change the kit (template first) |
| `docs/kit/<module>.md` | KIT | One per module (§4): what it does, the hooks, the rules it enforces (linking the hub doc heading), options, a 10-line example, the tests that cover it |
| `docs/kit/CHANGELOG.md` | KIT | Kit versions, per module, with migration notes for majors |
| `docs/kit/testing.md` | KIT | The pyramid (§6), FakeHub usage, writing a hub-event test, `tests/hub/_kit.ts`, the required suites by feature, running against `npm run local`, multiplayer scenarios, the sim harness |
| `docs/kit/screenshots.md` | KIT | §7: scenarios, adding your own in `shots.config.ts`, sizes, the contact sheet, `--diff`, looking at shots with Read |
| `docs/kit/audio.md` | KIT | Moved from `docs/audio.md`, rewritten around `MusicCore` + the three hosts (§4.12) |
| `docs/kit/daily-puzzle.md` | KIT | Moved from the README's "Daily puzzle kit" section, unchanged |
| `docs/kit/whats-new.md` | KIT | Writing `game.changes` for kids, with good/bad examples; labels list |
| `docs/kit/saved.md`, `turns.md`, `avatar.md`, `world.md` | KIT | The planned-hub modules (§4.23–§4.25): what the game does, what the hub does, which hub phase turns each part on |
| `docs/plans/kit-retros.md` | template only | One dated retro per new game made with the kit (§10.2) |
| `docs/repo-setup.md` | KIT | From today's README: the org, secrets, the self-hosted runner, the first deploy, the public template's guarded deploy, hosting/symlinks |
| `docs/game.md` | GAME | The game's own notes: design, controls, the race/daily/online design, test hooks it adds, known issues. This replaces the per-game sections games append to CLAUDE.md today ("Race plan", "Bingo notes") |

### 9.2 Relationship to the hub's synced docs

- **`hub.md`, `multiplayer.md` and `HANDOFF.md` stay the source of the rules.**
  They are synced and never edited.
- Kit docs **link** to their headings, for example "pause rules:
  `docs/multiplayer.md` §4". They never restate a rule.
- When a kit module enforces a rule, its doc says so in one line: "Enforced:
  `autoPause` once at boot (multiplayer.md §4)".
- Each module doc ends with "Hub API used:", a list of calls with links. A
  hub API change then shows which kit docs to update.
- **A proposal for the hub team** (not part of this change): `hub.md` and
  `multiplayer.md` could gain a short "If you use the dg-template kit" note
  per section, saying the kit does this for you, with a pointer to
  `docs/kit/<module>.md`. Agents would then stop hand-wiring what the kit
  already does. Decision 11 accepts this as a later hub-repo change; this plan
  leaves the hub repo untouched.
- `sync-docs` also checks that every `docs/kit/*.md` link to a hub heading
  still resolves, and warns when one doesn't.

### 9.3 CLAUDE.md, the agent brief, rewritten short

The goal is about 80 lines that point to the docs instead of repeating them:

1. **What this repo is:** a game on the dg kit. Read
   `docs/getting-started.md`, then `docs/game.md`.
2. **Where things live:** KIT / GAME / SYNCED, and "never edit `src/kit/`;
   change the template and `kit:sync`".
3. **The hard rules,** one line each, with links:
   - `base: './'`;
   - the exact hub pin plus `hub-doctor`;
   - never vendor the hub;
   - never edit the synced docs;
   - pause on hub open (the kit does it);
   - music in a worker (`kit/audio`);
   - online play through the hub only;
   - no violent words;
   - never say "run" or "turn game" to players;
   - `game.changes` for each visible change.
4. **How to implement:** fill the `TODO(game)` stubs (`npm run todo`), and
   which hook does what (a table).
5. **How to check:** `npm run check`, `npm run test:hub`,
   `npm run shots:hub`, then look at `shots/sheet.png`. Find a free port
   first; stop the servers you start.
6. **Definition of done:** today's list, plus "kit:check clean", "the
   required hub suites pass" and "the contact sheet looks right at phone and
   desktop".
7. **Conventions:**
   - never delete scripts or tests (bfme, dinodasher);
   - plans go in `docs/plans/`;
   - `[skip ci]` on commits that don't change the game;
   - determinism rules for rules, daily and race code.

The per-game content goes in `docs/game.md`.

**Decision 12: CLAUDE.md is not synced.**
- The template's CLAUDE.md is its own short file. It points at the synced docs
  (`HANDOFF.md`, `docs/hub.md`, `docs/multiplayer.md`) and the kit docs
  instead of repeating them.
- A new game starts from the template's copy and owns it from then on.
- The template's copy improves after each new game's retro (§10.2).

### 9.4 What to split, merge or rewrite

| Today | Action |
|---|---|
| README "Where games live", "Hosting", deploy prose | **Split** into `docs/repo-setup.md` |
| README "Daily puzzle kit" | **Move** to `docs/kit/daily-puzzle.md` |
| README "Updating the hub client / docs / SDK" | **Merge** into `docs/kit/README.md` § "Keeping up to date" (with `kit:sync`) |
| CLAUDE.md "Using the hub" (a mini `hub.md`) | **Delete**, replaced by the hooks table and links; the kit does most of it now |
| CLAUDE.md "Audio", "Multiplayer" prose | **Shrink** to one rule line each + link to `docs/kit/audio.md` / `docs/kit/online.md` |
| CLAUDE.md "Checking your work: screenshots" | **Move** to `docs/kit/screenshots.md`; keep the free-port rule in CLAUDE.md |
| `docs/audio.md` | **Rewrite** as `docs/kit/audio.md` (keeps the Worker rule; adds `MusicCore` and the opt-in worklet host) |
| Per-game notes inside CLAUDE.md | New games keep them in `docs/game.md` from the start; existing games: see the migration doc |

---

## 10. Making new games with the kit (the iteration loop)

**Existing games are not migrated now** (the user, 2026-10-15). Moving the 28
current games onto the kit is a future endeavour, planned in
[template-kit-migration.md](template-kit-migration.md). The survey in
Appendix A is still the source list for *extracting* code; it says nothing
about changing those games.

The approach:
1. build the kit in the template (P0–P5);
2. make **a few new games** with it;
3. after each one, improve the template's code and context from what was
   learned.

### 10.1 The new games

Choose three or four small games, each a different shape, so together they
exercise every module and both starters. The user picks the actual games (§12,
open question A). A suggested spread:

| # | Shape | Starter | Kit features it proves |
|---|---|---|---|
| 1 | A single-player arcade or puzzle game with a daily and a race | Pixi | boot, input, pause, save guards, resume, daily (seeded), race, scores, audio, haptics, screenshots |
| 2 | A 3D game | three.js | the three.js starter, quality and adaptive resolution, worker music over plain http, a phone layout |
| 3 | An online card or board game | Pixi or DOM | `kit/online` (rooms), then `kit/turns` once saved-games phase 3 ships, the daily-puzzle kit, `kit/avatar` seats, world tables |
| 4 (optional) | An own-server real-time game | Pixi | `kit/server`, tickets, `setRoster`, seat grace |

### 10.2 The loop, for each new game

1. **Start from the template** exactly as a stranger would:
   - follow `docs/getting-started.md` and CLAUDE.md only, in a fresh agent
     session;
   - note every question the docs didn't answer.
2. **Build the game** by filling in the `TODO(game)` stubs:
   - record any hook that was missing or awkward;
   - record any kit option the game needed;
   - record any place where the game had to copy kit code or work around it.
3. **Check it** the standard way:
   - `npm run check`, `npm run test:hub` and `npm run shots:hub`;
   - look at the contact sheet;
   - note anything the standard suites or scenarios missed.
4. **Write a retro** in the template's `docs/plans/kit-retros.md`: one dated
   section per game with three lists. Hook gaps; doc and CLAUDE.md gaps; time
   spent and where it went.
5. **Improve the template:**
   - move code that the game had to write but that every game will need into
     the kit (a kit minor version), with tests;
   - fix the docs, CLAUDE.md and the stubs' `TODO` text;
   - add the screenshot scenarios that were missing;
   - record each change in `docs/kit/CHANGELOG.md`.
6. **Bring the improvements back** to the new games made so far with
   `npm run kit:sync`, so the kit is used by more than one game before the
   next one starts.

The measure of success: each new game takes less time, and has fewer "the
docs didn't say" notes, than the one before.

### 10.3 What stays out of scope here

All of these are covered in the migration doc:
- the adoption waves;
- pilots;
- per-game migration effort;
- `kit:sync` rollout to existing games;
- the existing games' compliance gaps;
- the old `deploy.yml` variants;
- single-file games.

---

## 11. Phasing and effort

Efforts are in agent-days, including tests and docs. The hub-dependent work
from §4.23–§4.26 is listed separately; it starts when the hub phase it waits on
is published.

| Phase | Work | Effort | Exit check |
|---|---|---|---|
| **P0, foundations** | `kit.json` + `kit:sync`/`kit:check`; `kit/core`, `kit/testing` (FakeHub + contract test); vitest projects; strict tsconfig; ESLint/Prettier; fold daily-puzzle in (rng re-export) | 3 | template `npm run check` green |
| **P1, guard modules** | `save`, `resume`, `daily`, `pause`, `scores`, `rng`, `test-hook` + every hub-event test for them (Appendix B rows 1–30) | 5 | each audit regression has a named test |
| **P2, boot + UI + starters** | `boot` (`defineGame`), `input`, `layout`, `loop`, `ui`, `settings-ui`, the stub game on hooks; the Pixi and three.js starters; `new-game` | 5 | a fresh `new-game --renderer three` builds, plays, passes `test` and the pause hub suite |
| **P3, features** | `race`, `online` (rooms, resilience, chat, links, `launch.table` handling), `audio` (MusicCore, Worker default, http-safe; §4.12), `haptics`, `server` | 6 | race + 10 online scenarios pass on the stub game against `npm run local`; music plays over `http://<LAN IP>` |
| **P3b, planned-hub scaffolding** | `kit/saved`, `kit/turns` (+ `TurnRules` stub, `checkTurnRules`, `build:rules`), `kit/avatar` (type shim, title demo), `game.world` block + table launch rows, `world:build`/`world:check` wrappers; every planned test written and skipped with its hub phase | 3 | `npm run check` green with the skips listed in the report |
| **P4, test + screenshot tooling** | `tests/hub/_kit.ts` + the standard suites in `.ts`; `shots.ts` + scenarios + contact sheet + `--diff`; `procs`, `probe`, `ui:check`, `local`, `check` lanes; `deploy.yml` with the hub-suite gate (§6.6) | 4 | `npm run shots:hub` produces a full sheet for the stub game; a deploy runs the gate on the runner |
| **P5, docs** | §9 in full: getting-started, kit docs (incl. saved, turns, avatar, world), testing, screenshots, CLAUDE.md rewrite, repo-setup split | 2 | an agent can make a toy game from the docs alone (dry run in a fresh session) |
| **N1–N3, new games + iteration** | §10: three new games, a retro after each, template improvements and a kit minor version after each | 5–10 per game, plus 1–2 of template work after each | each game faster than the last; the retro's gaps closed in the template |
| **H, hub turn-ons** (as the hub ships) | saved-games 0–1 → `kit/saved` + days in progress; saved-games 3–4 → `kit/turns` + alerts; avatars 0–2, 4 → `kit/avatar` live; world W2/W3/W4 → tables, People panel, room files | ½–2 per hub phase | the skipped tests for that phase run and pass |

**Total for the template:**
- P0 to P5, P3b included: about 28 agent-days, or 4 weeks with parallel agents.
- Each new game: then 1 to 2 weeks, including its template retro.

**Risks:**
- **FakeHub drift.** The mitigations are the contract test and the parity
  suite.
- **`defineGame` too rigid for odd games.** Every hook is optional, and the
  modules work without `boot`. New games surface this quickly through their
  retros.
- **Planned hub APIs change shape before they ship.** Planned-hub adapters stay
  thin and type-shimmed, and the turn-on phase rewrites them against the
  published types.
- **The hub's in-flight work.** Phase 12 (the move to the root), saved-games,
  avatars and world change paths and APIs. The kit is written against the root
  layout and package names.
- **Learning from too few games.** The spread in §10.1 covers each module
  at least once, and the migration doc remains the larger test later.

---

## 12. Decisions and open questions

### 12.1 Decisions (the user, 2026-10-15)

These override any earlier text in this file that disagrees. "Recommended"
means the user accepted the recommendation this plan made.

| # | Question | Decision |
|---|---|---|
| 1 | npm package or copied files? | **Copy files; no npm package.** `kit.json`, `kit:sync`, `kit:check` (§8.3). |
| 2 | FakeHub location | **Recommended:** it lives in the template (`src/kit/testing/`). Offering it to the hub as `@diffenderfer-games/hub/testing` stays a later option (§6.2). |
| 3 | `defineGame` required? | **Recommended:** required for new games; the modules still work alone for special cases. |
| 4 | Strict TypeScript | **Strict everywhere:** `strict: true` for kit, game, tests and scripts. |
| 5 | Single-file games | **No porting for now.** Recorded in the migration doc. |
| 6 | Audio and AudioWorklet | **Music and audio must work over plain http** (a LAN IP or an http dev server, not only localhost). The default host is the Web Worker synth feeding buffers, with a main-thread or ScriptProcessor fallback. AudioWorklet is used **only when `isSecureContext` is true** (§4.12). |
| 7 | Do the browser hub suites gate deploys? | **Yes** (§6.6). |
| 8 | Hub suites: `.ts` or `.mjs`? | **`.ts`** (§6.3). |
| 9 | ESLint and Prettier | **New games only** (§8.5). No reformatting of existing games. |
| 10 | Localization | **Recommended:** no i18n; the kit keeps a strings table (§4.21). |
| 11 | "The kit does this" pointers in the hub docs | **Recommended:** a later hub-repo change may add short pointers in `hub.md` and `multiplayer.md` (§9.2). |
| 12 | CLAUDE.md | **Not synced.** The template's CLAUDE.md stays its own short file and points at the synced docs (`HANDOFF.md`, `hub.md`, `multiplayer.md`) and the kit docs (§9.3). |
| 13 | Card-game kit | **No card-game kit now** (§4.19 is deferred). |
| 14 | One difficulty vocabulary | **Recommended:** `easy`/`normal`/`hard` for the kit's computer players. |
| 15 | Test-hook name | **Recommended:** `window.__game`. |
| 16 | Pilot games | **Dropped:** there is no migration now. The question moved to the migration doc. |

### 12.2 Open questions (new)

- **A. Which new games?** §10.1 suggests three or four shapes: an arcade or
  puzzle game with a daily and a race, a 3D game, an online card or board game,
  and optionally an own-server game. Which actual games should be built first?
- **B. Turn games before rooms for the online example?** The online card or
  board game (§10.1 #3) could wait for saved-games phase 3 and start on
  `kit/turns`, which matches decision 8 of that plan. Or it could start on
  rooms now and move later. Recommended: start on rooms if phase 3 is more
  than a few weeks out.
- **C. Avatars in the title demo.** Should the template's title screen show
  the avatar demo by default, as avatars.md §11 suggests, or only with
  `new-game --avatar`? Recommended: on by default, and easy to delete.

---

## Appendix A. Every common piece found

Survey date: 2026-10-14. Paths are relative to each repo. GD = geometrydungeon,
15P = The15Puzzle, SP = SpacePong. "≈" means near-duplicated; "≡" means
byte-identical (ignoring CRLF).

| # | Piece | Games that have it | Quality notes | Best source → kit module |
|---|---|---|---|---|
| 1 | Hub import + boot order (wiring before any `await`, async boot, no top-level await) | all TS games; single-file games poll `HubSDK` instead | Ordering varies: solitaire and baseball-typer register after awaits; clue documents the rule | sliderush `src/main.ts:88-183`, clue `src/main.ts:56-88` → `boot` |
| 2 | Launch queue + `routed()` guard + URL routing (`?daily`, `?race`, `?mp=lobby`, `hub_resume`) | sliderush, garbage, skipbo, phase10, uno, popfour, clue, bingo | 8 hand-rolled variants | skipbo `routed()`; 8ballpool `src/hub-online.ts` `wireLaunches` → `boot`, `online` |
| 3 | `hubReady` polling + `ensureGuest` | dumplings, huecrew, tetrablox, flux, quanta (5≈) | Obsolete with npm; iansaur's `import('/_hub/hub.js').catch(()=>null)` is the best runtime form | not extracted (single-file only) |
| 4 | Input `play` group + virtual controls | every game | GD changes the layout with width; quanta toggles groups only on change | GD `src/core/input.ts`, quanta `syncControls` → `input` |
| 5 | `autoNavigate` menu targets + back | bingo, uno, skipbo, phase10, clue, 8ballpool, dinodasher, weston, baseball-typer, 15P, SP, quanta, tetrablox, flux, huecrew | Selector vs function forms; bingo's function is the most general | bingo `src/main.ts:133` + uno/phase10 back → `input` |
| 6 | Declarative `navigable` menu group | garbage, solitaire (≈), dumplings | Modal focus trap | garbage `src/main.ts:~1159` → `input` (option) |
| 7 | Hand-rolled pad navigation | bubblepop, helixdrop, sliderush | Duplicates `autoNavigate` | retire (sliderush per-pad local MP excepted) |
| 8 | Control hints (keys/touch/pad) | weston | Reusable as-is | weston `src/ui/controlHints.ts` → `input` |
| 9 | HUD insets + menu-button room | quanta | Only game doing it; others overlap the menu on phones | quanta `syncControlInsets`/`syncMenuRoom` → `input`, `layout` |
| 10 | Focus-ring CSS | solitaire≡garbage `juice.css`, sliderush, phase10, uno, quanta | Each writes its own | sliderush (`--hub-focus-*`) → `ui` |
| 11 | `autoPause` + pause screen | 20 games; **missing in** solitaire, arrow-escape, baseball-typer, 15P, SP, bubblepop, GD, downfall | `pausedByHub` (skipbo) and race-aware pause (bubblepop/baseball-typer/arrow-escape) are each in one place | skipbo `src/main.ts:116-120` + dinodasher `boot.ts:90` + bubblepop race pause → `pause` |
| 12 | Hide the hub menu during play | bfme | Generic | bfme `src/ui/hubMenu.ts` → `pause` |
| 13 | Profile load/merge + boot gate | every game | 5+ guard designs; missing in helixdrop; push-before-read in downfall and GD; popfour has no gate | 8ballpool `src/stats.ts` + dinodasher `src/game/profile.ts` + weston `src/game/progress.ts` + uno → `save` |
| 14 | Account switch / `hub:auth` / owner tag | skipbo, bingo, SpaceClicker, baseball-typer, weston, tetrablox, dumplings | SpaceClicker cancels the pending push and checks the uid at every step | SpaceClicker + bingo `PREFS_OWNER_KEY` → `save` |
| 15 | `hub:reset` wipes local storage | tetrablox, dumplings | Most games ignore it | tetrablox → `save` |
| 16 | Settings store (device-local) | bfme, bubblepop, clue, downfall, GD | bfme's is typed + versioned | bfme `src/game/settings.ts` → `save` |
| 17 | Resume save/load/clear + legacy-slot migration | phase10, uno, skipbo, clue, 8ballpool, solitaire, garbage, arrow-escape, 15P, bubblepop, downfall, GD, weston, flux, quanta, tetrablox, iansaur, SpaceClicker, bfme | Late-load guard only in solitaire (`offerLateRun`), phase10, garbage, tetrablox | solitaire + 8ballpool `src/resume.ts` + GD `src/game/resume.ts` → `resume` |
| 18 | Daily define/complete/cancel + `?daily=` + `hub:daily-error` fallback | ~20 games | cancel is missed on some exit paths; offline fallback in garbage, sliderush, weston, bubblepop, helixdrop; local vs UTC day disagrees (baseball-typer, solitaire local) | weston + popfour `src/main.ts:685-874` + GD isolation → `daily` |
| 19 | Daily-puzzle kit | dg-template, garbage (≡) | Model kit: byte-identical rule, tests | dg-template `src/kit/daily-puzzle/` → `daily-puzzle` |
| 20 | Daily isolated from normal progress | GD, weston (correct); **broken in** dinodasher, helixdrop, bubblepop | | GD `main.ts:1015,1126` → `daily` + `save` guard 8 |
| 21 | Race define/create/status/finish | solitaire, arrow-escape, baseball-typer, sliderush, 15P, bubblepop, GD, weston, tetrablox, quanta | Status throttling only in GD; reload restore in arrow-escape and solitaire | GD `src/game/race.ts` + arrow-escape `src/main.ts:782-890` → `race` |
| 22 | Race-bar offset (`--hub-race-hud-top`, `hub:race-hud`) | solitaire, sliderush, arrow-escape, baseball-typer, quanta, tetrablox | 6 copies | solitaire `raceBarBottom` → `race`, `layout` |
| 23 | Leave-race confirm instead of pause | baseball-typer, sliderush, arrow-escape, bubblepop | | arrow-escape `guardRace` → `pause`, `race` |
| 24 | Launch handling (host/guest/join/watch/link/rejoin) | phase10, uno, skipbo, clue, popfour, garbage, bingo, 8ballpool, bfme | | 8ballpool `LaunchHandlers` + garbage `handleLaunch` → `online` |
| 25 | Successor + host backup + freshest | uno `src/wire.ts` (tested), phase10, clue, skipbo, garbage | 5 ≈ copies of `successorOf` | uno `src/wire.ts` → `online` |
| 26 | Computer takes a dropped seat / returns it | phase10, uno (`Match.setCtl`), skipbo, clue, garbage, bfme relay, 8ballpool server, SP server | | uno/phase10 `Match` + skipbo `computerSeats` → `online`, `cards` |
| 27 | Room work queue + reclaim timeout | skipbo | Fixes boot-time hangs | skipbo `roomTask` → `core`, `online` |
| 28 | Wire message validation | phase10 `net.ts`, uno `wire.ts`, skipbo `online.ts` | | skipbo (`WIRE_VERSION`) → `online` |
| 29 | Chat panel (delivered text, rejected hint, quick chips, chatMode) | phase10 `src/chat.ts`, clue `src/online/chat.ts`, uno, popfour, garbage | Same design twice as a module | phase10 `chat.ts` → `online` |
| 30 | Invite links | phase10 (+ `tests/hub/links.test.mjs` in phase10, uno, skipbo) | | phase10 → `online` |
| 31 | Presence/busy/quiet per screen | garbage, sliderush, bfme, uno… | | garbage `show()` → `ui.Screens` + `online` |
| 32 | Own-server skeleton (static, SPA, healthz, /ws, PORT) | bingo, 8ballpool (≈), bfme, SP, 15P | Only bingo verifies hub tickets | bingo `server/server.ts` → `server` |
| 33 | Seat grace on own server | SP `gameManager.js`, 8ballpool, bfme `relay.mjs` | | SP → `server` `SeatTable` |
| 34 | Leaderboard/stat wrappers + mode suppression | 8ballpool `stats.ts`, clue `recordSolo`, arrow-escape, bubblepop/helixdrop `flushStats` | Mostly inline | 8ballpool `src/stats.ts` → `scores` |
| 35 | mulberry32 / hashSeed / shuffle | ≥ 16 copies: bingo≡popfour, bubblepop≡helixdrop, solitaire≡garbage, sliderush, baseball-typer, 15P, arrow-escape, uno, clue, skipbo, phase10, dinodasher, weston, 8ballpool (2), 5 single-file games | Saveable-state variants in clue/skipbo/phase10/GD | template `daily-puzzle/rng.ts` + weston `fork` + GD `snapshot` → `rng` |
| 36 | Fixed-timestep loop | GD `core/loop.ts`, weston, downfall | GD's is generic | GD `FixedLoop` → `loop` |
| 37 | Worker music stream (PCM chunks) | dinodasher, helixdrop, sliderush, bingo, popfour | dinodasher has stems + telemetry + fallback | dinodasher `src/audio/*` → `audio` |
| 38 | AudioWorklet music synth | bubblepop | Sample-accurate synth core; contradicts the Worker rule | bubblepop `src/music-synth.ts` (core contract) → `audio` |
| 39 | Main-thread music | arrow-escape, weston, GD, tetrablox, single-file games | Violates the audio rule | → move into a `MusicCore` |
| 40 | Audio engine (buses, unlock, visibility suspend, duck) | bingo, bubblepop, sliderush, bfme, baseball-typer, popfour | bfme has the most thorough unlock | bingo `src/audio/index.ts` + bfme `src/audio/music.ts:225,746-761` → `audio` |
| 41 | SFX primitives (`tone`, `noise`, `burst`) | solitaire≈garbage, phase10≡uno `sfx.ts`, tetrablox, 8ballpool, clue | | garbage `sfx.ts` → `audio` |
| 42 | Haptics | bubblepop≈helixdrop, bingo≡popfour | Only DOM id differs | bubblepop `src/haptics.ts` → `haptics` |
| 43 | Vibration diagnostic page | bubblepop `vibration-test.html` | | → `scripts/kit/vibration-test.html` |
| 44 | Resize/rotation handling | every game | tetrablox forces `renderer.resize` on rotation; GD double-rAF | tetrablox + GD → `layout` |
| 45 | Safe-area probe | bubblepop≈helixdrop, sliderush `safeTop` | | bubblepop → `layout` |
| 46 | Letterbox fixed aspect | iansaur `fit`, downfall `initApp` | | downfall `src/app.ts` → `layout` |
| 47 | HUD region callback | solitaire `Board({region})`, garbage `Table({region})` | | solitaire → `layout` |
| 48 | Text fit | bfme `src/ui/fit.ts` | | bfme → `layout` |
| 49 | `h()` DOM builder | clue `ui/dom.ts`, dinodasher `ui/dom.ts`, baseball-typer `ui/dom.ts` | | clue → `ui` |
| 50 | Screens manager | sliderush `showScreen`, garbage `show`, baseball-typer `Screens`, downfall `ScreenManager`, weston `UI`, 6 card games | | baseball-typer `src/ui/screens.ts` → `ui` |
| 51 | Modal / sheet | phase10≈uno, garbage, solitaire, dumplings | Locked modals in phase10 | phase10 `openModal` → `ui` |
| 52 | Toast | ~12 games | solitaire's has action buttons | solitaire `showToast` → `ui` |
| 53 | Buttons / segmented / toggle rows | garbage, sliderush | | garbage `button`/`seg`/`optRow` → `ui` |
| 54 | Juice (letters, stagger, banner, countUp, confetti, iris) | phase10≡uno, solitaire≡garbage, bubblepop≈helixdrop | Three lineages | phase10 `juice.ts` + bubblepop `ui.ts` → `ui` |
| 55 | Settings panel | garbage, sliderush, bfme | | garbage `showSettings` → `settings-ui` |
| 56 | Card texture atlas | phase10, uno, skipbo `cardart.ts` (≈) | | uno → `cards` |
| 57 | Match driver (local/remote/bot seats, deadlines) | phase10≈uno `Match`, garbage `Match`, sliderush `Match` | | uno → `cards` |
| 58 | Avatars | phase10≡uno `avatars.ts` | | → `cards` |
| 59 | AI difficulty enums | uno, popfour, clue, bingo, 8ballpool (5 vocabularies) | | → one `Level` (decision 14) |
| 60 | Solver in a worker | solitaire `solver.worker.ts`, popfour `ai.worker.ts` | | popfour → daily-puzzle docs (generate in a worker) |
| 61 | Seeded sim / soak | uno `tests/unit/simulate.ts`, garbage `scripts/sim.ts`, phase10, skipbo, clue, bingo, 8ballpool, bfme `simrun.ts` | uno checks invariants after every move | uno + garbage → `testing/sim` |
| 62 | Rules-test builders | uno `tests/unit/helpers.ts`, skipbo `tests/helpers.mjs` | | pattern in `docs/kit/testing.md` |
| 63 | `tests/hub/_kit.mjs` | phase10, uno, skipbo, bingo, clue, garbage (≈, 108–160 lines) | popfour still uses old `test/helpers` + puppeteer directly; 8ballpool has no hub tests | phase10 `_kit.mjs` → `tests/hub/_kit.ts` |
| 64 | Race test boilerplate | solitaire, arrow-escape, baseball-typer, sliderush, 15P, bubblepop, GD, weston, tetrablox, quanta | `press`/`startRace`/`raceState`/`waitLive` repeated | → `tests/hub/_kit.ts` + `race.test.ts` |
| 65 | Pause hub test | sliderush, garbage, quanta | Required by multiplayer.md §12 for everyone | sliderush `tests/hub/pause.test.mjs` → `pause.test.ts` |
| 66 | Window test hook | every game, a different name each (`__p10`, `__uno`, `__sr`, `__bp`, `__GD_TEST__`, `__WESTON__`…) | phase10's is typed; weston and GD gate on `__HUB_TEST__` | phase10 `P10Hook` → `test-hook` |
| 67 | Screenshot scripts | template `shots.mjs`/`shots-hub.mjs`; customized in phase10, uno, skipbo, bingo, clue, sliderush, garbage; bubblepop/helixdrop borrow puppeteer from dinodasher (fragile) | template's is the best runner; bfme's has `__ready` + VISUALS.md | template + bfme `scripts/shots.mjs` → `scripts/kit/shots.ts` |
| 68 | Contact sheets | bfme `ta-contact.mjs`, `art-sheet.mjs`, `model-sheet.mjs` | | bfme → `scripts/kit/sheet.ts` |
| 69 | Cover maker | 9 different scripts (puppeteer, pure-Node PNG, `?cover` 3D shot, vite page) | | → the `cover` scenario |
| 70 | Process cleanup | bfme `scripts/procs.mjs` | Very reusable | bfme → `scripts/kit/procs.ts` |
| 71 | Pre-push lanes | bfme `scripts/check-quick.mjs` | | bfme → `scripts/kit/check.ts` |
| 72 | Prod smoke (run `start` as the catalog does) | bfme `scripts/smoke-prod.mjs` | | bfme → `tests/hub/server.test.ts` + `scripts/kit/smoke.ts` |
| 73 | UI survey (clipped text, tiny controls, overflow) | bfme `ui-survey.mjs`, `textfit.mjs`, `mobile-check.mjs` | | bfme → `ui:check` |
| 74 | Probe | bfme `scripts/probe.mjs` | | → `scripts/kit/probe.ts` |
| 75 | Perf probes | dinodasher `perf.mjs`, baseball-typer `perfprobe.mjs`, bfme `perf/*` | Game-specific mostly | dinodasher `perf.mjs` (fps + `renderer.info`) → later `scripts/kit/perf.ts` |
| 76 | `sync-docs.mjs` | ≡ in 10+ repos | | template → `scripts/kit/sync-docs.ts` |
| 77 | `sync-hub-server` script | skipbo, bingo, popfour, sliderush, helixdrop, template | Path broken until hub phase 12; skipbo/popfour don't need it | → `scripts/kit/sync-hub-server.ts` (own-server only) |
| 78 | `hub-doctor` script | all TS games | | keep |
| 79 | `vite.config.ts` | ≡ in solitaire, garbage, sliderush, phase10, uno, skipbo, clue, popfour, bubblepop, weston, template; +`/ws` proxy in bingo/8ballpool; +chunk limit in 3D games | | template + options → KIT-ish (GAME file with documented options) |
| 80 | `tsconfig.json` | template adds `allowImportingTsExtensions`; strict in phase10, uno, skipbo, baseball-typer | | template + strict |
| 81 | `deploy.yml` | 22 distinct versions; template's (≡ 8 repos) is current | Older ones have `ubuntu-latest` paths, hardcoded slugs | template → KIT |
| 82 | CLAUDE.md skeleton | every game, all differ; single-file games share a boilerplate | Per-game sections appended | → short KIT brief + `docs/game.md` |
| 83 | `docs/audio.md` | ≡ template, garbage, sliderush, helixdrop | | → `docs/kit/audio.md` |
| 84 | three.js Stage / quality / adaptive resolution | dinodasher, baseball-typer, helixdrop (simple) | dinodasher is the best; neither uses ResizeObserver | dinodasher `src/render/{stage,quality,adaptive}.ts` → three starter |
| 85 | Pixi app setup + procedural textures | every Pixi game | bubblepop `textures.ts`; GD pixi-filters bloom | template + bubblepop → Pixi starter |
| 86 | Loading/ready flag | dinodasher (`body.dataset.ready`), baseball-typer, bfme (`window.__ready`) | | dinodasher → `boot` |
| 87 | Theme-color keeper | helixdrop | | → `layout.keepThemeColor` |
| 88 | Dev tuning panel | downfall `devPanel.ts`, GD `core/settings.ts` | | later (`kit/dev-panel`) |

---

## Appendix B. Hub events and callbacks, with the kit handler and test for each

**Sources:** hub.md and multiplayer.md (current), plus saved-games.md (marked
*planned*). Every row is one or more `tests/hub-events/*.test.ts` cases,
driven by `FakeHub`, run against the stub game.

| # | Event / callback | Kit handler | Test file | Asserts |
|---|---|---|---|---|
| 1 | `overlay.autoPause` → `pause()` (open, any reason) | `pause` | `overlay.test.ts` | game paused once; `why='hub'`; play group disabled by the hub |
| 2 | `overlay.autoPause` → `resume()` (close, `resumeOnClose`) | `pause` | `overlay.test.ts` | resumes only if the hub paused; player pause kept |
| 3 | Nested overlay opens (menu → chat → close → close) | `pause` | `overlay.test.ts` | one pause, one resume |
| 4 | Register while overlay already open | `pause` | `overlay.test.ts` | pauses immediately |
| 5 | `canPause=false` (after `mp.setBusy(true)`, in a race) | `pause` | `overlay.test.ts` | no pause; no pause screen |
| 6 | `hub:overlay-open`/`close` window events, reasons `menu`, `chat`, `dialog`, `keyboard`, `invite`, `notify` | `pause` | `overlay.test.ts` | each reason handled the same; keyboard reason doesn't show the pause screen for text input |
| 7 | Intro (overlay reason `menu` at load) | `pause`, `boot` | `intro.test.ts` | the boot doesn't start play under the intro; no double pause |
| 8 | `hub:menu-visibility` | `pause` | `menu.test.ts` | the kit's own hide/show keeps in sync; shown on the pause screen |
| 9 | `input.on('sourcechange')` | `input` | `input.test.ts` | hints switch; virtual default follows touch |
| 10 | `input` navigable `focus`/`blur`/`act` | `input` | `input.test.ts` | back respects locked modals; act clicks |
| 11 | `hub:auth` (login/logout) | `save` | `auth.test.ts` | pending push cancelled; re-read; no cross-account leak; uid check on each async step |
| 12 | Login merge (page reload) | `save` | `auth.test.ts` | the fresh boot reads the merged save; never pushes stale local state over it |
| 13 | `hub:reset {slug}` | `save`, `resume` | `reset.test.ts` | local keys wiped before reload; run cleared |
| 14 | `getSave` → `save_unknown` (offline, never seen) | `save` | `offline.test.ts` | state `unknown`; no push until a successful read |
| 15 | `hub:online` / `hub:offline` / `onStatus` | `save`, `ui` | `offline.test.ts` | the retried read runs on `online`; the offline title shows |
| 16 | `hub:sync {conflicts}` with `save_conflict` | `save` | `offline.test.ts` | re-read + merge + push; no data lost |
| 17 | `offline.on('queued'/'replayed'/'failed')` | `save`, `scores` | `offline.test.ts` | a toast for failed replays only |
| 18 | `resume.requested` (`?hub_resume=1`) | `boot`, `resume` | `resume.test.ts` | routes to Continue; restore called with the loaded run |
| 19 | `resume.blockedBy` = `race` / `room` (/ `daily` today) | `resume` | `resume.test.ts` | `save` returns false; nothing queued |
| 20 | `resume.load` late (after New Game) | `resume` | `resume.test.ts` | `beforeNewGame` waits ≤ 8 s; `offerLate` toast if it arrives later |
| 21 | `visibilitychange` hidden / `pagehide` | `resume`, `save`, `pause`, `audio` | `visibility.test.ts` | flush, pause, audio suspended; resume on visible |
| 22 | `daily.define().play(challenge)` before mount | `daily` | `daily.test.ts` | queued then started once |
| 23 | `daily.play` during a normal game | `daily` | `daily.test.ts` | the normal game is saved to Continue first, then the daily starts |
| 24 | `hub:daily-started` / `hub:daily-complete` / `hub:daily-queued` | `daily` | `daily.test.ts` | complete sent once with `meta`; queued shows "saved, will sync" |
| 25 | `hub:daily-error` | `daily` | `daily.test.ts` | offline path: play unrecorded (or toast) per spec |
| 26 | Every daily exit path (title, new game, launch, race start, room) | `daily` | `daily.test.ts` | `cancel()` called; resume saves work again |
| 27 | Daily isolation | `daily`, `save`, `scores`, `resume` | `daily.test.ts` | no profile write, no board, no normal resume during a daily (dinodasher/helixdrop/bubblepop regressions) |
| 28 | *planned* `challenge.saved` / `hub:daily-resumed` | `daily`, `saved` | `daily.test.ts` (skipped until the hub ships) | restore from saved; `daily.save` mid-day; `leave` = pause; `discard` |
| 29 | `race.define().start(r)` (normal / `resumed` / spectator) | `race` | `race.test.ts` | build from seed+params only; restore stash on `resumed`; spectators get nothing |
| 30 | `race` `startAt` countdown | `race` | `race.test.ts` | input locked until `startAt` |
| 31 | `race.define().end(result)` / `exit()` | `race` | `race.test.ts` | input locked; back to title; no stats, no boards |
| 32 | `race.on('status'/'start'/'result'/'room'/'closed')` | `race` | `race.test.ts` | status throttled ≤ 4/s; closed → title |
| 33 | `hub:race-hud` | `race`, `layout` | `race.test.ts` | `barTop()` + layout region update |
| 34 | `mp.onLaunch` kind `host` | `online` | `launch.test.ts` | registered sync before any await; lobby created once |
| 35 | `mp.onLaunch` kind `guest` | `online` | `launch.test.ts` | joins the host's room |
| 36 | `mp.onLaunch` kind `join` (+ `via:'link'`, `via:'rejoin'`) | `online` | `launch.test.ts` | link token stripped; rejoin restores the seat |
| 37 | `mp.onLaunch` kind `watch` (+ `via:'link'`) | `online` | `launch.test.ts` | spectator view; no input |
| 38 | `mp.onLaunch` with `tournament` | `online` | `launch.test.ts` | winnerId reported; no rematch |
| 39 | `mp.onLaunch` with `mode:'race'` | `race` | `launch.test.ts` | routed to the race path, not the room path |
| 40 | Duplicate / late launch (idempotency; arrives before mount) | `online`, `boot` | `launch.test.ts` | queued; handled once; `routed()` blocks the title |
| 41 | `mp.onJoinInfo` | `online` | `launch.test.ts` | party info applied |
| 42 | `room` event (info change; host migration) | `online` | `room.test.ts` | `isHost` re-checked; the new host loads the freshest backup |
| 43 | `state` / `msg` | `online` | `room.test.ts` | invalid messages dropped (wire validation); view rendered |
| 44 | `seat {status:'away'}` / `'gone'` / `'back'` | `online` | `seats.test.ts` | computer takes the seat; returns it without a reset; never ends with a human left |
| 45 | `abandoned` | `online` | `seats.test.ts` | the last human keeps playing vs computers |
| 46 | `kicked` | `online` | `room.test.ts` | title + message |
| 47 | `ended {results}` | `online`, `scores` | `room.test.ts` | handled once; online boards only |
| 48 | `closed` (`empty`, `ended`, `other_tab`, `moved`, `removed`, `gone`) | `online` | `room.test.ts` | each reason → the right text |
| 49 | `chat` (delivered; softened ✨; `ContentRejectedError`) | `online` chat | `chat.test.ts` | renders delivered text via `textContent`; draft kept + hint + `retryAfterMs` countdown |
| 50 | `social.chatMode` → on / quick / off | `online` chat | `chat.test.ts` | text box / chips / hidden |
| 51 | Room errors (`room_not_found`, `room_full`, `in_progress`, `banned`, `suspended`, `OfflineError`) | `online` | `room.test.ts` | friendly text; back to a safe screen |
| 52 | `social.on('invite'/'party'/'friends'/'presence'/'counts'/'tournament')` | `online` | `social.test.ts` | lobby badges update; nothing paused by these alone |
| 53 | Presence by screen | `ui.Screens`, `online` | `presence.test.ts` | `presence.set` per screen, coalesced; `setBusy` during a live match; `setQuiet` during intense play |
| 54 | `hub:rt-ready` / `hub:rt-failed` | `online`, `boot` | `runtime.test.ts` | online buttons disabled until ready; offline message on failure |
| 55 | `hub:changes-seen`, `hub:prefetch`, `hub:play-online-changed`, `hub:account` | none (pass-through) | `passthrough.test.ts` | the kit doesn't crash or re-route on them |
| 56 | *planned* `hub.saved.opened` / `onOpen` / `on('change')` | `saved` | `saved.test.ts` (skipped until the hub ships) | route by kind; switch without reload; Continue list refresh |
| 57 | *planned* `TurnGame.on('move'/'turn'/'ended')`, `history` | `turns` | `turns.test.ts` (skipped until the hub ships) | animate replayed moves; your-turn UI; ended once |
| 58 | *planned* `launch.table` on a `host`/`guest` launch (world W2) | `online` | `launch.test.ts` (skipped until W2) | options reach `host.start`; mode from the table; "That table didn't start" path |
| 59 | *planned* `join` launch into a turn instance from a table | `turns` | `launch.test.ts` (skipped until W2 + saved-games 3) | opens the turn game, no host step |
| 60 | *planned* `hub.social.on('reaction')` (world W3) | `online` | `social.test.ts` (skipped until W3) | `onReaction` hook called; nothing when quiet |
| 61 | *planned* `hub.mp.setRoster` calls (own-server, world W3) | `server` client | `roster.test.ts` (skipped until W3) | one call per roster change |
| 62 | *planned* `hub.avatar.on('change')` (avatars phase 0) | `avatar` | `avatar.test.ts` (skipped until the hub ships) | badges and the title bust re-render; no reload |
| 63 | *planned* `hub.mp.quickMatch` state (world W2) | `online` | `launch.test.ts` (skipped until W2) | the button shows only with `multiplayer.quickMatch`; the table launch routes like an invite |
