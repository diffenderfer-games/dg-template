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
- **Worked around:** 28 kit tests that assume Coin Dash or the online/turns features (the deploy gate can't pass); the kit's CSS outranking `theme.css`; `New-Game.ps1` dropping `scripts/kit/shots/`; typing (keydown queue, untrusted gamepad keys, P pausing); violent-word lint on word-list data; restyling the kit's screens (Weston look) without documented markup. All in [after-wordle.md](after-wordle.md).
- **Moved into the kit:** nothing yet; proposals in [after-wordle.md](after-wordle.md) §4 (typing, words) and §6 (skin).
- **Docs / CLAUDE.md changes:** to do, listed in [after-wordle.md](after-wordle.md).
