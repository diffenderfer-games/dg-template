# Plan: moving existing games onto the dg-template kit (future)

Status: **a future endeavour, not scheduled.** The user decided on 2026-10-15
that existing games are not migrated now. The kit is built first, then used to
make a few new games, and the template improves from that experience
([template-kit.md](template-kit.md) §10). This file keeps the migration
thinking from the first draft of that plan, so it isn't lost. Revisit it once
the kit has been used by a few new games and has settled. Re-check every
finding here against the games' code at that time: they change quickly.

Related: [template-kit.md](template-kit.md) (the kit itself; its Appendix A is
the survey of all 28 games and the best source for each piece).

---

## 1. What migration would cover

- **Adoption waves and pilots** (§2.2). The first draft suggested sliderush,
  phase10 and dinodasher as pilots. Whether those are the right three, and
  whether the games by other authors (helixdrop and SpacePong by Mason, bingo
  by Nicole) need their authors' OK first, are open questions for when this
  starts.
- **Per-game effort:** about half a day to 2 days per game, roughly 20
  agent-days for the TS games, which can run in parallel with one agent per
  game.
- **Rolling out `kit:sync` to existing games:** the first run is
  `kit:sync --init`. It writes `kit.json`, adds the scripts and
  `vitest.config.ts`, and turns on `allowImportingTsExtensions`. Then one
  module per commit (§2.1).
- **Old unit-test runners:** migrated games keep their existing tests running
  through a `test:legacy` script until they are ported to vitest.
- **Old `deploy.yml` variants:** move the older variants to the KIT workflow:
  - bingo, clue and garbage (the `CI_ON` switch, with GitHub-hosted paths);
  - 8ballpool (the oldest);
  - bubblepop and dinodasher (a selectable runner);
  - downfall, geometrydungeon and weston (the slug is hardcoded);
  - solitaire, arrow-escape and baseball-typer (the older check-plus-deploy
    form).
- **Strict TypeScript and lint:** migrated games get `strict` folder by
  folder. ESLint and Prettier stay for new games only (template-kit.md decision 9), unless
  this plan is revisited.
- **The test-hook rename:** move to `window.__game`, keeping the old name
  (`__p10`, `__uno`, `__sr`, …) as an alias for one release.
- **Moving the card games' online play onto turn games** (saved-games.md §11
  decision 8: Pop Four, Phase 10, Skip-Bo and Garbage) is hub-plan work. It
  would use `kit/turns` once that exists.
- **Single-file games** (dumplings, flux, huecrew, quanta, SpaceClicker,
  tetrablox, iansaur): **no porting for now** (template-kit.md decision 5).

---

## 2. How existing games would adopt the kit

### 2.1 Rules

- **One module at a time**, each in its own commit. Run `npm run check`,
  `npm run test:hub` and `npm run shots:hub` after each, and compare the
  contact sheet against the run before.
- **Leaf modules first.** These change no behaviour: `rng`, `haptics`,
  `test-hook` (keep the old name as an alias), `ui/juice`, `layout`.
  **Then the guard modules,** which fix real bugs: `save`, `resume`, `daily`,
  `pause`. **Then the features:** `race`, `online`, `audio`. **`boot` comes
  last:** moving to `defineGame` is the step where the game's `main.ts`
  shrinks to hooks.
- **Keep the old seeds.** `kit/rng` golden tests match today's mulberry32
  outputs, so a game's levels and dailies stay the same. GD's xorshift and
  downfall's LCG stay local to those games until a new generator version is
  pinned (daily-puzzle `versionFor`).
- **Keep the old saves.** Each game's `state.ts` `migrate()` reads the
  current save shape, and every migration gets a test that runs it on a real
  save from the game's `tests/fixtures/`.
- Follow the batch rule from the user's memory: local commits, test on a
  local hub, push in order (dg first, then the games, bfme last), and notify.

### 2.2 Which games go first

| Wave | Games | Why |
|---|---|---|
| **1, pilots** | **sliderush** (Pixi, race, daily, worker music, a pause test, small `main.ts`), **phase10** (online rooms, the best test kit, the next turn-game candidate per saved-games §11 decision 8), **dinodasher** (three.js, best audio, and its daily-writes-progress bug gets fixed by `kit/daily`) | Together they cover all three starters' paths and every major module |
| **2, the same families** | uno, skipbo, garbage, clue (rooms family, near-identical code to phase10); helixdrop, bubblepop (siblings of dinodasher/sliderush; fix helixdrop's save guard, bubblepop's missing autoPause) | Mostly mechanical once the pilots land |
| **3, the rest of the TS games** | solitaire, arrow-escape, baseball-typer, weston, GD, popfour (also off `next.3`), bingo + 8ballpool (own-server → `kit/server`), downfall (Pixi 7: adopt the non-render modules only, until a Pixi 8 port) | More game-specific code; several have the autoPause gap |
| **4, special cases** | bfme (huge; adopt `rng`, `test-hook`, `save` guards and the scripts it donated, keep its own boot and net), The15Puzzle (React + own server; `rng`, `race`, `resume`, test kit), SpacePong (plain JS + socket.io; tests and scripts only) | Partial adoption by design |
| **5, single-file games** | dumplings, flux, huecrew, quanta, SpaceClicker, tetrablox, iansaur | Need a build step first; not ported for now (template-kit.md decision 5). Either a Vite port (tetrablox and quanta are the best candidates and donate patterns), or a pre-bundled `kit.js` they can `<script type=module>` (rejected for now: two distribution paths) |

