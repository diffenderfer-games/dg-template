# Writing "What's new"

KIT doc. `game.changes` in `package.json` is the list players see under
"What's new" ([HANDOFF.md](../../HANDOFF.md) and [hub.md](../hub.md)). A
brand-new game starts with it empty.

## The rule

Whenever you ship something a player would notice, add **one short line a
kid would understand**. Skip refactors, builds, tests and tooling.

| Good | Bad |
|---|---|
| "You can now pause with the Escape key." | "Add pause handler" |
| "Daily challenges are a little easier on Mondays." | "Tune daily difficulty curve" |
| "Race a friend to grab 20 coins first." | "Implement race mode (hub.race)" |
| "Your game is saved when you leave, so you can carry on later." | "Resume support via kit/resume" |

- Say what the player can do or will see, not how it was built.
- Plain words, present tense, one sentence.
- No violent words, and never "run" or "turn game".
- Use `{ "id": "…", "text": "…" }` if you might reword a line later.

## Labels

`game.labels` drives the catalog filter. Use only these, from what the code
really does: a genre (`cards`, `board`, `puzzle`, `arcade`, `platformer`,
`real-time-strategy`, `physics`, `typing`, `word`, `sports`, `racing`, `horror`), `2d` or
`3d` (`npm run new-game` sets it), `phone` (touch controls and a phone
layout), `controller` (gamepad bindings), `desktop` (only if it needs a
keyboard or mouse), and `single-player` and/or `multiplayer`.
