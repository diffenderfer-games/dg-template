# kit/server

Source: `src/kit/server/` (KIT: copy byte-identical; change it in the template first).

`kit/server` is for own-server games only: a real-time competitive game whose server is the authority. It is Node code (`tsconfig.node.json`). It serves `dist/`, answers `/healthz`, upgrades `/ws`, and holds seats for dropped players. Most games never touch it. Hub-rooms games ([online.md](online.md)) need no server at all. The hub supplies verified identity, presence, invites, kid-safe chat and trusted results through `server/hub-server.mjs`; the kit does not wrap that file.

## What the game does

1. Set the game block to a process app (`type: "process"`, a `start` that binds `PORT`, `multiplayer.transport: "own-server"`); see [docs/multiplayer.md §9 Setup](../multiplayer.md#setup).
2. Run `npm run sync-hub-server` to copy `server/hub-server.mjs` from the hub checkout (see below).
3. Write `server/index.mjs` with the kit's server and the hub SDK. The WebSocket library is your choice: pass `onUpgrade`.

```ts
import { createGameServer, verifyPlayer, SeatTable, BAD_TICKET_CLOSE } from '../src/kit/server/index.ts';
import { createHubServer } from './hub-server.mjs';

const hub = createHubServer();
const seats = new SeatTable<Player>();
const app = createGameServer({
  dist: new URL('../dist', import.meta.url).pathname,
  onUpgrade: (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)),
});
// on a connection's first message { ticket }:
const who = await verifyPlayer((t) => Promise.resolve(hub.verifyTicket(t)), ticket);
if (who === null) ws.close(BAD_TICKET_CLOSE);
else seats.rejoin(String(who.uid)) ?? seats.sit(freeSeat, String(who.uid), player);
await app.listen(); // PORT or GAME_PORT
```

On disconnect call `seats.hold(seat, 180_000)`; every tick let the computer play `seats.computerSeats()`; end the match only when `!seats.anyoneHere()` and there is a winner. After the match post the trusted result with `hub.results(...)`.

## What the kit does for you

- `createGameServer({ dist, healthPath?, wsPath?, onUpgrade?, route? })`: serves files from `dist` with their types, falls back to `index.html` for app routes, returns 404 for a missing asset (anything with an extension), never serves outside `dist`.
- `/healthz` answers `{"ok":true}` at once (the catalog waits at most 15 s). Sockets for any path other than `wsPath` (default `/ws`) are destroyed.
- `portFromEnv()` reads `PORT`, then `GAME_PORT`.
- `SeatTable<T>` holds a dropped player's seat for a grace period: `sit`, `hold(seat, graceMs)`, `rejoin(token)`, `expire()`, `status(seat)` (`here`, `away`, `gone`), `computerSeats()` (away or gone), `anyoneHere()`.
- `verifyPlayer(verify, ticket)` returns the verified player or null for a missing, empty or throwing ticket; fetch a fresh ticket at every connect.
- `BAD_TICKET_CLOSE` (4401) is the close code for a bad ticket; the client shows "sign in again".

## Backups (`game.data`)

The hub backs up everything it keeps (accounts, saves, scores, saved games)
by itself. Files **your server** writes on the box do not come along unless
you say where they are, in `game.data`: then the admin backup takes them and a
restore puts them back ([docs/hub.md Server data and backups](../hub.md#server-data-and-backups-gamedata)).

```json
"game": {
  "type": "process",
  "start": "node server/index.mjs",
  "data": [
    { "path": "server/data.db", "kind": "sqlite" },
    "server/uploads"
  ]
}
```

- Paths are relative to the game's folder and stay inside it (letters,
  digits, `.`, `_`, `-`, `/`; no `..`), at most 20.
- Each SQLite database is its own `{ "kind": "sqlite" }` entry, never part of a
  folder: the backup takes a consistent hot copy while the server runs.
- Anything else is a file or a folder (`"kind": "files"`, or a bare string),
  copied as is: write files atomically (a temp file, then rename).
- A path that doesn't exist yet is fine. A restore happens before your server
  starts, so it just reads its files at start as usual.
- An own-server game that writes nothing to disk declares nothing; the admin's
  Backups tab lists process games without `game.data` as not backed up. Static
  games (the template's default) need nothing.

- `hub-doctor` checks it (since hub client 2.0.0-next.8) with the same schema
  the hub's registry reads it with (hub-contract's `GameData`): a path outside
  the folder, a repeated path or more than 20 fail `npm run check`. Declare it
  in `package.json` as soon as your server writes files, so the next backup
  takes them.

## `npm run sync-hub-server`

`scripts/kit/sync-hub-server.ts` finds the hub checkout (`DG_HOST`, default the sibling `../diffenderfer-games`; the repo root, else `next/`), runs the hub's own `tools/sync-hub-server.ts` there with `--game <this repo>`, and that writes `server/hub-server.mjs` here. Extra arguments are passed through. It is a SYNCED file: never edit it. The SDK has no dependencies and is also served at `/_hub/hub-server.mjs`. Without the hub env (`GAME_SLUG`, `HUB_URL`, `HUB_APP_KEY`), `createHubServer().enabled` is false and every call degrades without throwing.

## Rules it enforces

- Identity comes from a verified ticket, valid 60 s and for your slug only; key seats by `uid`: [docs/multiplayer.md Tickets](../multiplayer.md#tickets-verified-identity).
- Leaving never ends the match while a human remains; the computer plays an away seat for the grace (3 minutes while playing): [docs/multiplayer.md Resilience](../multiplayer.md#resilience-away-back-gone).
- Chat only through `hub.chat()` and relay `result.text`: [docs/multiplayer.md §10](../multiplayer.md#10-chat-in-your-game).
- Results are posted from the server only: [docs/multiplayer.md hub-server.mjs](../multiplayer.md#hub-servermjs).
- The hosting contract (path prefix stripped, `PORT`, health path): [docs/multiplayer.md §9](../multiplayer.md#9-own-server-games) and `HANDOFF.md`.

## Options / API

| Export | What |
|---|---|
| `createGameServer(opts)` | `{ server, listen(port?) }`; `listen` resolves to the bound port. |
| `resolveFile(dist, pathname)` | The file for a URL path inside `dist`, `index.html` for app routes, else null. |
| `portFromEnv(env?, fallback?)` | `PORT` or `GAME_PORT`, else the fallback (0). |
| `SeatTable<T>`, `SeatStatus` | Seats with grace. |
| `verifyPlayer(verify, ticket)` | Verify a ticket; null when bad. |
| `BAD_TICKET_CLOSE` | 4401. |

## Tests

- `tests/kit/server/server.test.ts`: file types, the app for routes and 404 for missing assets, never serving outside `dist`, `/healthz`, `PORT` or `GAME_PORT`, a bad ticket refused with 4401, `SeatTable` holding a dropped seat for the grace, letting the same player back, then freeing it.

## Hub API used:

- The browser side: `hub.mp.ticket()`, `hub.presence.set`, `hub.social.*` (see [docs/multiplayer.md Client side](../multiplayer.md#client-side-own-server)).
- The server side, through `hub-server.mjs`: `verifyTicket`, `chat`, `results`, `recent`.
- `hub.mp.setRoster` through `rosterSync` in `src/kit/online/roster.ts` (planned hub API; a no-op until the hub ships it).
