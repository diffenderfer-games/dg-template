# kit/online

Source: `src/kit/online/` (KIT: copy byte-identical; change it in the template first).

`kit/online` is online play in hub rooms (no server of your own): the host's browser runs the rules, guests send their input and draw the views the host sends, and the hub relays. It brings the whole flow: launches (invites, Join, Watch, rejoin), the lobby, chat, the match, resilience when a player drops, and friendly errors. A game touches it in one file, `src/game/online.ts`, where it writes the rules as pure functions and hands them to `onlineGame`. The session wiring is in `kit/boot` (`online-flow.ts`).

## What the game does

Declare `game.multiplayer` in `package.json` ([docs/multiplayer.md §2](../multiplayer.md#2-the-gamemultiplayer-block)), then write `OnlineHooks<S, V, M>` (state, view, input; all JSON) and pass them through `onlineGame`:

```ts
import { onlineGame, type MatchStart, type OnlineGame } from '../kit/online/types.ts';

export const createOnline = (o: { input(): OnlineInput | null; render(v: OnlineView | null, me: number): void }): OnlineGame =>
  onlineGame<OnlineState, OnlineView, OnlineInput>({
    minPlayers: 2,
    start: (m: MatchStart) => newMatch(m.seats, m.seed, m.table?.options), // host: a new match
    apply: (s, from, input) => applyInput(s, from, input),                 // host: one player's input
    step: (s, dt) => advance(s, dt),                                       // host: real-time games
    computer: (s, seat) => botMove(s, seat),                               // input for an away or gone seat, or null
    view: (s, seat) => viewFor(s, seat),                                   // seat is null for a spectator: hide secrets here
    outcome: (s) => (s.winner === null ? null : { winners: [s.winner] }),
    input: () => o.input(),                                                // this player's input now, or null
    render: (v, me) => o.render(v, me),
    isState, isView, isInput,                                              // validate at every JSON boundary
  });
```

`hooks.ts` passes the result as `GameDefinition.online`. Rules to follow in the hooks:

- Randomness only from the seed (`m.seed`, `SeededRng`); keep the generator state in `S`.
- `outcome` returns winners as user ids and must not end a match while a human remains without a winner.
- Never send player-typed text through `input` or `view`; text goes through chat only.
- Keep each view and backup under 8 KB (`MAX_MESSAGE_BYTES`); bigger messages are dropped.

## What the kit does for you

- **Match (`OnlineMatch`).** The host calls `start`, simulates at the frame rate, applies guest input, and broadcasts a public view and, when it differs, a private view per seat at `tickHz` (default 10). Guests send `input()` at the tick rate and draw the latest view. Spectators send nothing. Messages are wrapped in a versioned envelope; other versions and unknown kinds are dropped.
- **Lobby.** `lobbyScreen`: room code, every seat with a face, the player's name opening the player card, Invite, a bell, Start (host, enabled at `minPlayers`) and Leave.
- **Chat.** `chatPanel` shows only text the hub delivered. A rejected message keeps the draft and shows the hub's hint (from `ContentRejectedError`, or the generic words if there is none); when the hint carries `retryAfterMs` a countdown follows ("Try again in 3 s."). A softened line says "Some words were changed." Modes follow `room.info.chatMode`: `on` is a text box plus quick chips, `quick` is chips only (non-friends), `off` hides the panel. Quick phrases: `gg`, `nice`, `hi`, thumbs up, then the game's own `game.multiplayer.quickChat` (sent as `g:<slug>:<i>`; kit/core/manifest.ts reads them from package.json). The same panel serves online games the hub runs through a `ChatPort` (`roomChat(room)`, kit/boot's `turnChat(game)`).
- **Reconnect.** At boot `reclaim()` takes back a seat held after a reload (6 s wait); the hub also sends a rejoin launch, whichever comes first wins. The player lands back in the same room and seat.
- **Away seats played by the computer.** On `seat` `away` or `gone` (and `abandoned`) the seat goes into `computerSeats`; the host feeds it `computer(state, seat)` input each frame. On `back` it is handed back with no reset. A match never ends because someone left.
- **Host loss.** The host sends its whole state to the successor (longest-seated connected non-host) every 2 s. When the host role moves, the successor restores from the freshest backup and play goes on.
- **Invites, Join, Watch.** `installLaunches` registers `onLaunch` and `onJoinInfo` at boot. `host` creates the room for the party (or shares the room you already host), `guest` joins the join info now or when it arrives, `join` and `watch` (also `via: link` or `rejoin`) join `launch.room`, watch as a spectator. Identical launches are ignored; a launch before mount waits; race launches are ignored (the hub joins races). `launch.table` options reach `start` as `m.table`. Invite links come from the hub's invite dialog or `inviteLink()`.
- **`setBusy` and quiet.** When the match starts: `hub.mp.setBusy(true, { label: 'a match' })` (the hub asks "Leave your match?" before an invite takes the player away) and `hub.notify.setQuiet(true)`. Both are cleared when the match ends, the room closes or the player leaves. A live match never pauses.
- **Presence.** Lobby: joinable, with the open seat count. Playing: watchable, not joinable.
- **Ending and leaving.** `ended` is handled once, then the result screen says won or lost by `winners`. `closed` and `kicked` go to the title with words (`closedText`). Online play writes no normal board or Continue.
- **Errors.** `errText` turns hub errors (offline, room not found, full, in progress, banned, suspended) into kid words; the player returns to a safe screen.

## Test drivers (`window.__game.online`)

Installed with the other drivers by `kit/boot` (dev, localhost or `__HUB_TEST__`):

| Driver | What |
|---|---|
| `host()` | Create a room (like Play online). |
| `join(code, spectate?)` | Join a room by code, optionally as a spectator. |
| `start()` | The host starts the match. |
| `room()` | The room code, or null. |
| `seats()` | How many seats the room has. |
| `view()` | The latest view this player draws. |

Test ids: `online`, `quick-match`, `lobby-start`, `lobby-invite`, `lobby-bell`, `lobby-leave`, `player-<id>`, `room-code`, `seats`, `chat`, `chat-lines`, `chat-note`, `chat-input`, `chat-send`, `quick-<id>`.

## Rules it enforces

- Never show undelivered text; no text channel of your own; no links or violent words; `openPlayer` on every name: [docs/multiplayer.md TL;DR](../multiplayer.md#tldr-the-rules).
- Register `onLaunch` at boot, idempotent, race launches ignored: [docs/multiplayer.md §6](../multiplayer.md#6-the-launch-contract).
- Invites, parties and invite links: [docs/multiplayer.md §7](../multiplayer.md#7-invites--parties), [Invite links](../multiplayer.md#invite-links).
- Hub-rooms API, message models and state versus messages: [docs/multiplayer.md §8](../multiplayer.md#8-hub-rooms-no-server).
- Lobby, reconnect, spectators, ending: [docs/multiplayer.md Lobby, reconnect, spectators, ending](../multiplayer.md#lobby-reconnect-spectators-ending).
- Away, back, gone; the match never ends while a human remains: [docs/multiplayer.md Resilience](../multiplayer.md#resilience-away-back-gone).
- Chat rules and modes: [docs/multiplayer.md §10](../multiplayer.md#10-chat-in-your-game) and [docs/hub.md Content safety](../hub.md#content-safety--the-rejection-contract).
- `setBusy` during a live match and no pausing: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).
- Notification etiquette and showing other players: [docs/multiplayer.md §11](../multiplayer.md#11-showing-other-players--notification-etiquette).

## Options / API

| Export | What |
|---|---|
| `onlineGame(hooks)`, `OnlineHooks`, `OnlineGame`, `MatchStart`, `HostMatch` | Typed hooks bridged to the kit (`types.ts`). |
| `OnlineMatch`, `BACKUP_MS` | One match in a hub room (host rules, resilience, backups). |
| `installLaunches(hub, routes)` | The launch adapter; returns `{ ready(), pending }`. |
| `lobbyScreen(opts, actions)` | The lobby DOM. |
| `chatPanel(port, mode, nameOf, { extra?, earlier? })`, `roomChat(room)`, `gamePhrases(slug, phrases)`, `sendChat`, `QUICK_PHRASES` | Chat UI and sending, for a room or an online game the hub runs. |
| `errText(e)`, `closedText(reason)` | Errors and close reasons as words. |
| `envelope`, `parseEnvelope`, `fits`, `successorOf`, `freshest`, `WIRE_VERSION`, `MAX_MESSAGE_BYTES` | Wire format (pure; also runs under Node). |
| `rosterSync(hub)` | Own-server rosters for the People panel (`roster.ts`, imported by path; planned hub API). |
| `OnlineFlow` (in `kit/boot`) | Lobby, match and screens in the session. |

## Tests

- `tests/kit/online/online.test.ts`: wire round trip and dropped versions, the 8 KB limit, successor and freshest backup, error words, the launch adapter, `onlineGame` validation, computer seats and restore.
- `tests/hub-events/online.test.ts` (FakeHub): rows 34 to 55 of the hub-event table: launches, rooms, host takeover, away and gone seats, kicked, ended once, closed reasons, chat, chat modes, presence and busy, `hub:rt-failed`.
- `tests/game/online.test.ts`: the game's own rules (same seed, computer players, table options, bad input, backup restore).
- `tests/hub/kit/online.test.ts` (real hub, browsers): the [multiplayer.md §12](../multiplayer.md#required-scenarios) scenarios against the game (skipped without `game.multiplayer`), below.

### §12 scenarios in `tests/hub/kit/online.test.ts`

| # | Scenario | Covered |
|---|---|---|
| 1 | Invite, jump, accept, lobby | Yes: both land in the same room. |
| 2 | Decline, expiry, cancel | Decline only; the inviter is told and nobody moves. |
| 3 | Leave guard | Yes: "Leave your match?" and Stay keeps the match. |
| 4 | Join and Watch | Join from presence only; Watch is not tested here. |
| 5 | Pause on hub open | The live match keeps running with the hub menu open; pausing on hub open for a normal game is in `tests/hub/kit/pause.test.ts`. |
| 6 | Chat | Rejected link keeps the draft with the hint, softened word shows softened; non-friend quick-only and `HUB_CHAT=off` are covered in `tests/hub-events/online.test.ts` row 50 (FakeHub), not in the browser. |
| 7 | Reconnect | Yes: a reload mid-match returns to the same room and seat. |
| 8 | Suspended player | Yes: friendly message, game stays playable. |
| 9 | Resilience | A guest's tab closing: the match goes on, the computer moves the seat, the player returns to the room. Host drop is covered by hub-event row 42 (FakeHub). |
| 10 | Invite link | A stranger takes a free seat; watch after start and revoke are not covered. |

## Hub API used:

- `hub.rooms.create`, `join`, `reclaim`; the room: `info`, `me`, `send`, `start`, `end`, `leave`, `chat`, `quick`, and events `room`, `msg`, `seat`, `abandoned`, `ended`, `closed`, `kicked`, `chat`.
- `hub.mp.onLaunch`, `onJoinInfo`, `setJoinInfo`, `setBusy`, `inviteLink`, `setRoster` (planned).
- `hub.notify.setQuiet`, `hub.presence.set`.
- `hub.social.openInvite`, `openNotify`, `openPlayer`.
