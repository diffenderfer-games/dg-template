# kit/turns

Source: `src/kit/turns/` (KIT: copy byte-identical; change it in the template first).

Turn games the hub runs. The game writes a pure rules module. The hub keeps the state, the seats and the alerts.

## What the game does

It writes `src/game/turns/rules.ts`, a `TurnRules` object. The template has a working example, "take the last coin" (players take 1 to 3 coins, whoever takes the last one wins):

```ts
import type { TurnRules } from '../../kit/turns/index.ts';

export const rules: TurnRules<CoinPile, Take, PileView> = {
  version: 1,
  setup: ({ seats, rng }) => ({ coins: 15 + Math.floor(rng() * 6), turn: 0, seats, winner: null }),
  view: (s) => ({ coins: s.coins, turn: s.turn, winner: s.winner }),
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  apply(s, seat, move) { /* return { state } or { error: 'not_your_turn' } */ },
  outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
  progress: (s) => ({ label: `${s.coins} coins left`, fraction: 1 - s.coins / 20 }),
  autoMove: (s) => ({ take: s.coins % 4 === 0 ? 1 : s.coins % 4 }),
};
```

The module is pure: no DOM, no hub, no `Math.random`, no `Date`, no imports after bundling. The hub passes its own RNG. State is JSON, at most 64 KB, and holds every secret. `view(state, seat)` must hide the other seats' secrets (`seat` is `null` for a spectator).

## The rules module

`npm run build:rules` (`scripts/kit/build-rules.ts`) bundles it with esbuild into `dist-rules/rules.mjs`. The build fails if the bundle still has an import, `Math.random`, a timer, `fetch` or `Date.now`. The hub loads that file from `game.turns.rules` and runs it on its server.

## What the hub does

Saved-games phase 3 (`hub.turns`):

- `create({ mode, options, invite, link, bots })`, `join(idOrLinkKey)` and `open(id)` return a `TurnGame`.
- A `TurnGame` has `summary`, `view`, `mySeat`, `move(move)`, `history(sinceSeq)`, `leave()`, `nudge()`, `setNotify()` and the events `move`, `turn` and `ended`.
- The hub runs `setup`, `apply` and `autoMove` (left seats, deadlines), stores the state, and sends the "your turn" alert (phase 4). Alert wording comes from the hub only.

## Which phase turns it on

`savedGames3` (hub.turns, turn rules in the hub). The "your turn" alerts wait on `savedGames4`. Both are `shipped: false` in `src/kit/testing/phases.ts`.

## What works today

- The rules module and `checkTurnRules` run now, locally. `tests/game/turns.test.ts` runs them in `npm test`.
- `createTurns(hub)` feature-checks `hub.turns`. `available` is `false` without it, and `open` and `create` resolve to `null`.
- Turn rows in "Your games" need `hub.saved` (see saved.md). Until then `openTurns` in `define-game.ts` does nothing.
- `game.turns` is not in `package.json` yet. The pinned hub-contract manifest schema rejects the key until these phases ship, so adding it now would fail `hub-doctor`.

## checkTurnRules

Random playouts with the computer's moves. It reports `{ seed, step, problem }` for:

- `toAct` empty before the game is over;
- `autoMove` making an illegal move (it needs `autoMove`, or it says so);
- `apply` throwing;
- a state that is not JSON, or over 64 KB (`checkStateSize`);
- a view that shows another seat's secret (pass `secretsOf(state, seat)`);
- a different result for the same seed (not deterministic).

## Rules enforced

- Never send player-typed text in a move; chat goes through the hub: [Content safety and the rejection contract](../hub.md#content-safety--the-rejection-contract).
- Progress labels are kid words, never "turn game": [Resume saved games](../hub.md#resume-saved-games-hubresume).
- Player names open the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).
- "Remind them" (`nudger`) is once per game per day in the UI; the hub enforces it too.

## API

| Name | What it is |
|---|---|
| `TurnRules<S, M, V, E, O>` | the rules contract: `version`, `setup`, `view`, `toAct`, `apply`, `eventView?`, `outcome`, `progress`, `autoMove?`, `migrate?` |
| `checkTurnRules(rules, { seats, options, games?, maxSteps?, secretsOf? })` | the local conformance check; returns `RulesProblem[]` |
| `createTurns(hub)` | the adapter: `available`, `open(id)`, `create(opts)` |
| `nudger(game, now)` | a "remind them" function, once per 24 h |
| `MAX_TURN_STATE_BYTES`, `checkStateSize(bytes)` | the 64 KB rule |

## Tests

Run now:

- `tests/kit/turns/turns.test.ts`: `checkTurnRules` finds a leaking view and a missing or illegal `autoMove`; the adapter is off without `hub.turns`; nudge is once a day.
- `tests/game/turns.test.ts`: the example rules pass at 2 and 3 seats, refuse bad moves with a short code, and use kid-word labels.

Skipped:

- `tests/hub-events/planned.test.ts` row 57 (`savedGames3`): a turn game replays missed moves, shows whose turn it is, and ends once.
- Row 59 (`worldW2` + `savedGames3`): a join launch from a table opens the turn game with no host step.
- `tests/hub/kit/planned.test.ts` (`savedGames3`): create, invite, move, the other page gets the move, reload, history replays.

## Hub API used

`hub.turns` (`create`, `join`, `open`, and the `TurnGame` methods), behind a feature check.
