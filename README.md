# dg-template: the diffenderfer.games game kit

A complete starter for a **diffenderfer.games** game: TypeScript (strict), Vite,
a PixiJS, three.js or plain-HTML renderer, and a **kit** that already does every
hub duty (pause on hub UI, saves, Continue and Your games, the daily with days
in progress, races, online rooms, players' avatars, scores, menus, music in a
worker, the test hook). You write the game: its state, its rules, its controls
and how it looks.

It is built against the hub client that diffenderfer.games runs,
`@diffenderfer-games/hub` **2.0.0-next.11** (pinned exactly), with
online games the hub runs on the kit's own screen, the game's room in the hub's
world (`@diffenderfer-games/world`, `dg-world`), and the game playing in a box
over Adventure Mode (`game.embed`: the kit handles its Esc, pause and layout;
the short checklist for your own code is in [docs/kit/world.md](docs/kit/world.md#playing-over-the-world)).
Coming, and not in it yet: online tables in the world.

## Make a game in 10 steps

The long version is [docs/getting-started.md](docs/getting-started.md).

1. In this repo: `npm run create -- <slug> --title "My Game" --renderer pixi` (or `three`, or `none`; `--no-online`, `--no-turns`… for features it won't have). Pick the final name first.
2. In the new folder (`../<slug>`): `npm run dev`, `npm run check` (it passes as created).
3. Fill the `game` block in `package.json` (title, description, labels, `ages`, features, `embed.size`): `src/game/config.ts` lists the labels and what they decide.
4. Write `src/game/state.ts` and `src/game/rules.ts`.
5. Map controls in `src/game/controls.ts`.
6. Draw it: `src/game/render/` and `src/game/screens/` ([docs/kit/look.md](docs/kit/look.md)).
7. Optional: the daily, race and online hooks in `src/game/`.
8. `npm run check`, `npm run test:hub`, `npm run shots:hub`, `npm run shots`, then look at `shots/sheet.png`.
9. Write the game's notes in `docs/game.md`.
10. `npm run first-deploy`: the private repo in the org, its secrets, the first push (it deploys).

`npm run todo` lists every `TODO(game)` left.

## Where to read

| Doc | What |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | The 10 steps in full |
| [docs/kit/README.md](docs/kit/README.md) | The kit's modules, the KIT / GAME / SYNCED rules, keeping up to date |
| [docs/kit/hooks.md](docs/kit/hooks.md) | Every hook the game fills in |
| [docs/kit/testing.md](docs/kit/testing.md), [docs/kit/screenshots.md](docs/kit/screenshots.md) | Checking your work |
| [docs/game.md](docs/game.md) | This game's own notes |
| [HANDOFF.md](HANDOFF.md), [docs/hub.md](docs/hub.md), [docs/multiplayer.md](docs/multiplayer.md) | The hub's rules (synced from the host; never edit) |
| [docs/repo-setup.md](docs/repo-setup.md) | The org, secrets, the runner, deploys |
| [CLAUDE.md](CLAUDE.md) | The brief for an AI building the game |

## Commands

```bash
npm run create -- <slug> --title "My Game"   # (template) a new game's folder, ready to build
npm run first-deploy # (game) the repo in the org, its deploy secrets, the first push
npm run dev          # play it
npm run check        # typecheck, unit tests, lint, format, kit files, hub-doctor, build
npm run test:hub     # the kit's hub suites against a real hub test host (~20–25 min)
npm run shots        # screenshots of dist/ (phone + desktop) → shots/sheet.png
npm run shots:hub    # the hub scenarios (menu, daily, race, invite, lobby, avatar, your games)
npm run local        # this game on a local hub, on a free port
npm run sim          # play the rules 500 times headless and print the numbers
```