The order follows the saved-games work queue (§11 of that plan): a game whose
hardening or daily-puzzle work is in flight adopts the kit after that work
lands.

### 2.3 The per-game adoption checklist

1. `npm run kit:sync` (first time: `--init`, which writes `kit.json`, adds
   the scripts and `vitest.config.ts`, and turns on `allowImportingTsExtensions`).
2. Move the per-game CLAUDE.md sections to `docs/game.md`, and re-copy
   CLAUDE.md.
3. For each module, in the order of §2.1:
   - replace the game's copy with a kit call;
   - delete the old code;
   - run `check`;
   - commit.
4. Rename the test hook to `window.__game`, keeping the old alias, and move
   the game's `tests/hub/_kit.mjs` helpers onto `tests/hub/_kit.ts`.
5. Turn on the standard hub suites for the game's features, and delete the
   duplicates.
6. Replace the game's screenshot and cover scripts with `shots.config.ts`.
7. Move to the KIT `deploy.yml`.
8. Fix the gaps in §3. The kit modules fix most of them
   automatically.

### 2.4 Single-file games

These games load the hub at runtime (`/_hub/hub.js`, `window.HubSDK.hub`) and
hand-roll `hubReady` polling (5 copies). They can't import TS modules without
a build. **They are not ported for now** (template-kit.md decision 5, 2026-10-15).

Their patterns still feed the kit:
- quanta: input, insets, menu room;
- tetrablox: resume, race, rotation;
- dumplings and SpaceClicker: the save guards.

---

## 3. Compliance gaps the survey found (2026-10-14)

These are not fixed by the kit plan, which changes no existing game. Each one
is fixed when the game adopts the matching kit module, or sooner as its own
task if the user wants. All were seen on 2026-10-14 and are worth re-checking
before acting.

| Gap | Games | Fixed by |
|---|---|---|
| No `hub.overlay.autoPause` (required for every game) | solitaire, arrow-escape, baseball-typer, The15Puzzle, SpacePong, bubblepop, geometrydungeon, downfall | `kit/pause` |
| No save-load guard (writes before the cloud read) | helixdrop | `kit/save` |
| Debounced cloud push can fire before the boot read | downfall, geometrydungeon, sliderush (`persist()` before the read), popfour | `kit/save` |
| Daily writes normal progress (bests, leaderboards, coins) | dinodasher (`finishRun`, `game.ts:628,637`), helixdrop (`highScore`, `best` board), bubblepop (`totalCoins`) | `kit/daily` + `kit/save` guard 8 |
| Music on the main thread | arrow-escape, weston, geometrydungeon (and the single-file games) | `kit/audio` `MusicCore` |
| AudioWorklet music (against the rule; works only via fallback on LAN http) | bubblepop | `kit/audio` hosts (Q6) |
| Hub client behind `next.5` | popfour, helixdrop (`next.3`), sliderush (`next.4`) | `npm i -E` + `hub-doctor` |
| `sync-hub-server` script points at a path that doesn't exist yet (`tools/` at the hub root) | skipbo, bingo, popfour, sliderush, helixdrop, dg-template | `scripts/kit/sync-hub-server.ts`; it resolves after the hub's phase 12 |
| Old `deploy.yml` with GitHub-hosted (`ubuntu-latest`) paths or hardcoded slugs | bingo, clue, garbage, 8ballpool, bubblepop, dinodasher, downfall, geometrydungeon, weston, solitaire, arrow-escape, baseball-typer | KIT `deploy.yml` |
| Old hub test helpers (`test/helpers/{server,client}.mjs` + raw puppeteer) | popfour | `tests/hub/_kit.ts` |
| No hub tests at all | 8ballpool, helixdrop, dinodasher, downfall | the standard suites |
| `HUB_IMPL` set in tests (gone after phase 12) | phase10 `_kit.mjs` | `tests/hub/_kit.ts` |
| Local vs UTC day disagreement in day helpers | baseball-typer, solitaire (local) vs sliderush/kit (UTC) | `kit/daily` (UTC) |
| Synced docs out of date (`hub.md` 4+ hashes; HANDOFF two versions) | most games | `npm run sync-docs` |

---
