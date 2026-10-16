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

## Wordle (`diffenderfer-games/wordle`)

- **Date:** 2026-10-16
- **Game:** Wordle: guess the five-letter word in six tries; coins per solved word, a daily word, races to 5/10/20 coins. Words from NWL2023 (`../words.md`).
- **Renderer / features:** pixi; daily, race, avatar; `--no-online --no-turns --no-world`.
- **Easy:** saves, Continue, the daily, races, pause on hub UI, scores and the hub suites for them all worked with no game code beyond the hooks; the screenshot runner and contact sheet; `npm run check` as one command.
- **Worked around:** 28 kit tests that assume Coin Dash or the online/turns features (the deploy gate can't pass); the kit's CSS outranking `theme.css`; `New-Game.ps1` dropping `scripts/kit/shots/`; typing (keydown queue, untrusted gamepad keys, P pausing); violent-word lint on word-list data; restyling the kit's screens (Weston look) without documented markup.
- **Moved into the kit (kit 1.4, 2026-10-16):** kit tests that ask the game and need only a test contract (`snap().score`, `addScore`, `solve`, `turns.testMove`); automatic skips for undeclared features; `tests/kit-skips.json` for the rest (never delete a kit test); the kit's CSS first in `<head>`; `npm run create` (HEAD, no questions) and `npm run first-deploy`; `new-game` names the game everywhere; a skeleton of `TODO(game)` comments instead of Coin Dash; `src/game/data/**` out of the violent-words lint; a template test that a `--no-*` game passes its checks as made. Not moved (dropped by the owner): a typing/words module and a skin module for the Weston look; typing is documented in kit/input.md instead.
- **Docs / CLAUDE.md changes:** the test contract and kit skips (testing.md, CLAUDE.md definition of done), no `as`, scripts instead of command lists, kit screen markup (ui.md), `hub.input` facts and typing games (input.md), endings and `outcome` (hooks.md), a lost day (daily.md), race param keys (race.md), sim `maxSteps`, `test:hub` timing, the cover pattern, `shots` last, `DG_HOST` unset in CI (repo-setup.md). See CHANGELOG 1.4.
