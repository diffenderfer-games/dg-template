# Make a new game in 10 steps

KIT doc. The template comes with a working example, **Coin Dash** ("grab the
coins"): a normal game, a daily challenge, races and an online party mode. You
replace its insides with your game; the kit keeps doing the hub's jobs.

## Step 1. Create the repo

From the template, as a private repo in the `diffenderfer-games` org, with the
deploy secrets: [repo-setup.md](repo-setup.md). On Windows,
`tools/New-Game.ps1` (in the template) does steps 1–3 for a local folder.

## Step 2. Install

```bash
npm install
npm run dev     # the example game; move with WASD, arrows, a gamepad or the stick
```

## Step 3. Pick a renderer and features

```bash
npm run new-game -- --renderer pixi            # 2D (PixiJS v8)
npm run new-game -- --renderer three           # 3D (three.js)
npm run new-game -- --renderer none            # no canvas: cards, words, menus
npm run new-game -- --renderer pixi --no-online --no-race --title "My Game"
```

It copies the starter into `src/game/render/`, removes the other renderers'
packages, sets the `2d`/`3d` label and drops the features you said no to
(`--no-daily`, `--no-race`, `--no-online`, `--no-avatar`). Run it once.

## Step 4. The `game` block

In `package.json`: `title`, `description` (one plain sentence), `labels` (the
catalog filter: see [HANDOFF.md](../HANDOFF.md)), and the features you keep:
`resumable`, `dailyChallenges`, `leaderboards`, `race`, `multiplayer`. Keep
`type: "static"`, `build`, `serveDir: "dist"`. `npm run hub-doctor` checks it.
`game.changes` starts empty: see [kit/whats-new.md](kit/whats-new.md).

## Step 5. State and rules

- `src/game/state.ts`: the profile (bests, unlocks, settings) and the game in
  progress (`Run`). Plain JSON types, so the kit can save and validate them.
- `src/game/rules.ts`: pure functions. No DOM, no hub, no `Math.random`, no
  `Date`: all randomness from the seeded RNG kept in the state, so a daily or
  a race is the same game for everyone ([kit/rng.md](kit/rng.md)).
- Unit-test the rules in `tests/game/` and check the tuning with `npm run sim`.

## Step 6. Controls

`src/game/controls.ts`: one declaration for keys, gamepad, mouse and touch.
The hub draws the on-screen controls ([kit/input.md](kit/input.md)). Keep the
`pause` input.

## Step 7. Draw it

- `src/game/render/`: the scene (from the starter you picked).
- `src/game/screens/`: decorate the kit's title, HUD and result screens.
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
| `avatar.ts` | Faces in the game | [kit/avatar.md](kit/avatar.md) |
| `test-hook.ts` | Extra test drivers | [kit/test-hook.md](kit/test-hook.md) |

`npm run todo` lists every `TODO(game)` still open. Every hook:
[kit/hooks.md](kit/hooks.md).

## Step 9. Check it

```bash
npm run check        # typecheck, unit tests, lint, format, kit files, hub-doctor, build
npm run test:hub     # the kit's hub suites (pause, saves, daily, race, online) on a real hub
npm run shots        # phone + desktop screenshots of dist/
npm run shots:hub    # the hub scenarios
```

Then **look at `shots/sheet.png`** (with Read, if you are an agent). Add your
own scenes to `scripts/shots.config.ts`. See [kit/testing.md](kit/testing.md)
and [kit/screenshots.md](kit/screenshots.md).

## Step 10. Push

Push to `main`/`master`. The deploy's gate runs the same checks and the hub
suites, then the first deploy puts the game on the host
([repo-setup.md](repo-setup.md)). Write the game's own notes in
[game.md](game.md) as you go.
