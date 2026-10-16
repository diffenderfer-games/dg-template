# The kit

KIT doc. The kit is the shared code in `src/kit/`, `scripts/kit/`, the kit's
tests and these docs. Every game has a byte-identical copy, listed with hashes
in `kit.json`. Games never import it from npm: it is copied (decision 1 of the
plan), so a game builds alone and an agent can read every line.

## Three kinds of file

| Kind | Where | Who changes it |
|---|---|---|
| **KIT** | `src/kit/`, `scripts/kit/`, `tests/kit/`, `tests/hub-events/`, `tests/hub/_kit.ts`, `tests/hub/kit/`, `tests/scripts/`, `docs/kit/`, `docs/getting-started.md`, `docs/repo-setup.md`, configs (`eslint.config.ts`, `vitest.config.ts`, `tsconfig.base.json`, Prettier, `.gitattributes`), the deploy workflow | The template only. In a game, `npm run kit:check` fails if one differs. |
| **GAME** | `src/game/`, `tests/game/`, `tests/kit-skips.json`, `scripts/shots.config.ts`, `scripts/sim.ts`, `docs/game.md`, `README.md`, `CLAUDE.md`, `index.html`, `package.json` | The game. Files carry `(GAME: yours to edit.)` in their header. |
| **SYNCED** | `HANDOFF.md`, `docs/hub.md`, `docs/multiplayer.md`, `server/hub-server.mjs` | The hub. `npm run sync-docs` / `npm run sync-hub-server` copy them; never edit. |

A game that needs different kit behaviour writes it in `src/game/` (a hook, or
a wrapper) instead of editing `src/kit/`. If the kit should change for
everyone, change the template first.

**Kit tests that don't apply** to a game are never deleted or edited: suites for
features the game doesn't declare skip on their own, and any other kit test that
doesn't fit is listed with its reason in `tests/kit-skips.json` (GAME), which every
runner honours: [testing.md](testing.md#kit-tests-that-dont-apply). The kit's tests
need only a short test contract from the game:
[testing.md](testing.md#what-the-kits-tests-need-from-your-game).

## Modules

| Module | Does | Doc |
|---|---|---|
| core | JSON types, the activity model, strings, logging, the hub's narrow types | [core.md](core.md) |
| testing | FakeHub, fake clock/storage, the hub-phase list, the sim | [testing.md](testing.md) |
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
| saved | "Your games": the title's Continue rows, days in progress | [saved.md](saved.md) |
| turns | Online games: the hub runs the game's rules; the kit's screen | [turns.md](turns.md) |
| avatar | Players' faces, the title bust, the canvas adapters | [avatar.md](avatar.md) |
| world | The game's own room in the hub's world (`game.world`, `dg-world`), in Adventure Mode at `/world/game.<slug>`; tables and Quick match coming | [world.md](world.md) |

Also: [look.md](look.md) (what every game's UI and motion must be),
[hooks.md](hooks.md) (every hook), [screenshots.md](screenshots.md),
[whats-new.md](whats-new.md), [CHANGELOG.md](CHANGELOG.md).

## Hub phases

The kit is written against the pinned hub client (`@diffenderfer-games/hub`
2.0.0-next.10, with `@diffenderfer-games/world` at the same version). Saved
games and avatars (next.6), online games on the server with who is there,
moves out of turn, the game's own quick-chat, guests and the your-turn buzz
(next.8, [turns.md](turns.md)), and the world with a game's own room
(next.9, [world.md](world.md)), and Adventure Mode, where players walk it
(next.10: `/world`, walk to a friend, typed bubbles between friends), are
live and on. Game tables in the world and
in-game presence (world W2, W3) are **coming**: kit/world checks for their
API at runtime and stays off, and their tests are written and **skipped,
naming the phase** they wait on (`src/kit/testing/phases.ts`). When the hub
ships a phase, flip it in `HUB_PHASES` and the tests run.

## The hub menu button

The hub draws its menu button in one corner (`game.menuPosition`, default
`top-left`; the template uses `top-right`), and players can move it. Keep a
**64px square** in that corner, inside the safe area, clear of your own UI:
the kit's own UI does (its pause button sits top-left, so keep the menu on the
right, as the template does). A game with its own top bar tells the hub how tall it is with
`hub.input.setInsets({ top })` (kit/input `setHudInsets` does it for HUD
bands), so the hub's toasts sit below the bar instead of over it, and touch
controls stay off it. See [layout.md](layout.md#the-hub-menu-button) and
hub.md [Where the menu sits](../hub.md#where-the-menu-sits).

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
`DG_HOST` is not set on the runner today, so CI skips the hub suites with a
warning: run `npm run test:hub` locally before a push that changes hub behaviour.

## Scripts

Every `npm run` script is a small file in `scripts/kit/` (KIT) with its usage
in its header comment; shared helpers are in `scripts/kit/lib/` (paths, ports,
the browser, serving `dist/`, process tracking, `kit.json`). The GAME scripts
are `scripts/shots.config.ts` (your screenshot scenarios) and `scripts/sim.ts`.

A procedure longer than one command is a script, not a list of commands to
paste: `npm run create` (a new game's folder, in the template), `npm run new-game`,
`npm run first-deploy` (the repo, its secrets, the first push), `npm run test:hub`.
