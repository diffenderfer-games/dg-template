# Playing together

KIT doc. What the owner expects when people play a game together: online
games the hub runs ([turns.md](turns.md)), hub rooms ([online.md](online.md))
and races ([race.md](race.md)). Those docs say how; this one says what it
must feel like. Visual rules are [polish.md](polish.md).

## Getting into a game

- **Who can join comes first:** friends only, or open to guests. Then one
  lobby screen that is the same for everyone.
- **The lobby shows** the players (faces and names), a short chat, and the
  game's options, so everyone sees what the host picks as they change it.
  The host can invite friends and remove a player. Team games let players
  pick teams. It looks as good as the main menu, on a phone and a desktop.
- **Invite links** go through `shareLink` ([ui.md](ui.md#sharing-a-link)):
  the share sheet, then the clipboard with a toast, then a dialog with the
  link. The button says **Invite link** (or "Share the invite link"); the
  raw `http://` link is never printed on screen.
- **Joining is as easy as hosting** (`kit/boot` joining.ts, below).
- **Start with the people who are there.** Don't make players wait for a
  full table when the rules work with fewer. The number of seats follows the
  variant chosen (partners Pinochle is four).

## Joining

Pressing the online button must never just make the player a host when
someone is already waiting. The kit's choosers do this for every game:

- **Online games the hub runs** (Play online, `turns-who`): **Anyone**
  (`turns-anyone`) takes a seat in a game that is waiting
  (`hub.turns.openLobbies()`, same mode), skipping one taken meanwhile, and
  only when none is left makes a game anyone can join that starts by itself
  once every seat is taken (`public`, `autoStart`). "Looking for a game…"
  (`looking`) shows meanwhile. The chooser also lists the games waiting for
  a player ("Sam is waiting", "1 of 2 players", **Join**: `turns-open-<id>`,
  `turns-open-join-<id>`) and **More games online** (`turns-more`, the hub's
  Play online sheet, `hub.social.openPlayOnline()`; left out on a runtime
  without it).
- **Live rooms** (the `online` button, `online-who`): **Play now**
  (`online-play-now`) joins a public room waiting in its lobby
  (`hub.rooms.list()`, a free seat, not the player's own) or else hosts one
  anyone can join (`public`, and `public` in presence). **With friends**
  (`online-friends`) hosts a private room to invite them into, as before.
- **Join with a code** in both choosers (`join-code`, `join-code-go`): a
  room's 5-letter code (the lobby shows it, `room-code`), or an online game's
  invite link pasted whole (or its key). Anything else says "That code
  doesn't look right." and stays.
- Invites, parties, invite links and the hub's Join and Watch still arrive as
  launches ([online.md](online.md)).

## Computer players online

- An online game has **no computer players by default**. Online is for
  people; a game against the computer is its own option.
- When a variant can't be played without a full table, the host may choose to
  fill a seat with the computer. Never fill one on their behalf.
- **In an online game the hub runs, the computer never takes a seat because
  a player dropped**, closed the app or switched apps on the phone. It plays a
  seat only after the player quits or discards the game, or the host removes
  them ([turns.md](turns.md)). A player who comes back gets the whole game
  back as it is, with no reset.
- Unit-test this: a seat that drops and comes back keeps its cards and its
  turn, and the computer doesn't move for it.
- A real-time room can't wait, so kit/online moves an away seat until its
  player is back, then hands it back with no reset ([online.md](online.md)).

## During the game

- **Everyone sees what happened.** When someone scores, guesses right or
  wins a round, every player gets an exciting moment that says who did it,
  not a silent jump to the next round. A miss is shown kindly.
- **Every player gets their prompts.** A choice that belongs to another
  player (Chain Reaction's up or down, a trump call, a pass) is asked on
  their screen at the right moment. Test each prompt from each seat.
- **It buzzes on your turn** ([haptics.md](haptics.md)), and the hub's
  your-turn notification brings back a player who left the page.
- Chat (the hub's moderated chat and quick-chat) is there in the lobby and
  during play ([online.md](online.md), [docs/multiplayer.md §10](../multiplayer.md#10-chat-in-your-game)).
- Long games wait for players: a turn game can go on for days, and the game
  is in Your games until it ends ([saved.md](saved.md)).

## Races

A race shows how the other player is doing in numbers they understand
(moves, words, percent, lives), and losing or giving up ends the race for
that player ([race.md](race.md)).
