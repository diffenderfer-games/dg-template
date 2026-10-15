# The kit

KIT doc. The kit is the shared code in `src/kit/`, `scripts/kit/`, the kit's
tests and these docs. Every game has a byte-identical copy, listed with hashes
in `kit.json`. Games never import it from npm: it is copied (decision 1 of the
plan), so a game builds alone and an agent can read every line.

## Three kinds of file

| Kind | Where | Who changes it |
|---|---|---|
| **KIT** | `src/kit/`, `scripts/kit/`, `tests/kit/`, `tests/hub-events/`, `tests/hub/_kit.ts`, `tests/hub/kit/`, `tests/scripts/`, `docs/kit/`, configs, the deploy workflow | The template only. In a game, `npm run kit:check` fails if one differs. |
| **GAME** | `src/game/`, `tests/game/`, `scripts/shots.config.ts`, `scripts/sim.ts`, `docs/game.md`, `CLAUDE.md`, `package.json` | The game. Files carry `(GAME: yours to edit.)` in their header. |
| **SYNCED** | `HANDOFF.md`, `docs/hub.md`, `docs/multiplayer.md`, `server/hub-server.mjs` | The hub. `npm run sync-docs` / `npm run sync-hub-server` copy them; never edit. |

A game that needs different kit behaviour writes it in `src/game/` (a hook, or
a wrapper) instead of editing `src/kit/`. If the kit should change for
everyone, change the template first.

## Modules

| Module | Does | Doc |
|---|---|---|
| core | JSON types, the activity model, strings, logging, the hub's narrow types | [core.md](core.md) |
| testing | FakeHub, fake clock/storage, the planned-phase list, the sim | [testing.md](testing.md) |
| rng | The seeded RNG every rule uses | [rng.md](rng.md) |
| daily-puzzle | A short, solver-checked daily | [daily-puzzle.md](daily-puzzle.md) |
| save | The profile: versioned, merged, offline-safe | [save.md](save.md) |
| resume | The game in progress: Continue, late-load guard | [resume.md](resume.md) |
| daily | The daily challenge flow (`hub.daily`) | [daily.md](daily.md) |
| pause | Pause on hub UI, the pause screen | [pause.md](pause.md) |
| scores | Boards and stats with the mode rules | [scores.md](scores.md) |
| test-hook | `window.__game` | [test-hook.md](test-hook.md) |
| boot | `defineGame`: wires everything | [boot.md](boot.md) |
| input | Controls, menu navigation, hints | [input.md](input.md) |
| layout | The safe region for gameplay | [layout.md](layout.md) |
| loop | Fixed-step loop | [loop.md](loop.md) |
| ui | Screens, modals, toasts | [ui.md](ui.md) |
| settings-ui | The settings sheet | [settings-ui.md](settings-ui.md) |
| race | Races (`hub.race`) | [race.md](race.md) |
| online | Hub rooms: lobby, match, chat | [online.md](online.md) |
| audio | Music in a worker, SFX | [audio.md](audio.md) |
| haptics | Vibration | [haptics.md](haptics.md) |
| server | Own-server games | [server.md](server.md) |
| saved | "Your games" (planned hub phase) | [saved.md](saved.md) |
| turns | Turn games with server rules (planned) | [turns.md](turns.md) |
| avatar | Faces (planned) | [avatar.md](avatar.md) |
| world | World tables (planned) | [world.md](world.md) |

Also: [hooks.md](hooks.md) (every hook), [screenshots.md](screenshots.md),
[whats-new.md](whats-new.md), [CHANGELOG.md](CHANGELOG.md).

## Planned hub phases

Some modules use hub APIs that aren't published yet. They check for the API
at runtime and fall back (or stay off). Their tests are written and **skipped,
naming the phase** they wait on (`src/kit/testing/phases.ts`). When the hub
ships a phase, flip it in `HUB_PHASES` and the tests run.

## Keeping up to date

```bash
npm run kit:sync                  # every module from ../dg-template (or DG_TEMPLATE)
npm run kit:sync -- save daily    # just these
npm run kit:sync -- --dry-run     # what would change
npm run sync-docs                 # the hub's docs from ../diffenderfer-games (or DG_HOST)
npm run sync-hub-server           # own-server games: server/hub-server.mjs
npm install --save-exact @diffenderfer-games/hub@<version>   # the hub client; then npm run hub-doctor
```

`kit:sync` prints the CHANGELOG entries since your kit version, refuses a
module you edited locally, copies, updates `kit.json` and runs `npm run check`.

## Changing the kit (template only)

1. Change the files in the template; keep tests beside them.
2. Bump the module's `version` (and `KIT_VERSION` for a major) in
   `scripts/kit/lib/modules.ts`; add a line to [CHANGELOG.md](CHANGELOG.md).
3. `npm run kit:hash`, `npm run check`, `npm run test:hub`.
4. Games pick it up with `npm run kit:sync`.

## CI

The deploy's `check` job is the gate: `npm run check`, then `npm run test:hub`
on the org's self-hosted runner. See [../repo-setup.md](../repo-setup.md#the-deploy-workflow).

## Scripts

Every `npm run` script is a small file in `scripts/kit/` (KIT) with its usage
in its header comment; shared helpers are in `scripts/kit/lib/` (paths, ports,
the browser, serving `dist/`, process tracking, `kit.json`). The GAME scripts
are `scripts/shots.config.ts` (your screenshot scenarios) and `scripts/sim.ts`.
