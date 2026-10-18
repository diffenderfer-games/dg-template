# Make a new game in 10 steps

KIT doc. A new game starts as a skeleton: every hook in `src/game/` is there and
wired up (a normal game, a daily challenge, races, online play in hub rooms,
online games the hub runs), with `TODO(game)` comments saying what to fill in
and only the few lines the kit needs to run it. You write your game into it;
there is no example to delete. The kit keeps doing the hub's jobs.

## Step 1. Make the game's folder

Pick the final name first: the slug (lowercase `a-z0-9-`) is the folder, the
repo and the URL (renaming later means a new folder). In `dg-template`:

```bash
npm run create -- word-pop --title "Word Pop" --renderer none --no-online --no-turns
```

It first pulls the latest template (`git pull --ff-only`; offline or diverged only warns,
`--no-pull` skips it), then copies its last commit (never uncommitted changes) to
`../word-pop`, runs `new-game` there (step 3) and `npm install`, and makes the
first commit. On Windows, `tools/New-Game.ps1` does the same and adds a desktop
shortcut ([repo-setup.md](repo-setup.md)).

## Step 2. Play it

```bash
npm run dev     # the skeleton: the kit's title, play (the score), pause and result screens
npm run check   # every local gate: a new game passes it as created
```

## Step 3. A renderer and features (`npm run create` did this)

`create` runs `new-game` with the same flags; in a plain copy of the template:

```bash
npm run new-game -- --renderer pixi            # 2D (PixiJS v8)
npm run new-game -- --renderer three           # 3D (three.js)
npm run new-game -- --renderer none            # no canvas: cards, words, menus
npm run new-game -- --renderer pixi --no-online --no-race --title "My Game"
```

It copies the starter into `src/game/render/`, removes the other renderers'
packages, sets the `2d`/`3d` label, drops the features you said no to
(`--no-daily`, `--no-race`, `--no-online`, `--no-turns`, `--no-world`,
`--no-avatar`), names the game (package.json `name`, the browser tab's
`<title>`, the title screen, a short `README.md`, blank notes in
`docs/game.md`) and runs `npm install`. Run it once.

The Pixi starter lays the scene out in screen pixels from the play region
(`stage.layout()`: phone word and card games, a keyboard that fills the
width); an action game with a fixed field uses `stage.fit({ width, height })`
instead, which letterboxes the arena.

## Step 4. The `game` block

In `package.json`: `title`, `description` (one plain sentence), `labels` (the
catalog filter: see [HANDOFF.md](../HANDOFF.md)), `ages` (who it is for:
`{ "min": 6 }` for 6 and up, or `{ "min": 2, "max": 9 }`; `min` 2 or more; the home
page's age filter reads it), and the features you keep:
`resumable`, `dailyChallenges`, `leaderboards`, `race`, `multiplayer`, `turns`
(online games the hub runs), `world` (your room in the hub's world:
[kit/world.md](kit/world.md)), `embed` (its size in the box over the world:
[kit/world.md](kit/world.md#playing-over-the-world)), `data` (an own server's
files, for backups). The labels also pick the world's rooms that play it
(`src/game/config.ts` lists them). Keep
`type: "static"`, `build`, `serveDir: "dist"`. `npm run hub-doctor` checks it.
`game.changes` starts empty: see [kit/whats-new.md](kit/whats-new.md).

## Step 5. State and rules

- `src/game/state.ts`: the profile (bests, unlocks, settings) and the game in
  progress (`Run`). Plain JSON types, so the kit can save and validate them.
- `src/game/rules.ts`: pure functions. No DOM, no hub, no `Math.random`, no
  `Date`: all randomness from the seeded RNG kept in the state, so a daily or
  a race is the same game for everyone ([kit/rng.md](kit/rng.md)). An ending
  animation keeps `outcome` null until it's done ([kit/hooks.md](kit/hooks.md)).
- Unit-test the rules in `tests/game/` and check the tuning with `npm run sim`.
- Keep the test contract in `hooks.ts` (`snap().score`, `addScore`, `solve`):
  the kit's own tests use it ([kit/testing.md](kit/testing.md#what-the-kits-tests-need-from-your-game)).

## Step 6. Controls

`src/game/controls.ts`: one declaration for keys, gamepad, mouse and touch.
The hub draws the on-screen controls ([kit/input.md](kit/input.md)). Keep the
`pause` input (Escape and Start). A typing or word game reads the keyboard
itself: [kit/input.md](kit/input.md#typing-and-word-games).

## Step 7. Draw it

Read [kit/look.md](kit/look.md) first: the owner's expectations for every
screen and every animation (the kit's default look is a scaffold, not a
finished game).

- `src/game/render/`: the scene (from the starter you picked).
- `src/game/screens/`: decorate the kit's title, HUD and result screens. The
  kit's markup and test ids, and how `theme.css` overrides the kit's CSS:
  [kit/ui.md](kit/ui.md#styling-the-kits-screens).
- `src/game/strings.ts`: the words players read. No violent words, and never
  "run" or "turn game".

## Step 8. Optional features

Each is one file in `src/game/`, wired in `src/game/hooks.ts`:

| File | Feature | Doc |
|---|---|---|
| `daily.ts` | The daily challenge | [kit/daily.md](kit/daily.md) |
| `race.ts` | Races against friends | [kit/race.md](kit/race.md) |
| `online.ts` | Online play in hub rooms | [kit/online.md](kit/online.md) |
| `audio.ts`, `music-*.ts` | Sound and music in a worker | [kit/audio.md](kit/audio.md) |
| `avatar.ts` | Players' faces: reactions (canvas faces: `render/avatar-*.ts`) | [kit/avatar.md](kit/avatar.md) |
| `turns/rules.ts`, `turns/board.ts` | Online games: the rules the hub runs, and the board the kit's screen shows (declare `game.turns`) | [kit/turns.md](kit/turns.md) |
| `test-hook.ts` | Extra test drivers | [kit/test-hook.md](kit/test-hook.md) |

Saved games need nothing extra: with `resumable: true` and a daily, the title
lists the saved game and days in progress ([kit/saved.md](kit/saved.md)).

`npm run todo` lists every `TODO(game)` still open. Every hook:
[kit/hooks.md](kit/hooks.md).

## Step 9. Check it

```bash
npm run check        # typecheck, unit tests, lint, format, kit files, hub-doctor, build
npm run test:hub     # the kit's hub suites on a real hub (~20–25 min; one file: npm run test:hub -- tests/hub/kit/progress.test.ts)
npm run shots:hub    # the hub scenarios
npm run shots        # phone + desktop screenshots of dist/ (run it last: it rewrites the sheet)
```

Then **look at `shots/sheet.png`** (with Read, if you are an agent). Add your
own scenes to `scripts/shots.config.ts`. See [kit/testing.md](kit/testing.md)
and [kit/screenshots.md](kit/screenshots.md).

The kit's tests for features your game doesn't declare skip on their own. A
kit test that still doesn't fit your game is listed, with the reason, in
`tests/kit-skips.json`, never deleted or edited:
[kit/testing.md](kit/testing.md#kit-tests-that-dont-apply).

## Step 10. The first deploy

```bash
npm run first-deploy
```

It creates the private repo in the org, sets its deploy secrets, pushes, and
watches the gate (the same checks) and the deploy put the game on the host
([repo-setup.md](repo-setup.md#the-first-deploy)). After that, every push to
the default branch deploys. Write the game's own notes in [game.md](game.md)
as you go.
