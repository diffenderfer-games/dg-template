# kit/saved

Source: `src/kit/saved/` (KIT: copy byte-identical; change it in the template first).

The title screen's "Your games" list: every saved game of this game, opened from the title, the hub menu or a card.

## What the game does

Nothing extra. A game with `game.resumable` already has one Continue row (kit/resume). `defineGame` creates the adapter and routes opened rows:

- a daily row goes to `hub.daily.resume(id)` (then `play` runs with `challenge.saved`);
- a normal saved game goes to `session.continueSaved()`;
- a turn game goes to the game's turn screen (kit/turns). The `openTurns` route in `define-game.ts` is a stub that does nothing until saved-games phase 3 ships.

## What the hub does

Saved-games phases 0 and 1 (`hub.saved`):

- `hub.saved.list()` returns every saved instance (`SavedGame`: `id`, `kind` of `daily`, `run` or `turns`, `status`, `progress.label`, optional `daily` and `turns`).
- `hub.saved.opened` is the instance the page was opened for (a card, the menu, `?hub_open=`).
- `onOpen(handler)` switches instances without a reload. `on('change', cb)` fires when the list changes.
- `hub.daily` gains `save`, `resume` and `discard`, and a challenge gains `instanceId`, `saved` and `savedVersion` (see `PlannedDailyExtras` in `kit/core/planned.ts`).

## Which phase turns it on

Hub phase `savedGames01` (saved-games phases 0 to 1) in `src/kit/testing/phases.ts`. Its `shipped` flag is `false`. The kit's next minor version flips it when the hub publishes the phase.

## What works today

- `createSaved(hub, routes, onChange)` feature-checks `hub.saved`. `available` is `false` without it.
- `continueRows(fallback)` without `hub.saved` returns the one Continue row from the saved game (or no rows). Nothing else changes.
- With `hub.saved` it lists active instances only, labelled in the hub's wording.
- Labels never say "run", "turn game" or "instance" (kit/core strings). Examples: `Continue: Level 12`, `Daily challenge · Oct 14 (34 cards left)`, `Online with Sam · your turn`.

## Example

```ts
import { createSaved } from './kit/saved/index.ts';

const saved = createSaved(hub, {
  continueRun: () => void session.continueSaved(),
  resumeDaily: (id) => void hub.daily.resume?.(id),
  openTurns: (id) => showTurnScreen(id),
});
if (!saved.routeOpened()) {
  const rows = await saved.continueRows(async () => savedGameLabel()); // label or null
}
```

## Rules enforced

- A saved daily belongs to its own day and never touches normal progress: [Daily challenges](../hub.md#daily-challenges).
- Rows use the hub's wording and the saved game's own progress label: [Resume saved games](../hub.md#resume-saved-games-hubresume).
- An opened row is routed at boot, within the launch window: [The launch contract](../multiplayer.md#6-the-launch-contract).

## API

| Name | What it is |
|---|---|
| `createSaved(hub, routes, onChange?)` | the adapter; installs `onOpen` and `change` when the hub has `hub.saved` |
| `SavedHandle` | `available`, `continueRows(fallback)`, `routeOpened()`, `open(id, kind)` |
| `SavedRoutes` | `continueRun()`, `resumeDaily(id)`, `openTurns(id)` |
| `ContinueRow` | `{ id, kind, label }` |
| `rowLabel(game)` | the words for one instance, by kind |

## Tests

`tests/kit/saved/saved.test.ts` runs now, against the fake hub's planned flags:

- without `hub.saved`: one Continue row from the saved game, or none;
- row labels use the hub wording;
- with `hub.saved`: opened routes by kind.

Skipped, waiting on `savedGames01`:

- `tests/hub-events/planned.test.ts` row 56: opened routes by kind, `onOpen` switches without a reload, `change` refreshes Continue.
- `tests/hub/kit/planned.test.ts`: "Your games" opens a day in progress, and the win is credited to that day.

## Hub API used

`hub.saved` (`list`, `opened`, `onOpen`, `open`, `on('change')`) and `hub.daily.resume`. All behind a feature check.
