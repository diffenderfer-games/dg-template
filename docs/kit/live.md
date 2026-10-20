# kit/live

Source: `src/kit/live/` (KIT: copy byte-identical; change it in the template first).

Live (realtime) games: racing now, shooters and co-op later. The hub's **live
server** (dg-live) runs the game's own sim and owns the truth. Each page runs
the **same sim** to predict, so the player's own car moves the moment they
steer. Players never see "live game", "sim", "tick" or "server": the button is
**Play now**. The design is the hub's `docs/plans/live.md`.

Needs hub client **2.0.0-next.16** or later (the page flow; the sim and `joinLive` alone, next.14) (`@diffenderfer-games/hub/live-sim`
and `@diffenderfer-games/hub/live`).

## How it works (what the hub does for you)

- **Fixed steps.** The sim steps `tickRate` times a second (1 to 60), on the
  server and in the page alike.
- **Inputs, not positions.** Each page sends its input for each tick, a little
  ahead of the server (the hub works out how far from the round trip). It
  repeats the last few, so a lost packet costs nothing. A seat with no input for
  a tick keeps its last one. An empty or dropped seat gets `autoInput` when
  `game.live.bots` is on.
- **Snapshots.** After each step the server sends every page the state as a
  delta against one the page already holds, packed from your field schemas. The
  wire format is never your code.
- **Prediction.** The page takes the newest snapshot and steps it forward with
  its own pending inputs and every other seat's last input, up to "now". When
  the server disagrees, the error blends away over a few frames. An entity kind
  can say `others: 'interpolate'`: other players' copies are then drawn between
  two past snapshots (always right, a little behind) instead of predicted.
- **Same numbers everywhere.** After each step the state is rounded to the
  wire's precision on both sides, so a page that starts from a snapshot holds
  the server's numbers exactly. Use `dmath` for trig (§ Deterministic math).
- **Transport.** WebTransport (UDP datagrams) first, a WebSocket when it is
  blocked. `match.transport` says which.

It doesn't need to be bit-exact deterministic (that's lockstep, for RTS games).
Small drift is fine: the server corrects it. But the closer the page's step is to
the server's, the fewer corrections players see.

## The sim module

`src/game/live/sim.ts`, default export. The template's is empty (TODOs).
Fields are typed and ranged, and never text:

```ts
import { defineLiveSim, dmath, f } from '../../kit/live/sim.ts';

export default defineLiveSim({
  version: 1, // bump with any change to fields or rules
  tickRate: 30,
  world: { finished: f.int(0, 8) },
  input: { steer: f.float(-1, 1, 8), throttle: f.float(0, 1, 6), boost: f.bool() },
  entities: {
    car: {
      fields: {
        x: f.float(-500, 500, 18),
        y: f.float(-500, 500, 18),
        angle: f.angle(12),
        speed: f.float(0, 60, 12),
        lap: f.int(0, 9),
      },
    },
    coin: { fields: { x: f.float(-500, 500, 12), y: f.float(-500, 500, 12) }, others: 'interpolate' },
  },
  setup(ctx) {
    // ctx.seats, ctx.options, ctx.rng, ctx.spawn(kind, ownerSeat, values)
    for (let seat = 0; seat < ctx.seats; seat += 1) ctx.spawn('car', seat, { x: seat * 6 });
    return { finished: 0 }; // the world's values
  },
  step(state, inputs, ctx) {
    // mutate state; inputs[seat] (null: nobody), ctx.dt, ctx.rng, ctx.spawn/remove
    for (const e of state.entities.values()) {
      if (e.kind !== 'car') continue;
      const input = inputs[e.owner];
      e.angle += (input?.steer ?? 0) * 3 * ctx.dt;
      e.speed += (input?.throttle ?? 0) * 20 * ctx.dt;
      e.x += dmath.dcos(e.angle) * e.speed * ctx.dt;
      e.y += dmath.dsin(e.angle) * e.speed * ctx.dt;
    }
  },
  outcome: (state) => (state.world.finished > 0 ? { places: [/* seats, winner first */] } : null),
  autoInput: (state, seat, rng) => ({ throttle: 0.8, steer: 0 }),
});
```

The rules:

- **Pure.** Randomness only from `ctx.rng`: its state is part of the sim state,
  so the page's prediction draws the same numbers. No `Math.random`, `Date`,
  timers or I/O. Lint and `build:live` both check.
- **Only declared fields.** Anything else on an entity is lost on the wire
  (`checkLiveSimRuns` reports it). Pick ranges and bits that cover the values:
  out-of-range values clamp. `f.float(min, max, bits)` has a precision of
  `(max - min) / 2^bits`.
