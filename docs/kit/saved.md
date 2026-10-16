# kit/saved

Source: `src/kit/saved/` (KIT: copy byte-identical; change it in the template first).

The title screen's Continue rows: every saved game of this game, from the
hub's **Your games** (`hub.saved`), opened from the title, the hub menu, the
home page or a card. Live since hub client 2.0.0-next.6.

## What the game does

Nothing extra. A game with `game.resumable: true` (kit/resume) and a daily
(kit/daily) already makes saved games: the kit saves the game in progress with
`hub.resume.save`, and a started day is a day in progress. `defineGame` creates
the adapter and routes what the player opens:

- a day in progress goes to `hub.daily.resume(id)`, then `play` runs with
  `challenge.saved` (straight back where the player left it);
- the saved game goes to `session.continueSaved()`;
- an online game played over days goes to `openTurns`, which `defineGame` does
  not set: the kit has no screen for those yet (see [turns.md](turns.md)), so
  they are left to the hub (it reloads the page with `?hub_open=`) and never
  appear on the title.

What players see on the title (never "run", "turn game" or "instance"):

| Saved game | Row |
|---|---|
| The saved game | `Continue: 6 coins · 48 s left` (the label `run.progress` gave) |
| A day in progress | `Daily challenge · Oct 14 (6 coins)` |
| An online game | `Online with Sam · your turn` (a game with `openTurns` only) |

## What the hub does

hub.md [Saved games](../hub.md#saved-games) and
[Days in progress](../hub.md#days-in-progress-saved-games):

- `hub.saved.list({ kinds })`: this game's saved games (`SavedEntry`: `id`,
  `kind` of `daily`, `run` or `turns`, `status`, `progress.label`, `daily`,
  `turns`), online games waiting on the player first, then the newest. It
  works offline from the device's copies.
- `hub.saved.opened`: the saved game the page was opened for
  (`?hub_open=<id>&hub_kind=<kind>`), synchronous.
- `onOpen(handler, { kinds })`: a pick from the hub menu while the game runs,
  without a reload. `on('change')`: a save, a finish, a discard, another device.
- `hub.daily`: `save`, `resume(id)`, `cancel` (pause: the day stays in
  progress), `discard` (give it up), `inProgress()`. A started day is a saved
  game; winning it any time later credits that day.
- `hub.resume.save` during a daily saves to the day, and `hub.resume.clear()`
  during a daily starts the day over from its seed.

## What the kit does

- `continueRows(fallback)` lists the active saved games this game can open,
  labelled in the hub's wording. If the list can't be read, the one saved game
  from kit/resume stands in (`fallback` gives its label).
- `routeOpened()` sends the opened saved game where it belongs at boot, after
  a day the hub already started has played (`daily.ready()` comes first).
- The title redraws on `change`, and a title still loading when a game starts
  (a daily from the menu) never covers it.
- Leaving a daily any way but a win pauses it (`hub.daily.cancel`), after
  saving it to the day; a lost day is cleared, so it starts over from its seed
  next time. A normal game is never saved while the hub has a day active (the
  hub would save it to the day): it was saved when the menu opened.
- `discard(id)` and `dailiesInProgress()` for a game that lists them itself.

## Example

```ts
import { createSaved } from './kit/saved/index.ts';

const saved = createSaved(hub, {
  continueRun: () => void session.continueSaved(),
  resumeDaily: (id) => void hub.daily.resume(id),
  openTurns: (id) => showOnlineGame(id), // only a game with a screen for online games over days
});
if (!saved.routeOpened()) {
  const rows = await saved.continueRows(async () => savedGameLabel()); // label or null
}
```

## Rules enforced

- A saved daily belongs to its own day and never touches normal progress: [Daily challenges](../hub.md#daily-challenges).
- Rows use the hub's wording and the saved game's own progress label: [Saved runs](../hub.md#saved-runs-hubresume).
- An opened saved game is routed at boot, within the launch window: [The launch contract](../multiplayer.md#6-the-launch-contract).

## API

| Name | What it is |
|---|---|
| `createSaved(hub, routes, onChange?)` | the adapter; installs `onOpen` (for the kinds it can open) and `change` |
| `SavedHandle` | `continueRows(fallback)`, `routeOpened()`, `open(id, kind)`, `discard(id)`, `dailiesInProgress()` |
| `SavedRoutes` | `continueRun()`, `resumeDaily(id)`, `openTurns?(id)` |
| `ContinueRow` | `{ id, kind, label }` |
| `rowLabel(entry)` | the words for one saved game, by kind |

## Tests

- `tests/kit/saved/saved.test.ts`: rows from `hub.saved` (the saved game and a
  day in progress), the fallback when the list fails, the hub wording, opened
  and `onOpen` routing by kind, online games left to the hub without
  `openTurns`, discard.
- `tests/hub-events/planned.test.ts` row 56: opened routes by kind, `change`
  refreshes Continue, `onOpen` switches without a reload.
- `tests/hub-events/daily.test.ts` row 28 and after: a day in progress restores
  and leaving pauses it; a lost day starts over; a normal game is never saved
  into a day.
- `tests/hub/kit/saved.test.ts` (real hub): leave yesterday's daily mid-game, the
  title's row, back where it was, the win credits yesterday; `?hub_open=` goes
  straight into the day.
- Screenshot `your-games` (`npm run shots:hub`): the title with both rows.

## Hub API used

`hub.saved` (`list`, `opened`, `onOpen`, `open`, `discard`, `on('change')`),
`hub.daily` (`resume`, `save`, `cancel`, `discard`, `inProgress`) and
`hub.resume` (`save`, `clear` during a daily).
