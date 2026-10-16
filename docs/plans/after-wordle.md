# After Wordle: fix the template so the next game goes smoothly

Template only. A task brief for the agent who updates dg-template next. Wordle
(`../wordle`, `diffenderfer-games/wordle`) was the first real game made with the
kit (kit 1.2, 2026-10-16). Everything below cost time, broke the gate, or needed
research outside the docs.

Work order: §1 first (it blocks every new game's deploy), then §2, then the rest.
After each change: `npm run kit:hash`, `npm run check`, CHANGELOG line, module
version bump (docs/kit/README.md § "Changing the kit"). Then in `../wordle`:
`npm run kit:sync`, `npm run check` must pass with **zero** failures, push, and
watch the deploy.

---

## 1. Blocker: the kit's own tests fail in every real game (and so does the deploy gate)

`npm run check` runs `tests/hub-events/**` and `tests/kit/**` against **the
game's real hooks** (`tests/hub-events/_support/harness.ts` imports
`src/game/hooks.ts`). testing.md says "a game that replaces the stubs keeps
them green". It doesn't: the tests are written against Coin Dash. In Wordle,
28 kit tests fail, so `npm run check` fails, so the deploy gate fails, so the
game can't deploy. Wordle had to bend its own design to fix the rest.

### 1a. Features a game dropped still have their tests (24 failures)

`npm run new-game -- --no-online --no-turns` deletes `src/game/online.ts` and
`src/game/turns/*` but keeps `tests/hub-events/online.test.ts` (18 tests) and
`tests/hub-events/turns.test.ts` (6). A **pristine** template game made with
those flags fails the same 24 (checked: `git archive HEAD`, `new-game --renderer
pixi --no-online --no-turns --no-world`, `npx vitest run`).