- **`id`, `kind`, `owner`** are the hub's: `owner` is the seat that drives it,
  `-1` for the server's own (coins, NPCs).
- **Keep a full snapshot under ~1,150 bytes** (`checkLiveSimRuns` reports it).
  Bigger ones go the slow way.

Declare it in `package.json` with a hub-room lobby. `npm run build` then
bundles the sim to the `sim` path (`npm run build:live` alone):

```jsonc
"game": {
  "multiplayer": { "lobby": "?mp=lobby", "players": [2, 8] }, // the lobby: a hub room
  "live": {
    "sim": "dist-live/sim.mjs",
    "players": [1, 8],     // seats a match may have; up to 16
    "bots": true,          // the sim has autoInput (empty seats, players not there yet)
    "maxStepMs": 4         // optional: one step's budget on the server (default 4, at most 20)
  }
}
```

The sim's `setup` gets the host's options (`ctx.options`) and each seat's own
choices (`ctx.seatData[seat]`, the player's `room.seat` data), so the track,
the laps and each player's car are known from the first tick. Keep `setup`
under a second (the server cuts it off) and every `step` under `maxStepMs`.

## The page flow

`GameDefinition.live` (`LiveRoomGame`, src/kit/live/types.ts) is everything
the page does; the kit runs the rest (`LiveRoomMatch`, in the online flow):

| Step | The kit | The game |
|---|---|---|
| Title | The online button: Play now, With friends, a code; invites and Join | |
| Lobby | Seats with faces, chat, Invite, Start (host) | `seat()` (my choices), `options()` (the host's), `describe(options)` |
| Start | `room.start({ options })`: the hub places the match on its live server | |
| Loading | A loading screen with a bar | `prepare(start, progress)`: build the world for `start.options` |
| Play | `live.join(room, { sim })`, again after a drop | `play(match, start)`, `frame(dt)` (input), `render()` (draw `match.view()`) |
| End | The hub's `{ places, winnerId }`: the result screen | `result(el, places, start)`; `stop()` when the player leaves |

```ts
// src/game/live.ts
import type { LiveRoomGame } from '../kit/live/index.ts';
import sim from './live/sim.ts';

export const live: LiveRoomGame = {
  sim,
  options: () => ({ track: setup.track, laps: setup.laps }),
  seat: () => ({ car: setup.car }),
  prepare: async (start, progress) => { await buildWorld(start.options, progress); },
  play: (match, start) => { current = { match, start }; },
  frame: () => current?.match.input({ steer: stick.x, throttle: pedal }),
  render: () => current && draw(current.match.view()),
  stop: () => { current = null; },
};
```

- **Seats** are the room's, in order: `start.seats[i]` (name, look for the
  avatar) drives seat `i`; `start.me` is mine. The match starts once every
  seat is in, or 20 s after the start; until a player arrives, `autoInput`
  drives their seat.
- **Results are trusted:** the live server reports the outcome to the hub,
  which records `online_games` and `online_wins` and ends the room.
- **Locally** (`npm run local`, the hub suites) it is production's shape: the
  live server next to the hub, `/_live` routed to it, WebTransport with a
  certificate the ticket vouches for.

Lower down, `joinLive({ sim, slug, room, ticket, url, wsUrl })` connects with a
live ticket you already have (`room.liveTicket()`); `live.join(room, { sim })`
is that plus the ticket.

## Deterministic math

`dmath` (from bfme's lockstep sim): `dsin`, `dcos`, `datan2`, `datan`, `dasin`,
`wrapAngle`, `angleDiff`, `turnToward`, `dist`, `dist2`, `lerp`, `clamp`,
`smoothstep`, `PI`, `TAU`. They use only `+ - * /` and `sqrt`, which IEEE-754
makes identical on every engine. `Math.sin`, `cos`, `atan2`, `exp`, `pow` and
`hypot` are not: they differ in the last bits between Chrome, Firefox and Safari.
Use `dmath` in any sim, rules or daily code that must give the same numbers
everywhere.

## Testing

`tests/game/live.test.ts` runs the hub's `checkLiveSimRuns(sim, { seats })`. It
plays a match on `autoInput` (or empty inputs) and reports:

- a step that isn't repeatable (hidden state, `Math.random`, a clock);
- a field that doesn't survive the wire (undeclared, or out of range);
- snapshots too big for a datagram.

Add your own cases next to it: a lap counts, a collision bounces, the race ends.
