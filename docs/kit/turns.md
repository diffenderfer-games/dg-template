# kit/turns

Source: `src/kit/turns/` (KIT: copy byte-identical; change it in the template first).

Online games played over days: the hub runs the game's own rules on its
server, so players move whenever they like and get a "your turn" alert in
between. Players see **an online game** ("Online with Sam · your turn"), never
"turn game". Live since hub client 2.0.0-next.6 (`hub.turns`, the rules
contract, "your turn" alerts); this kit points at it as it is in next.7.

## What the game does

It writes `src/game/turns/rules.ts`: a `TurnRules` object, the module's
default export. The template has a working example, "take the last coin"
(players take 1 to 3 coins, whoever takes the last one wins):

```ts
import type { TurnRules } from '../../kit/turns/index.ts';

export const rules: TurnRules<CoinPile, Take, PileView> = {
  version: 1,
  setup: ({ seats, rng }) => ({ coins: 15 + rng.int(6), turn: 0, seats, winner: null }),
  view: (s) => ({ coins: s.coins, turn: s.turn, winner: s.winner }),
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  apply(s, seat, move) { /* return { state } or { error: 'not_your_turn' } */ },
  outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
  progress: (s) => ({ label: `${s.coins} coins left`, fraction: 1 - s.coins / 20 }),
  autoMove: (s) => ({ take: s.coins % 4 === 0 ? 1 : s.coins % 4 }),
};
export default rules;
```

The module is pure: no DOM, no hub, no `Math.random`, no `Date`, no imports
after bundling. Randomness comes only from the `rng` the hub hands it
(`rng.next()`, `rng.int(n)`, `rng.pick(list)`, `rng.shuffle(list)`). State is
JSON, at most 64 KB, and holds every secret; moves are small JSON and never
free text. `view(state, seat)` must hide the other seats' secrets (`seat` is
`null` for a spectator). Import the kit's types only (`import type`), so the
bundle stays self-contained.

To play it online, declare it in `package.json` (multiplayer.md
[§16.1](../multiplayer.md#161-declare-gameturns)):

```json
"game": {
  "build": "npm run build && npm run build:rules",
  "turns": { "rules": "dist-rules/rules.mjs", "players": [2, 4], "bots": true }
}
```

The template does not declare it: the kit has no screen for online games over
days yet, so a game that plays them opens them itself (below).

## The rules module

`npm run build:rules` (`scripts/kit/build-rules.ts`) bundles it with esbuild
into `dist-rules/rules.mjs`. The build fails if the bundle still has an
import, `Math.random`, a timer, `fetch` or `Date.now`. The hub loads that
file's default export from `game.turns.rules` and runs it in a sandbox.

## What the hub does

multiplayer.md [§16 Turn games](../multiplayer.md#16-turn-games-online-games-played-over-days):

- `hub.turns`: `create({ mode, options, invite, link, public, seats, bots, deadline, autoStart })`,
  `join(idOrLinkKey)`, `open(id)`, `list()`, `openLobbies()`, `link`.
- A `TurnGame`: `summary` (seats, `toAct`, `isMyTurn`, `deadline`, `seq`),
  `view`, `mySeat`, `start()`, `move(move)`, `history(sinceSeq)`, `leave()`,
  `nudge()`, `setNotify()`, `rematch()`, `invite()`, `share()`, `say()`,
  `close()`, and the events `move`, `turn`, `ended`, `chat`.
- The hub runs `setup`, `apply` and `autoMove` (bots, leavers, overdue turns),
  stores the state, and sends the "your turn" alerts. Alert wording comes from
  the hub only.
- While an online game is open, `hub.resume.save` saves nothing (`blockedBy: 'turns'`).
- Your games lists them (kit/saved); `hub.saved.onOpen(handler, { kinds: ['turns'] })` opens one without a reload.

**Coming in next.8:** a `@diffenderfer-games/hub/turns-rules` entry (the rules
helpers with nothing else, for the bundle), presence in an online game,
`mayAct`, and buzz. Not in the pinned client yet; nothing here uses them.

## What the kit does

- Re-exports the hub's own rules kit from `@diffenderfer-games/hub/turns`:
  `TurnRules` and its types, `defineTurnRules`, `checkTurnRules`,
  `createTurnRng`, `turnRngStateFromSeed`.
- `createTurns(hub)`: `link`, `open(id)`, `join(idOrLinkKey)`, `create(opts)` over `hub.turns`.
- `nudger(game, now)`: "Remind them", once per game per day in the UI.
- kit/saved routes a picked online game to `openTurns` when the game gives
  one; `defineGame` gives none yet, so the hub opens them (a reload with
  `?hub_open=`) and the title doesn't list them.

## checkTurnRules

The hub's conformance kit: seeded games played to the end with `autoMove` (or
`randomMove`). It throws `checkTurnRules: …` (with the seed) on a game that
never ends, an empty `toAct` mid-game, a state that doesn't survive JSON,
`Math.random`, an illegal `autoMove`, a seat seeing another seat's planted
secret in `view` or `eventView` (pass `plant(state, seat, marker)`), oversized
moves or states, and old `fixtures` that need `migrate`. It returns
`{ games, moves, longestGame }`.

```ts
checkTurnRules(rules, { seats: [2, 3], games: 30, plant: (s, seat, marker) => hide(s, seat, marker) });
```

## Rules enforced

- Never send player-typed text in a move; chat goes through the hub: [Content safety and the rejection contract](../hub.md#content-safety--the-rejection-contract).
- Progress labels are kid words, never "turn game": [Writing good progress labels](../hub.md#writing-good-progress-labels).
- Player names open the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).
- "Remind them" (`nudger`) is once per game per day in the UI; the hub enforces it too.

## API

| Name | What it is |
|---|---|
| `TurnRules<State, Move, View, Event?, Options?>` | the hub's rules contract: `version`, `setup`, `view`, `toAct`, `apply`, `eventView?`, `outcome`, `progress`, `autoMove?`, `migrate?` |
| `TurnRng`, `TurnSetupContext`, `TurnApplyResult`, `TurnOutcome`, `TurnProgress` | its parts |
| `defineTurnRules(rules)` | types a rules object (for code that may import at run time) |
| `checkTurnRules(rules, options?)` | the hub's conformance check; throws on a problem |
| `createTurnRng(state)`, `turnRngStateFromSeed(seed)` | the hub's seeded RNG, to replay a game in tests |
| `createTurns(hub)` | the adapter: `link`, `open(id)`, `join(id)`, `create(opts)` |
| `nudger(game, now)` | a "remind them" function, once per 24 h |

## Tests

- `tests/kit/turns/turns.test.ts`: `checkTurnRules` finds a leaking view, a
  missing `autoMove` and an illegal one; the adapter opens games through
  `hub.turns` (saves are blocked while one is open); nudge is once a day.
- `tests/game/turns.test.ts`: the example rules pass `checkTurnRules` at 2 and
  3 seats, refuse bad moves with a short code, and use kid-word labels.
- `tests/hub-events/planned.test.ts` row 57: a game's moves, turns and end
  reach the page; Continue saves are blocked while it is open.
- Skipped in `tests/hub/kit/planned.test.ts` (the template declares no
  `game.turns`): create, invite, move, reload, history; "your turn" alerts.
  Row 59 (a table launch into an online game) waits on the world.

## Hub API used

`hub.turns` (`create`, `join`, `open`, `link`, and the `TurnGame` members in
`TurnGameLike`), and `@diffenderfer-games/hub/turns`.
