# Build a diffenderfer.games game

This repo is a game on the **dg kit**: TypeScript (strict), Vite, a PixiJS /
three.js / plain-HTML renderer, and `src/kit/`, which already does every hub
duty. Read [docs/getting-started.md](docs/getting-started.md), then
[docs/game.md](docs/game.md) (this game's own notes; keep them there, not here).

## Where things live

- **GAME** (yours): `src/game/`, `tests/game/`, `tests/kit-skips.json`,
  `scripts/shots.config.ts`, `scripts/sim.ts`, `docs/game.md`, `README.md`,
  `index.html`, `package.json`, this file.
- **KIT** (shared, byte-identical in every game): `src/kit/`, `scripts/kit/`,
  the kit's tests, `docs/kit/`, configs, the deploy workflow. **Never edit
  them here**: write the behaviour in `src/game/`, or change the template and
  `npm run kit:sync`. `npm run kit:check` fails on an edited kit file.
- **SYNCED** (the hub's): `HANDOFF.md`, `docs/hub.md`, `docs/multiplayer.md`,
  `server/hub-server.mjs`. Never edit; `npm run sync-docs` refreshes them.

Map of the kit: [docs/kit/README.md](docs/kit/README.md).

## The hard rules

- `base: './'` stays in `vite.config.ts` ([HANDOFF.md](HANDOFF.md) § Path-handling).
- Keep a 64px square clear in the hub menu button's corner (`game.menuPosition`), and give a top bar's height to `hub.input.setInsets({ top })` so the hub's toasts sit below it: [docs/kit/layout.md](docs/kit/layout.md#the-hub-menu-button).
- The hub client comes from npm, pinned exactly; `npm run hub-doctor` before pushing. Never vendor it.
- Never edit the synced docs.
- Pause when hub UI opens: the kit does it; keep the `pause` input ([docs/multiplayer.md](docs/multiplayer.md) §4).
- It plays in a box over the world (`game.embed`): an Esc you use gets `preventDefault()`, only then (an unused one leaves the box); size from the window, not `screen`; no fullscreen or `top.location` in a frame ([docs/kit/world.md](docs/kit/world.md#playing-over-the-world)).
- Music and long audio in a Web Worker: [docs/kit/audio.md](docs/kit/audio.md).
- Online play only through the hub (accounts, friends, invites, chat): [docs/kit/online.md](docs/kit/online.md).
- Show players' avatars (the hub's) wherever you show their names; never draw your own faces for real players: [docs/kit/avatar.md](docs/kit/avatar.md).
- An own server that writes files on the box declares them in `game.data` so backups take them (`hub-doctor` checks it): [docs/kit/server.md](docs/kit/server.md#backups-gamedata).
- No violent words in player-facing text ("zap", not "shoot"). Lint checks every string in `src/game/` except generated data in `src/game/data/` (word lists): filter what players see of it yourself.
- Never say "run" or "turn game" to players.
- Rules are pure and seeded: no `Math.random`, no `Date` in `src/game/rules.ts` ([docs/kit/rng.md](docs/kit/rng.md)).
- A line in `game.changes` for each change a player would notice: [docs/kit/whats-new.md](docs/kit/whats-new.md).

## How to build it

Fill the `TODO(game)` stubs (`npm run todo` lists them). Each hook and when
the kit calls it: [docs/kit/hooks.md](docs/kit/hooks.md).

| File | Hook |
|---|---|
| `src/game/state.ts` | The profile and the game in progress (plain JSON) |
| `src/game/rules.ts` | `newRun`, `step`, `outcome`, `progress` (pure) |
| `src/game/controls.ts` | Keys, gamepad, touch |
| `src/game/render/`, `screens/` | Drawing, the title / HUD / result |
| `src/game/daily.ts`, `race.ts`, `online.ts` | Optional modes |
| `src/game/turns/rules.ts`, `board.ts` | Online games: the rules the hub runs, the board |
| `src/game/test-hook.ts` | Extra `window.__game` drivers |

## How to check it

```bash
npm run check        # typecheck, unit tests, lint, format, kit files, hub-doctor, build
npm run test:hub     # the kit's hub suites on a real hub test host (~20–25 min; one file: npm run test:hub -- tests/hub/kit/progress.test.ts)
npm run shots:hub    # then npm run shots (last: it rewrites the sheet)
```

Then **look at `shots/sheet.png` with Read** and check each shot against its
caption ([docs/kit/screenshots.md](docs/kit/screenshots.md)). Testing:
[docs/kit/testing.md](docs/kit/testing.md).

Find a free port before starting a server (this machine runs many; a busy port
can serve a different game). The kit's scripts do it for you; never use 8099.
Stop what you start (`npm run clean:procs`).

## Definition of done

- Every screen and animation meets [docs/kit/look.md](docs/kit/look.md) (one UI style and its motion, in the game's own colours; the kit's default look is only a scaffold).
- `npm run check` passes (so `kit:check` is clean and `hub-doctor` is happy). Kit tests that don't apply to the game don't block it: features it doesn't declare skip on their own, and any other kit test that doesn't fit is listed with its reason in `tests/kit-skips.json` (never deleted, never edited, never a test of a feature the game has): [docs/kit/testing.md](docs/kit/testing.md#kit-tests-that-dont-apply). Keep the test contract (`snap().score`, `addScore`, `solve`) working.
- The hub suites pass (`npm run test:hub`), including online ones if the game is online.
- The contact sheet looks right at phone and desktop sizes.
- It plays with a keyboard, a gamepad and on a touch screen.
- `game.title`, `description`, `labels`, `ages` describe it; a `cover.png` (`npm run cover`).
- Music, if any, plays from a worker without gaps on a phone.

## Conventions

- Never delete scripts or tests; grow them. A kit test that doesn't apply goes in `tests/kit-skips.json` instead.
- No type assertions (`as`): lint forbids them. Use `satisfies`, a typed `const`, or a type guard.
- A procedure longer than one command becomes an `npm run` script (and a line in the docs), not a list of commands to paste.
- Plans go in `docs/plans/`; the game's notes in `docs/game.md`.
- Commits that don't change the game get `[skip ci]` (pushes deploy).
- Rules, daily and race code stay deterministic (same seed, same game).
- Games are private repos in the `diffenderfer-games` org; `npm run first-deploy`
  makes the repo and its secrets and pushes; after that, pushing to the default
  branch deploys after the gate passes ([docs/repo-setup.md](docs/repo-setup.md)).