Fix: gate the suites on the game, like the hub suites already do ("skipped:
this game declares no game.turns"):

- `describe.skipIf(!createGame(fakeView).online)` (or read `package.json`
  `game.multiplayer` / `game.turns`, as `tests/hub/kit/turns.test.ts` does) in
  `tests/hub-events/online.test.ts` and `turns.test.ts`, with the skip reason.
- The real-hub suites `tests/hub/kit/online.test.ts` and the lobby test in
  `tests/hub/kit/avatar.test.ts` ("every human seat in the lobby shows that
  player's face") also fail without online (11 failures in `npm run test:hub`):
  skip them without `game.multiplayer`.
- Add a template test that runs `new-game` with every `--no-*` flag into a temp
  folder and runs `npx vitest run` there: it must pass. That test would have
  caught all of §1.

### 1c. Say in the docs: tests that don't apply may be removed or disabled

Until (and after) the gating above, the docs must say plainly that **kit
tests that don't apply to a game can be removed or disabled so the game
deploys**. Put it in CLAUDE.md (definition of done, beside "`npm run check`
passes"), testing.md and README.md § "Three kinds of file":

- A kit test covers a feature the game doesn't have (online rooms, online
  games, the world, a lobby): delete it, or skip it with the reason
  (`describe.skip('…: this game has no online play')`).
- A kit test assumes another game's shapes but covers a feature the game has
  (Continue, the daily): move it into `tests/game/`, build its states with the
  game's own rules, and keep it.
- Either way, drop the removed or moved files from `kit.json` (so
  `kit:check` doesn't report them missing), list them in `docs/game.md`
  "Known issues", and know that `npm run kit:sync` brings the originals back.
- Never weaken a test of a feature the game has just to get green.

This is what Wordle does now: it deleted `tests/hub-events/online.test.ts`,
`turns.test.ts` and `tests/hub/kit/online.test.ts`, moved `resume.test.ts`
and `daily.test.ts` into `tests/game/kit-*.test.ts` with Wordle-shaped saved
games, and moved `tests/hub/kit/avatar.test.ts` to `tests/hub/` without its
lobby test. Its `npm run check` passes and it deploys.

### 1b. Tests hard-code Coin Dash's shapes (4 failures, plus design bending)

| Test | Assumes |
|---|---|
| `tests/hub-events/resume.test.ts` rows 18, 20, "Continue row" | a saved Run literally `{ mode, seed, rng, t, timeLimit, target, player, coin, score, over }` |
| `tests/hub-events/daily.test.ts` row 28 | the same Run shape for a day in progress |
| `tests/hub-events/progress.test.ts` rows 12, 16 | the profile is exactly `{ best, played }` (seeds it, and expects the pushed save to deep-equal `{ v: 1, data: { best: 5, played: 30 } }`) |
| `tests/hub-events/resume.test.ts` "finished normal game" | the **last** submitted board is `['high', 4]` (a second board breaks it) |
| `tests/hub-events/overlay.test.ts` row 2 | `resumeOnClose` is false (Wordle wanted true; it gave it up) |
| `tests/hub-events/race.test.ts`, `tests/hub/kit/race.test.ts` | the race param is called `coins`, default 10, and `snap().target` echoes it; `race.create` args deep-equal `{ params: { coins: 10 } }` |
| `tests/hub-events/daily.test.ts` row 24 | `daily.complete` meta has a `coins` key |
| `tests/hub/kit/saved.test.ts` | the progress label starts with `"3 coins"` |
| `tests/hub/kit/progress.test.ts`, `tests/hub-events/progress.test.ts` | `[data-testid="result-best"]` / `title-best` text is exactly `Best 7` |
| many | the driver `__game.extra.addCoins(n)` exists and raises `snap().score` |
| `tests/hub-events/race.test.ts` row 30 | `snap()` changes after 160 frames with the `move` vector held (Wordle had to keep `t` in its snap) |
| `tests/kit/audio/audio.test.ts` "MusicCore snapshot" | pins a hash of **`src/game/music-core.ts`**'s output, so changing your song fails a kit test (Wordle kept the template's `SongCore` untouched and wrote its own `music-tune.ts`) |

Fix: make the kit tests ask the game instead of assuming Coin Dash.

- Saved states come from the game: build them with the game's own
  `newRun(...)` (through the harness: start a game, play, `snap`, `resume.save`)
  instead of literals. Same for the day in progress.
- Profiles: seed with `game.profile.defaults()` plus a changed number, and
  assert through `game.profile.merge`/`validate`, not a deep-equal literal.
- A kit-level score driver instead of the game's `extra.addCoins`: e.g. a
  `GameDefinition.testScore?: { add(run, n): void; read(snap): number }` (or
  require `snap().score`), documented in hooks.md / test-hook.md as **the test
  contract**: the short list of things every game must provide for the kit
  suites (a numeric `score` in `snap`, a way to add to it, `title-best` /
  `result-best` testids with a number in them, a first board). Write that
  list down in one place (testing.md § "What the kit's tests need from your
  game") and make the suites need nothing else.
- Text checks: match the number, not the words (`/\b7\b/`, not `'Best 7'`;
  the label check `/^3\b/` or better: the label the game's own `progress()`
  returns for that run).
- Race: read the param key and default from `package.json` `game.race.params[0]`
  instead of `coins` / `10`.
- Boards: assert "the board named in `scores.boards` got the score", not "the
  last call was `high`".
- resumeOnClose: test both settings (the row already does), but the default
  test shouldn't depend on the game's choice.
- Audio: snapshot a kit-owned test core (`tests/kit/audio/toy-core.ts`), not
  `src/game/music-core.ts`.

## 2. Strip Coin Dash out of the template

The example game is "Coin Dash" (collect the coins, a square, a joystick,
`coins` everywhere). It leaks into every game: the kit tests (§1b), the
progress-label wording, `HUD`/`strings.ts`, `state.ts` (`player`, `coin`,
`Vec`, `OnlineView`), `rules.ts` (`steerToCoin`), `controls.ts` (a `move`
stick, `pause` on **P**), `config.ts` (`ARENA`, `TUNING.coinRadius`), the race
param `coins`, `audio.ts` (`coin` sfx), `avatar.ts` (`feelOn: { coin: … }`),
`scripts/shots.config.ts` (`many-coins`), the `cover` scenario (autoplay 2.5 s),
docs (hooks.md, test-hook.md, daily.md…), and `docs/game.md`. An agent has to
work out which parts are the kit and which are the example, then delete Coin
Dash piece by piece, then find out the kit tests needed it.

Make the starting point **neutral**:

- `src/game/*` after `new-game`: minimal compiling stubs with `TODO(game)`:
  a `Run` with `{ mode, seed, rng, t, score, over }` only, a profile `{ best, played }`
  (or whatever §1 settles as the contract), no arena, no joystick, `pause` on
  Escape + Start only (P is a letter in word games; see §4).
- Keep the full example somewhere games don't copy: `examples/coin-dash/`
  (template only, excluded by `new-game` and by `New-Game.ps1`), used by the
  template's own tests and screenshots. Or keep it in `src/game/` but have
  `new-game` replace it with the stubs. Either way a new game never starts
  with Coin Dash's names.
- Words in docs: say "score" and "your game", not "coins", outside the example.
- `docs/game.md` after `new-game`: a blank template with the headings (Design,
  Modes, Controls, Test drivers, Known issues), not Coin Dash's notes.
- `README.md`: a game's README starts as the template's README ("dg-template:
  the diffenderfer.games game kit"). `new-game` should write a short game
  README with the title and leave the kit's notes in `docs/kit/README.md`.

## 3. Creating the game folder (`tools/New-Game.ps1`, `npm run new-game`)

- **`robocopy … /XD .git node_modules dist tools shots .tmp` excludes those
  names at every depth**, so it drops `scripts/kit/shots/` (the screenshot
  runner). `npm run shots` then fails with a missing module. Exclude by full
  path: `/XD "$templateRoot\.git" "$templateRoot\node_modules" "$templateRoot\dist" "$templateRoot\tools" "$templateRoot\shots" "$templateRoot\.tmp"`.
  Also `/XF .diffenderfer-build-cache` (it was copied into the new game).
- It copies the **working tree**, uncommitted changes included. Another session
  may be mid-change in dg-template. Copy `HEAD` instead (`git archive HEAD | tar -x -C <dest>`),
  or refuse when `git status` isn't clean.
- It is interactive (`Read-Host`) and ends by launching `claude`: an agent
  can't run it. Add parameters: `-Name`, `-Renderer pixi|three|none`,
  `-NoOnline -NoTurns -NoWorld -NoRace -NoDaily -NoAvatar`, `-NoShortcut`,
  `-NoLaunch`. Or a cross-platform `npm run create -- <slug> --title "..." --renderer pixi ...`
  in the template that does the copy (HEAD), `npm install`, `new-game`,
  `npm install` again (new-game removes packages), `git init`, first commit.
- `new-game` changes `package.json` dependencies and says "Next: npm install":
  run it automatically.
- `package.json` `name` stays `dg-game` and `description` stays the template's:
  `new-game --title` should set `name` (the slug), `description`, `author`.
- Git line endings: the machine has `core.autocrlf=true`; the first commit warns
  on every file. kit hashes normalise CRLF (`kit-manifest.ts`), so it works,
  but add a `.gitattributes` (`* text=auto eol=lf`) to the template so games
  are LF everywhere.
- The slug is the folder name. Renaming a game later (Word Pop → Wordle) meant
  a new folder; say so in getting-started step 1 ("pick the final name first").

## 4. Word games and text input: document it, give it a kit module

Nothing in the docs covers typing. Wordle worked out:

- **Keys:** the hub input system has no "text" input. Declaring 26 letter
  inputs is heavy, and `hub.input.down()` is a **per-frame** edge: with two
  fixed steps in one frame it can fire twice, and with none it is missed. Wordle
  listens to `keydown` itself (letters, Enter, Backspace), only while
  `session.screen === 'play' && !session.paused`, `preventDefault()`s them
  (Enter would click a focused button, Backspace would navigate back), queues
  them, and drains the queue in `step` (deterministic, works with any number of
  steps per frame). It ignores `!e.isTrusted` events: **the hub's controller
  adapter synthesises keyboard events from the gamepad** (A→Space, B→Enter…),
  which would otherwise type or submit.
- **P pauses** in the template (`pause: { keys: ['escape', 'p'] }`): wrong for
  any typing game. Default to Escape + Start.
- **Gamepad buttons:** one `gamepad` mapping per input (`{ button }` or
  `{ axis }`, not both, not a list; see `GamepadMapping` in the hub's
  `dist/shared/input.d.ts`). The d-pad and the stick need separate inputs.
  For edges per step (not per frame), compare `value() >= 0.5` with last step's.
- **On-screen keyboard:** the hub's virtual controls are sticks and buttons,
  no keyboard. Wordle draws its own in Pixi (`eventMode = 'static'`,
  `pointerdown`). Pixi pointer events work with the ticker stopped (the kit
  stops it); say so in the Pixi starter. `virtual: () => []` turns the hub's
  touch controls off.
- Proposal: `src/kit/typing/` (optional module): the keydown queue with the
  rules above, a key-row layout and gamepad-cursor helper (`moveCursor` that
  keeps its place between rows), and a test driver to type words. Wordle's
  `src/game/hooks.ts` (queue, `keyOf`, `readPad`), `src/game/keyboard.ts` and
  `src/game/controls.ts` are the source; any typing game needs exactly this.
- Proposal: `src/kit/words/`: read packed word lists (see `../words.md` and
  Wordle's `src/game/words.ts`): `chunks`, `isWord` (lazy Set), `definition`,
  plus `marks(guess, answer)` (green/yellow/grey with repeated letters) from
  Wordle's `rules.ts`. Any guess-the-word game uses the same.

## 5. The lint rule against violent words hits data

`eslint.config.ts` applies `VIOLENT_COPY` to every string literal in
`src/game/**/*.ts`. A word list contains `shoot`, `kills`, `guns`, `dead`.
Wordle stores its lists packed with no spaces (every 5 letters is a word) so
no whole word appears, and filters definitions. That works but is a trick.
Better: exempt `src/game/data/**` (generated data) from `VIOLENT_COPY` and say
in the CLAUDE.md rule that player-facing text is still checked by the game's
own filter (the answers and definitions players see must still be clean).

## 6. Styling the kit's screens (the "Weston look")

The full expectations (tokens, components, motion timings, juice, markup,
checks) are now a kit doc: [../kit/look.md](../kit/look.md). This section is
what the kit itself should change so games can meet it with less work.

The owner wants every game to look and move like **Weston's UI** (`../weston`,
`src/ui/ui.css`): a gold letter-spaced kicker, a wordmark that drops in and
bobs, rotating taglines, the menu in a glass panel, buttons with an icon tile +
label + mono sub-line that slide in one after another (60 ms apart), a sheen
on the primary button, a bouncing ◀ pointer on the focused one, footer chips,
rising glowing sparks, the game playing itself blurred behind the title
(attract mode), and pause / result / modals as the same glass card with
gradient 3D lettering that pops in. Colours are each game's own (Wordle is
purple candy, not Weston's navy).

Wordle had to reverse-engineer the kit's DOM and fight its CSS:

- **The kit's CSS wins every tie.** `kit/ui/root.ts` appends `<style id="kit-css">`
  to `<head>` at runtime, **after** the game's `theme.css`. So `:root { --kit-bg: … }`
  in theme.css (what ui.md tells you to do) silently does nothing, and any
  `.kit-btn { … }` override loses. Wordle had to write `html:root { … }` and
  `html .kit-btn { … }`. Fix: wrap every KIT_CSS selector in `:where(...)`
  (zero specificity) or insert the kit style **first** in `<head>`
  (`head.prepend`). Then document that games override with plain selectors.
- The kit's screen markup and test ids aren't documented anywhere. Add to ui.md:
  - title: `div.kit-title-screen.kit-dim` > `h1.kit-title` (testid `game-title`),
    `p.kit-tagline`, `div.kit-continue`?, `div.kit-menu` > buttons
    `continue` / `continue-<id>`, `play`, `daily`, `race`, `race-browse`,
    `online`, `turns-new`, `settings`, `howto`; a kit button is
    `button.kit-btn[.kit-primary]` with an optional `span.kit-btn-sub`;
  - play: `div.kit-corner` > `button.kit-pause-btn` (`pause`), `div.kit-hud` (`hud`);
  - pause: `div.kit-dim` > `h2.kit-title`, `div.kit-menu` > `resume`, `restart`, `settings`, `quit`;
  - result: `div.kit-dim` > `h2.kit-title` (`result-title`), `div.kit-result-body`, `div.kit-menu` > `play-again`, `quit`;
  - modals: `div.kit-modal` > `div.kit-modal-sheet` > `.kit-modal-title`, `.kit-modal-body`, `.kit-modal-buttons`;
  - which of these a game may restructure (Wordle moves `.kit-menu` into its own
    panel and replaces button contents; nav and tests still work because they
    go by `data-nav` and `data-testid`).
- Proposal: a kit **skin** module (`src/kit/skin/`, opt-in from `theme.css` /
  the screen hooks) with Wordle's pieces made generic: `screens/style.ts`
  (`iconButton`, `iconButtons`, `staggerIn`, `card`, `statRow`, `popFrom`),
  `screens/title.ts` (kicker, tile/letter wordmark, taglines, panel, chips,
  sparks), `screens/pause.ts`, the result card, and the CSS in
  `src/game/theme.css` driven by a handful of colour variables
  (`--skin-bg`, `--skin-panel`, `--skin-accent`, `--skin-gold`, `--skin-edge`).
  A new game then sets its colours, its icons and sub-lines, and gets the whole
  look and motion. Also `html.<x>-attract` (blur the canvas on the title) as a
  kit option: the kit knows the screen, so it can toggle the class itself.
- Screenshots catch animated screens mid-entrance: the kit's `pause` scenario
  shoots right after `screen('pause')`, so cards with an entrance animation look
  half-empty. Either wait ~800 ms in the kit scenarios that open a screen, or
  have the shots runner emulate `prefers-reduced-motion` for a "settled" pass
  (and keep games honouring reduced motion).

## 7. Things the docs should just say (each cost research)

- **The session finishes the frame `outcome()` returns non-null.** A game with
  an ending animation (the last row flips, a celebration) must keep `outcome`
  null until it's done: count the animation in the rules (`phase`, `phaseT` in
  the Run), so it pauses and replays deterministically. Put this in hooks.md.
- **A lost daily** is cleared and restarts from its seed next time (`session.ts`
  `finish`): for a word game the player can retry the same word. Document it
  (daily.md) and consider a `daily.retryAfterLoss: false` option.
- `game.race.params` key names are invisible to players (only `title` shows),
  but the kit tests read `coins` today (§1b).
- The sim's default `maxSteps` is 36,000 (10 min): an endless mode reports
  `timeout`; set `maxSteps` in `simSpec`. Say so in testing.md § "Sim".
- `npm run test:hub` takes ~20–25 min for all files (one host per file). Say so,
  and show running one file: `node --test tests/hub/kit/progress.test.ts`.
- The hub's test host **rebuilds the game from source** for each file: don't
  edit the game while `test:hub` runs (Wordle worked in a separate clone).
- The kit's `cover` scenario plays `autoplay` for 2.5 s. For a better tile,
  `exclude: ['cover']` in `scripts/shots.config.ts` and add your own `cover`
  scenario (a showcase driver that sets up a nice board). Document the pattern.
- `npm run shots` rewrites `shots/sheet.png` with only the scenarios of that run
  (`npm run cover` leaves a one-shot sheet). Say "run `npm run shots` last" or
  make `shots:sheet` merge with the previous manifest.
- `hub.input` facts an agent needs and won't find without reading `.d.ts`:
  the `GamepadMapping` shape (§4), that `down()` is per frame, that the
  controller adapter sends untrusted key events.
- The Pixi starter's `stage.fit(ARENA)` letterboxes a fixed arena; phone word
  and card games want a layout in screen pixels from `ctx.region()` (a keyboard
  that fills the width). Show both in the starter (`fit` and `region` layouts).
- Lint forbids type assertions (`as`): use `satisfies` or a typed `const`.
  Say it in CLAUDE.md conventions, since most agents reach for `as Record<…>`.

## 8. Repo, secrets, deploy: the local path

repo-setup.md describes "Use this template" on GitHub. The local path that
worked for Wordle (put it in repo-setup.md, and make §3's script print it):

```bash
gh repo create diffenderfer-games/<slug> --private --description "..."
gh secret set DEPLOY_SSH_KEY -R diffenderfer-games/<slug> < ~/.ssh/diffenderfer_deploy
gh secret set DEPLOY_HOST -R diffenderfer-games/<slug> -b diffenderfer.games
git remote add origin https://github.com/diffenderfer-games/<slug>.git
git push -u origin master          # the gate runs npm run check + test:hub, then deploys
gh run watch -R diffenderfer-games/<slug>
```

- `DG_HOST` (for the hub suites in CI) is an org variable; `gh variable list
  --org` needs org admin, so an agent can't see whether it's set. Say whether it
  is, in repo-setup.md.
- Until §1 is fixed, a new game's first push fails the gate unless the tests
  that don't apply are removed or disabled (§1c).

## Done when

- A game made with `npm run create -- <slug> --renderer pixi --no-online --no-turns --no-world`
  (or the fixed `New-Game.ps1 -Name <Name> ...`) passes `npm run check` with no
  edits, has no Coin Dash names, and its first push deploys.
- The docs say tests that don't apply may be removed or disabled (§1c).
- Wordle, after `npm run kit:sync`, passes `npm run check` and `npm run test:hub`
  with nothing failing, deploys, and can drop its workarounds: `html:root` /
  `html .kit-…` selectors, `music-tune.ts` beside an untouched `music-core.ts`,
  `extra.addCoins`, and coins-only scoring (`docs/game.md` "Known issues" lists them).
- A line in `docs/plans/kit-retros.md` for what moved into the kit.
