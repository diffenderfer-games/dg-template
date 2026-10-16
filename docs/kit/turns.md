# kit/turns

Source: `src/kit/turns/` and `src/kit/boot/turns-flow.ts` (KIT: copy byte-identical; change it in the template first).

Online games: the hub runs the game's own rules on its
server, and players get a "your turn" alert when they are away. Players see
**an online game** ("Online with Sam · your turn"), never "turn game" or
**"over days"**: a game may finish in minutes or take days, which isn't known in
advance. With `game.turns` it is **the default way to play online**: the title's
button is **Play online**, and a live room beside it (`multiplayer`) is **Play now**.
Live since hub client 2.0.0-next.6; this kit points at it as it
is in **next.9**: online games on the server with the `turns-rules` entry,
who is there (`connected`, `canLetComputerPlay()`), moves out of turn
(`mayAct`/`autoReact`), the game's own quick-chat (`game.turns.quickChat`),
rematches for everyone, guests and the your-turn buzz.

## What the game does

1. **The rules**, `src/game/turns/rules.ts`: a `TurnRules` object, the module's
   default export. The template has a working example, "take the last one"
   (players take 1 to 3 from a pile; whoever takes the last one wins):

   ```ts
   import type { TurnRules } from '../../kit/turns/rules.ts';

   export const rules: TurnRules<Pile, Take, PileView> = {
     version: 1,
     setup: ({ seats, rng }) => ({ left: 15 + rng.int(6), turn: 0, seats, winner: null }),
     view: (s) => ({ left: s.left, turn: s.turn, winner: s.winner }),
     toAct: (s) => (s.winner === null ? [s.turn] : []),
     apply(s, seat, move) { /* return { state } or { error: 'not_your_turn' } */ },
     outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
     progress: (s) => ({ label: `${s.left} left in the pile`, fraction: 1 - s.left / 20 }),
     autoMove: (s) => ({ take: s.left % 4 === 0 ? 1 : s.left % 4 }),
   };
   export default rules;
   ```

   The module is pure: no DOM, no hub, no `Math.random`, no `Date`, no
   imports after bundling. Randomness comes only from the `rng` the hub hands
   it (`rng.next()`, `rng.int(n)`, `rng.pick(list)`, `rng.shuffle(list)`).
   State is JSON, at most 64 KB, and holds every secret; moves are small JSON
   and never free text. `view(state, seat)` must hide the other seats'
   secrets (`seat` is `null` for a spectator). Import the types from
   `kit/turns/rules.ts`, which is the hub's zod-free
   `@diffenderfer-games/hub/turns-rules` entry, so the bundle stays a few KB.
   Moves out of turn (Uno's jump-in, an "UNO" call) are `mayAct(state)` and
   `autoReact(state, seat, rng)`: [§16.2](../multiplayer.md#162-the-rules-module).

2. **The board**, `src/game/turns/board.ts`: the definition's `turns` hook.
   `draw(ctx, el, board)` draws the view into `el` (DOM) and offers the moves;
   the kit calls it on every change. `board` is `{ view, summary, mySeat,
   canMove, move(move) }`; `canMove` is true on the player's turn and for a
   move out of turn (`mayActNow`). Validate `view` (it is untrusted JSON).
   `create` (optional) is what every new game is made with (`mode`,
   `options`, `seats`, `deadline`). `testMove(board)` gives a legal move for
   this player from the board, or null: the kit's hub suite plays with it
   (`__game.turnsMove()`, the test contract in
   [testing.md](testing.md#what-the-kits-tests-need-from-your-game)).

3. **package.json** (multiplayer.md [§16.1](../multiplayer.md#161-declare-gameturns)):

   ```json
   "game": {
     "turns": {
       "rules": "dist-rules/rules.mjs",
       "players": [2, 4],
       "bots": true,
       "quickChat": ["Good move!", "Your move!", "Last one!"]
     }
   }
   ```

   `npm run build` runs `build:rules` after vite, so `game.build` stays
   `npm run build`. `quickChat` (at most 24, each at most 40 characters) and
   `chatAllow` work as in `game.multiplayer`.

The kit's screen turns on when both are there: the `turns` hook and
`game.turns`. `npm run new-game -- --no-turns` deletes the rules, the board,
its test, the hook and the `game.turns` block.

## The rules module

`npm run build:rules` (`scripts/kit/build-rules.ts`, part of `npm run build`)
bundles it with esbuild into `dist-rules/rules.mjs`. The build fails if the
bundle still has an import, `Math.random`, a timer, `fetch` or `Date.now`; a
game without `src/game/turns/rules.ts` skips it. The hub loads that file's
default export from `game.turns.rules` and runs it in a sandbox (one worker
per CPU, `maxApplyMs` counting only your rules' own run; a move is all or
nothing).

## The screen

The kit draws everything around the board (`kit/turns/screen.ts`, on the
`turns` screen):

- **The title's Play online** (`turns-new`, "With friends, a link or anyone"; first among the online
  buttons) asks who to play with: the computer (`turns-computer`: made with
  `bots` and started at once), a friend with a link (`turns-link`: the link
  shows while the game waits, with Copy the link), or anyone (`turns-anyone`:
  open seats in the hub's Play online).
- **Opening**: Your games and the title's Continue rows (`hub.saved.opened`,
  `onOpen`, without a reload), an invite link (`?hub_turn_link=`, the seat is
  taken at boot), an invited seat (joined on open).
- **The status line** (`turn-status`): "Your turn"; for another player, "Ann
  is playing" or "Waiting for Ann…". It says **"Waiting for…" only when the
  seat's `connected` is `false`**; here or unknown (a player who hides their
  presence, across a block) is "Ann is playing". A move out of turn adds
  "you may move now". In the lobby: "Waiting for players. Start when you're
  ready." At the end: "You won!", "Nice try!" or "It's a draw."
- **The seats** (`turn-seats`): faces, names that open the player card, the
  due seat outlined, an absent player dimmed.
- **The buttons**: Start (`turns-start`, the creator in the lobby), Remind
  them (`turns-nudge`, once a day in the UI), **Let the computer play for
  Ann** (`turns-hand-over`, shown only while the client's
  `canLetComputerPlay()` says so), Rematch (`turns-rematch`, everyone back in
  one game), Leave this game (`turns-leave`, the computer plays on), Back
  (`turns-back`: the hub keeps the game).
- **Chat**: the hub's quick-chat chips, then the game's own
  (`game.turns.quickChat`, sent as `g:<slug>:<i>`), and a text box only
  between friends (`chatMode`); hidden when chat is off.

**No polling.** The screen follows the game's own live events (`move`,
`turn`, `ended`, `chat`); the client catches up after a gap or a quiet spell
(multiplayer.md "No polling needed"), **in the lobby too** since hub client
next.10 (a page waiting for seats or a start fetches the game again after a
quiet spell), so the lobby needs no refresh of its own either. The one timer asks
`canLetComputerPlay()` again when `summary.handOverAt` (or the deadline)
comes, and every `turn` event (a player coming or going) redraws. The hub's
your-turn buzz needs nothing from the game.

The root element carries `data-phase`, `data-kind` (`lobby`, `mine`,
`theirs`, `won`, `lost`, `draw`) and `data-seq` for tests and shots.

## What the hub does

multiplayer.md [§16](../multiplayer.md#16-turn-games-online-games-played-over-days):

- `hub.turns`: `create({ mode, options, invite, link, public, seats, bots, deadline, autoStart })`,
  `join(idOrLinkKey)`, `open(id)`, `list()`, `openLobbies()`, `link`,
  `setYourTurnBuzz()`.
- A `TurnGame`: `summary` (seats with `connected`, `toAct`, `mayAct`,
  `isMyTurn`, `deadline`, `handOverAt`, `seq`), `view`, `mySeat`, `outcome`,
  `chat`, `chatMode`, `link`, `mayActNow`, `start()`, `move()`, `history()`,
  `leave()`, `nudge()`, `setNotify()`, `rematch()`, `invite()`, `share()`,
  `canLetComputerPlay()`, `letComputerPlay()`, `say()`, `refresh()`,
  `close()`, and the events `move`, `turn`, `ended`, `chat`.
- It runs `setup`, `apply`, `autoMove` and `autoReact`, stores the state,
  sends the "your turn" alerts and buzz. Guests play too (quick-chat only).
- The computer never takes a seat on its own: only when a player leaves, or
  when another player lets it play for a due player who isn't connected
  (after 2 minutes, `handOverAt`); they take the seat back by opening the game.
- While an online game is open, `hub.resume.save` saves nothing (`blockedBy: 'turns'`).

## What the kit does

- `kit/turns/rules.ts` re-exports `@diffenderfer-games/hub/turns-rules`:
  `TurnRules` and its types, `defineTurnRules`, `createTurnRng`,
  `turnRngStateFromSeed`. The index adds the conformance kit
  `checkTurnRules` (`@diffenderfer-games/hub/turns`) for tests.
- `turnStatus(game)`, `seatLine(seat)`, `dueOthers`, `handOverNames`,
  `nextCheckIn` (pure, `kit/turns/status.ts`): the words and the timer above.
- `turnsScreen` (`kit/turns/screen.ts`) and `TurnsFlow`
  (`kit/boot/turns-flow.ts`): the screen and its flow in the session.
- `createTurns(hub)` (`link`, `open`, `join`, `create`) and `nudger(game, now)`.
- `kit/core/manifest.ts` reads `game.turns` and its `quickChat` from
  package.json at build time (only the `game` key is bundled).

## checkTurnRules

The hub's conformance kit: seeded games played to the end, moving every seat
in `toAct` and, half the time, a seat in `mayAct` with an `autoReact` move.
It throws `checkTurnRules: …` (with the seed) on a game that never ends, an
empty `toAct` mid-game, a seat that doesn't exist, a state that doesn't
survive JSON, `Math.random`, an illegal `autoMove` or `autoReact`, a seat
seeing another seat's planted secret, oversized moves or states, and old
`fixtures` that need `migrate`. Options are in [testing](testing.md#online-games-over-days-checkturnrules)
(`plant`, `revealed`, `shuffleHidden`). It returns `{ games, moves, longestGame, outOfTurn }`.

```ts
checkTurnRules(rules, { seats: [2, 3], games: 30, plant: (s, seat, marker) => hide(s, seat, marker) });
```

## Rules enforced

- Never send player-typed text in a move; chat goes through the hub: [Content safety and the rejection contract](../hub.md#content-safety--the-rejection-contract).
- Progress labels are kid words, never "turn game": [Writing good progress labels](../hub.md#writing-good-progress-labels).
- Player names open the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).
- "Waiting for…" only for a player who isn't connected; the hand-over only when `canLetComputerPlay()`: [§16.3](../multiplayer.md#163-the-page-hubturns).
- No own refresh timer: [§16.3](../multiplayer.md#163-the-page-hubturns).
- "Remind them" (`nudger`) is once per game per day in the UI; the hub enforces it too.

## API

| Name | What it is |
|---|---|
| `TurnRules<State, Move, View, Event?, Options?>` | the hub's rules contract: `version`, `setup`, `view`, `toAct`, `apply`, `eventView?`, `outcome`, `progress`, `autoMove?`, `mayAct?`, `autoReact?`, `migrate?` |
| `TurnRng`, `TurnRngState`, `TurnSetupContext`, `TurnApplyResult`, `TurnOutcome`, `TurnProgress` | its parts |
| `defineTurnRules(rules)` | types a rules object |
| `checkTurnRules(rules, options?)` | the hub's conformance check; throws on a problem |
| `createTurnRng(state)`, `turnRngStateFromSeed(seed)` | the hub's seeded RNG, to replay a game in tests |
| `turnStatus(game)`, `seatLine(seat)` | the status line and one seat's line |
| `handOverNames(summary, mySeat)`, `nextCheckIn(summary, now)` | whom the hand-over names; when to ask again |
| `TurnsHooks`, `TurnBoard` | the definition's `turns` hook and what `draw` gets (kit/boot types) |
| `createTurns(hub)` | the adapter: `link`, `open(id)`, `join(id)`, `create(opts)` |
| `nudger(game, now)` | a "remind them" function, once per 24 h |

## Tests

- `tests/kit/turns/turns.test.ts`: `checkTurnRules` finds a leaking view, a
  missing `autoMove` and an illegal one; the status words ("Waiting for…"
  only when not connected); the hand-over names and timer; the fake's
  `canLetComputerPlay` follows the client's; the rules entry's RNG.
- `tests/game/turns.test.ts`: the example rules pass `checkTurnRules` at 2 and
  3 seats, refuse bad moves with a short code, and use kid-word labels.
- `tests/hub-events/turns.test.ts`: the title's Play online, Your games,
  an invite link, moves from the board, "is playing" / "Waiting for…", the
  hand-over at `handOverAt` with nothing fetched while waiting, chat with the
  game's phrases, the end, Rematch, Back; no button for a game without the hook.
- `tests/hub-events/planned.test.ts` row 57: a game's moves, turns and end
  reach the page; Continue saves are blocked while it is open.
- `tests/hub/kit/turns.test.ts` (a real hub, two browsers; skipped without
  `game.turns`): a link game, live moves, the game's quick-chat phrase,
  "Waiting for Bob…" once he closes his page, Let the computer play for Bob
  (the hand-over after 1.5 s via `HUB_LIMITS_JSON`), the end; and a game
  opened from the title's Continue row.
- Still waiting: a world table that opens an online game (world W2).

## Hub API used

`hub.turns` (`create`, `join`, `open`, `link`, and the `TurnGame` members in
`TurnGameLike`), `@diffenderfer-games/hub/turns-rules` and (tests)
`@diffenderfer-games/hub/turns`.
