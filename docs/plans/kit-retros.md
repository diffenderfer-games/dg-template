# Kit retros

Template only. After each new game made with the kit, add a dated entry (plan
§10.2): what was easy, what the game had to work around, what moved into the
kit, what changed in the docs and CLAUDE.md. Newest first.

## Template (template)

- **Date:**
- **Game:**
- **Renderer / features:**
- **Easy:**
- **Worked around:**
- **Moved into the kit:**
- **Docs / CLAUDE.md changes:**

---

## Fish Flap (`fish-flap`, not deployed yet)

- **Date:** 2026-10-22
- **Game:** an underwater Flappy Bird: a fish flaps through sponges, kelp, seaweed and coral, dodging sharks; pearl and power-up bubbles; Calm/Choppy/Frenzy, the daily, races.
- **Renderer / features:** pixi; daily, race, avatar; `--no-online --no-turns` (removed by hand after `create`).
- **Easy:** the rules-only sim and unit tests for tuning; the screenshot runner with game scenarios for every look pass; lingo's screen helpers as the pattern for the dressed screens.
- **Worked around:** `hub.input.down()` is per frame, so a flap read with it was missed (read held-now-not-last-step, and latch key presses and taps); a hub `tap` virtual control drew nothing on a static page, so taps are a pointer listener on the stage; the test link served at `/` froze the game every autosave (the hub client finds no slug and `hub.resume.save` threw inside the session loop).
- **Moved into the kit:** resume 1.3: a save the hub refuses warns once and is skipped instead of throwing into the loop.
- **Docs / CLAUDE.md changes:** `vite.config.ts` serves `npm run dev` and `vite preview` under `/<slug>/` (the build keeps `base: './'`); CLAUDE.md's base rule and review.md's phone link say `/<slug>/`; resume.md says refused saves are skipped.

---

## Pinochle (`diffenderfer-games/pinochle`, not deployed yet)

- **Date:** 2026-10-16
- **Game:** Pinochle: partners (4), cutthroat (3), two-hand (2) and double deck (4) with house rules (target, lowest bid, passing, dealer stuck, must beat, keep meld, ×10 numbers); against the computer, the daily, and online games the hub runs at 2–4 seats.
- **Renderer / features:** pixi; daily, turns, avatar; `--no-race --no-online --no-world`. Card art and motion from ../solitaire.
- **Easy:** one pure engine shared by local play and `turns/rules.ts`; `checkTurnRules` with `shuffleHidden` caught hidden-hand leaks for free; the turns screen, Continue rows, chat and the hand-over needed no game code; `npm run check` and the hub suites as single commands.
- **Worked around:** `turns.create` is read once at define time, so a create that follows the player's settings needs getters on the object (seats/options from the Table); the turns screen is a column of DOM, so a canvas board draws in the board element's box on the page's own canvas and restyles `.kit-turns[data-phase=playing]` (transparent, pointer-events through, seats placed around the table); two kit pause tests assume an action game (`resumeOnClose` games list them in kit-skips); the kit's turns suite needs the creator to move first; `npm run local` binds 127.0.0.1, so phone testing needed a LAN forwarder (`npm run lan` in the game); the lint's "run" ban covers internal string literals (pinochle's "run" meld became "flush").
- **Moved into the kit:** nothing yet. Candidates: a `turns.create` function (or documented getters), a documented way to draw a canvas board on the turns screen, a kit `npm run lan`, and turn-based variants of the two pause tests.
- **Docs / CLAUDE.md changes:** none in the kit yet (the above are proposals).

---

## Wordle (`diffenderfer-games/wordle`)

- **Date:** 2026-10-16
- **Game:** Wordle: guess the five-letter word in six tries; coins per solved word, a daily word, races to 5/10/20 coins. Words from NWL2023 (`../words.md`).
- **Renderer / features:** pixi; daily, race, avatar; `--no-online --no-turns --no-world`.
- **Easy:** saves, Continue, the daily, races, pause on hub UI, scores and the hub suites for them all worked with no game code beyond the hooks; the screenshot runner and contact sheet; `npm run check` as one command.
- **Worked around:** 28 kit tests that assume Coin Dash or the online/turns features (the deploy gate can't pass); the kit's CSS outranking `theme.css`; `New-Game.ps1` dropping `scripts/kit/shots/`; typing (keydown queue, untrusted gamepad keys, P pausing); violent-word lint on word-list data; restyling the kit's screens (Weston look) without documented markup.
- **Moved into the kit (kit 1.4, 2026-10-16):** kit tests that ask the game and need only a test contract (`snap().score`, `addScore`, `solve`, `turns.testMove`); automatic skips for undeclared features; `tests/kit-skips.json` for the rest (never delete a kit test); the kit's CSS first in `<head>`; `npm run create` (HEAD, no questions) and `npm run first-deploy`; `new-game` names the game everywhere; a skeleton of `TODO(game)` comments instead of Coin Dash; `src/game/data/**` out of the violent-words lint; a template test that a `--no-*` game passes its checks as made. Not moved (dropped by the owner): a typing/words module and a skin module for the Weston look; typing is documented in kit/input.md instead.
- **Docs / CLAUDE.md changes:** the test contract and kit skips (testing.md, CLAUDE.md definition of done), no `as`, scripts instead of command lists, kit screen markup (ui.md), `hub.input` facts and typing games (input.md), endings and `outcome` (hooks.md), a lost day (daily.md), race param keys (race.md), sim `maxSteps`, `test:hub` timing, the cover pattern, `shots` last, `DG_HOST` unset in CI (repo-setup.md). See CHANGELOG 1.4.
