# The Hub — shared online features for diffenderfer.games

Every game hosted in this catalog can tap into a shared backend for free:
one user account across all games, saved game state, per-game stats,
leaderboards, and analytics — plus an injected menu (top-left) that handles
sign-in and navigation for you.

You do **not** need to run your own server, database, or auth to use any of
this. It is all served from the host at the same origin your game runs on.

Every game also gets the hub's **social layer** for free: friends, presence,
direct messages, invites, notifications and kid-safe chat live in the injected
menu. Online games (lobbies, invites into your game, relay rooms, own-server
tickets) follow **[`docs/multiplayer.md`](multiplayer.md)**. **Every** game,
online or not, should pause when hub UI opens. See
[Pausing when hub UI opens](#pausing-when-hub-ui-opens-huboverlay).

---

## TL;DR

```html
<script type="module">
  import { hub } from '/_hub/sdk.js';

  // Who's signed in? (null if not — the menu handles login.)
  const { user } = await hub.me();

  // Save / load game state (per user, per game, named slots).
  await hub.putSave('auto', { level: 7, gold: 120 });
  const { save } = await hub.getSave('auto');

  // A long single-player run the player can pick up again from Resume (game.resumable: true).
  hub.resume.save({ state: { level: 7 }, progress: { label: 'Level 7 of 30', fraction: 7 / 30 } });

  // Submit a score — the board is created on first use.
  await hub.submitScore('highscore', 9001, { title: 'High Score' });
  const { entries } = await hub.getLeaderboard('highscore');
</script>
```

That's it. When your game is hosted under `/<your-slug>/`, the SDK figures out
the rest.

---

## How it reaches the API

All games are served from one origin (e.g. `https://diffenderfer.games`), each
under its own path prefix `/<slug>/`. The hub API lives at **`/_api`** on that
same origin, so:

- You can call it with a plain root-relative path: `fetch('/_api/me')`.
- The login cookie is sent automatically (same-origin) — one login works
  across every game.
- There is no CORS to configure and no API host to hard-code.

The SDK derives its base URL as `new URL('/_api', location.origin)` and your
game's **slug** from the first path segment (or from the injected
`window.__HUB__` config). If you ever need to override, see
[Advanced](#advanced).

---

## The injected menu

The host injects a small bootstrap into your game's HTML automatically:

```html
<script>window.__HUB__={"slug":"your-slug","apiBase":"/_api","menu":"top-left"};</script>
<!-- install/offline tags: web-app manifest, favicon, theme-color, apple-* meta,
     and a service-worker registration (see "Offline & installable" below) -->
<script type="module" src="/_hub/menu.js" defer></script>
```

`menu.js` renders a self-contained, style-isolated (Shadow DOM) menu button.
Opening it gives the player: a **connection status** row (with a "Sync now"
button when offline changes are queued), a **Fullscreen** toggle (when the
browser supports it), a link home, login / signup / logout, their stats for
your game, this game's leaderboards, and a list to jump to other games. It also
records a `play` event on load and periodic `heartbeat`s while the tab is
visible (this drives the analytics numbers), and loads a **gamepad adapter** so
controllers work everywhere (see [Controller & arcade support](#controller--arcade-support)).
The drawer's header has a ✨ **What's new** button, with a count while your game
(or the hub) has shipped changes the player hasn't seen (see
[What's new](#whats-new-gamechanges)).

Because it's in a Shadow DOM with `all: initial`, it won't collide with your
game's CSS, and your CSS won't leak into it.

### Where the menu sits

By default the button is top-left. If that overlaps your own UI, pick another
corner with `game.menuPosition` — `"top-left"` (default), `"top-right"`,
`"bottom-left"`, or `"bottom-right"`:

```json
"game": { "type": "static", "title": "My Game", "serveDir": "dist", "menuPosition": "top-right" }
```

The drawer slides in from whichever side (left/right) the button is on.
`menuPosition` only sets the *default* — each player can nudge the button to any
corner themselves with the two arrow buttons in the menu (one flips left↔right,
the other top↔bottom), so if your layout happens to overlap on their screen they
can move it. Their choice is saved per game (`hub:<slug>:menupos` in
localStorage) and wins over your default.

**Players can also drag the button anywhere.** Holding it for **3 seconds**
(mouse or touch — moving more than ~8px or letting go first cancels, so a normal
tap still opens the drawer) enters *move mode*: the button wiggles, a small
"Drag to move · tap to finish" hint appears and the device buzzes (if it can).
Drag it anywhere (pointer capture; the button is `touch-action: none`); it's
clamped fully on-screen inside the safe-area insets. After letting go it stays in
move mode — drag again, **tap** to finish, or it finishes itself after **3s
idle** — then the spot is saved for this game. Keyboard / no-pointer route: the
drawer's **Menu button → Move button** item enters the same mode with focus on
the button; **arrow keys** move it 8px (**Shift** = 40px), **Enter / Escape**
finish (those keys aren't passed to the game while moving). **Reset position**
(same drawer section) drops the override and restores your `menuPosition` +
`menuOffset`.

A dragged position is stored in the same key, anchored to the nearest corner so
it survives window resizes and orientation changes (it's re-clamped on each):
`{"corner":"bottom-right","dx":78,"dy":178}` — `dx`/`dy` are px from that
corner's side and top/bottom edges to the button. A plain corner string
(`"top-right"`, from the arrow buttons) is still accepted; the arrows keep a
dragged button's `dx`/`dy` and mirror it to the other side. A dragged position
overrides `menuPosition` and `menuOffset`; the drawer opens from the side the
button ends up on.

If the corner itself is fine but the button covers a bar of your own (a top
resource bar, a bottom command strip), push it away from the corner with
`game.menuOffset` — pixels (each `0`–`600`), either `{ "x": …, "y": … }` or a
plain number for vertical only. `y` moves it down for top corners / up for bottom
ones; `x` moves it inward from the left or right edge.

```json
"game": { "menuPosition": "top-right", "menuOffset": { "x": 0, "y": 100 } }
```

### Hiding the menu during play

If the button would cover the action, hide it while the game is actively being
played and show it again whenever the player could want it (paused, a menu or
modal open, title/lobby/game-over screens):

```ts
hub.menu.setVisible(false);   // battle running, unpaused, no modal
hub.menu.setVisible(true);    // paused / any menu open
hub.menu.hide(); hub.menu.show(); hub.menu.visible; // shorthands + last requested state
```

Behaviour:

- **Transition:** the button fades/shrinks out (~0.2s; instant with
  `prefers-reduced-motion`). Calls are cheap and idempotent — call it every frame
  or on every state change.
- **Accessibility:** a hidden button is `visibility:hidden`, `aria-hidden="true"`
  and `tabindex=-1`, and is blurred if it had focus.
- **Still reachable:** a tiny (18px) hotspot in the button's screen corner (or,
  if the player dragged the button, a button-sized hotspot at its saved spot) stays
  live while hidden — hovering it with a mouse or tapping it peeks the button
  back for a few seconds. The **gamepad Select** button still toggles the drawer
  (there is no keyboard shortcut); an open drawer always shows the button, and
  hiding never closes an open drawer. Best practice: show it from your own pause
  menu so players find hub functions (account, boards, fullscreen) there.
- **Load order / no SDK:** the state is page-wide — `window.__HUB_MENU_VISIBLE__`
  (`false` = hidden, absent = visible) plus a `hub:menu-visibility` window event
  (`detail: { visible }`). `menu.js` reads the global when it boots, so calling
  this before the menu loads works. Games without the SDK can do the same by
  hand: `window.__HUB_MENU_VISIBLE__ = false; dispatchEvent(new CustomEvent('hub:menu-visibility', { detail: { visible: false } }))`.
  The element is `#hub-menu-root`; the state is not persisted.

### Pausing when hub UI opens (`hub.overlay`)

The hub's menu drawer, chat, player cards, invite toasts the player interacts
with, and the notification panel all cover the game. The hub tracks them as one
**overlay stack** and tells the game when it goes from closed to open and back.
**Every game should adopt it**, single-player included, because a player reading
a message shouldn't lose a life:

```ts
hub.overlay.autoPause({
  pause: () => game.pause(),          // exactly what your own pause does
  // turn-based / idle games only: resume: () => game.resume(), resumeOnClose: true,
});
```

- `open` fires once when the stack goes 0 → 1, and `close` fires once when it
  returns to 0. Nested dialogs don't flicker. Payload: `{ reason, canPause }`, where
  `reason` is `'menu' | 'chat' | 'dialog' | 'keyboard' | 'invite' | 'notify'`.
- **Action games: don't auto-resume.** Leave `resumeOnClose` off and show your
  pause screen so the player resumes deliberately.
- **Online matches can't pause.** After `hub.mp.setBusy(true)`, events carry
  `canPause: false` and `autoPause` skips `pause()`.
- While open, the hub disables your `play` input group automatically. Your own
  enable/disable calls for `play` are recorded and the last one is applied on close.
- Lower level: `hub.overlay.on('open' | 'close', cb)` (returns an unsubscribe fn),
  `hub.overlay.isOpen`, `hub.overlay.canPause`, and the window events
  `hub:overlay-open` / `hub:overlay-close`. The stack is a page-wide singleton
  (`window.__HUB_UI__`), shared by `/_hub/hub.js`, the games' npm clients and the hub's
  social runtime.

Full rules: [`docs/multiplayer.md`](multiplayer.md) §4.

### The game intro

Before a game, the menu plays a short animated D-and-G logo (under three
seconds) over the page while the game loads underneath. Games need no code
for it.

- **When:** on the first load of each game page in a visit (sessionStorage,
  per slug), not on reloads in the same visit. Never on the home page,
  `/_admin` or `/parents`. One of four styles (spin, orbit, draw, warp) is
  picked at random each time.
- **The game keeps loading and running.** The intro is an overlay
  (`#hub-intro-root`, last in `<html>`) that never blocks your scripts. If
  your game is ready first, the intro still finishes, but it's short.
- **Skipping:** a tap, click, any key or a gamepad button jumps to the exit.
  While it shows, pointer, touch and key events are stopped on `window` in the
  capture phase, so your game never gets the skip press.
- **Pausing:** it counts as hub UI (`reason: 'menu'` on `hub.overlay`), so a
  game that adopted `autoPause` and is already running pauses behind it, and
  your `play` input group is held until it ends.
- **Reduced motion:** players who prefer reduced motion get a plain fade in
  and out of the still logo.
- **Turning it off:** signed-in (claimed) players switch off **Show the intro
  before games** in the hub menu under **Settings**. It is stored on the
  account (`GET`/`PUT /_api/me/settings`, `{ showIntro }`), so it stays off on
  every device they sign in on. Guests always see it.
- **Under automation** (`navigator.webdriver`, as in puppeteer suites) it
  never plays, so game tests aren't covered by it. On localhost,
  `?hub_intro=auto` applies the normal rules anyway and `?hub_intro=spin`
  (or `orbit`, `draw`, `warp`) plays that style every time.
- **No flash of the game first:** the host puts a tiny inline script and
  style at the top of your page's `<head>`, before your own styles and
  scripts. It makes the same decision at once and, when an intro is due, puts
  `hub-intro-cover` on `<html>`, painting the intro's empty backdrop from the
  first paint. The menu takes it over (or removes it when the intro won't
  play). If the menu never loads (an ad blocker), the cover lifts at
  `DOMContentLoaded`, since the menu, a deferred module, would have run by then.
- **Cost:** the inline cover is about 1.5 KB; the animation is a separate
  module (`/_hub/intro.js`) loaded only when it plays, and the wordmark's font
  (Exo 2) is fetched only then, as a tiny subset.

### Opting out

Add `"hub": false` to the `game` block in your `package.json` and the host
will not inject anything into your pages:

```json
"game": { "type": "static", "title": "My Game", "serveDir": "dist", "hub": false }
```

You can still use the SDK manually by importing `/_hub/sdk.js` yourself.

---

## The SDK (`/_hub/sdk.js`)

An ES module. Import it (`import { hub } from '/_hub/sdk.js'`) or load it with a
`<script type="module">` and use `window.HubSDK.hub`. Every method returns a
promise.

| Method | Description |
| --- | --- |
| `hub.me()` | `{ user, profiles }` — current user or `user: null`. |
| `hub.userId()` | Your user id, or `null` (synchronous; follows the account as it appears or changes, see [Who you are](#who-you-are)). |
| `hub.signup(username, password)` | Create an account and sign in. |
| `hub.login(username, password)` | Sign in. |
| `hub.logout()` | Sign out. |
| `hub.getProfile()` | This game's profile for the current user. |
| `hub.setProfile({ displayName?, data? })` | Update it (`data` is arbitrary JSON). |
| `hub.listSaves()` | Slot metadata (no payloads). |
| `hub.getSave(slot)` | `{ save }` — one slot's data, or `save: null`. Offline it rejects with code `save_unknown` when this device has never seen the hub's copy of the slot (see [Saves offline](#saves-offline)). |
| `hub.putSave(slot, data, label?)` | Create/overwrite a save slot. |
| `hub.deleteSave(slot)` | Delete a slot. |
| `hub.getStats(userId?)` | Stats map; omit `userId` for your own. |
| `hub.setStat(key, value)` | Set a numeric stat. |
| `hub.incrStat(key, amount=1)` | Add to a stat. |
| `hub.maxStat(key, value)` | Keep the larger of old/new. |
| `hub.submitScore(boardKey, score, { title?, sort?, meta? })` | Submit a score. |
| `hub.getLeaderboard(boardKey, limit=50)` | A board's ranked entries. |
| `hub.listLeaderboards()` | This game's boards. |
| `hub.allLeaderboards()` | Every game's boards (catalog-wide). |
| `hub.recordPlay()` / `hub.heartbeat()` / `hub.event(type)` | Analytics events. |
| `hub.listGames()` | The catalog, for navigation. |
| `hub.getInventory()` / `hub.grant(bundle)` | Inventory snapshot / add goods (offline-capable). |
| `hub.prefetchAll()` | Warm the local cache for **every** game in one request. |
| `hub.sync()` | Flush the offline queue to the server now. |
| `hub.pending()` | Count of queued mutations + buffered events awaiting sync. |
| `hub.online` / `hub.isOffline` | Current connection state. |
| `hub.onStatus(cb)` | Subscribe to status changes; returns an unsubscribe fn. |
| `hub.menu.setVisible(bool)` / `.show()` / `.hide()` / `.visible` | Show/hide the injected menu button (sync, no promise) — see [Hiding the menu during play](#hiding-the-menu-during-play). |
| `hub.favorites()` / `hub.setFavorite(slug, on)` | Starred games (`{ games: string[] }`) — see [Favorites](#favorites). |
| `hub.overlay.autoPause({ pause, resume?, resumeOnClose? })` / `.on('open'\|'close', cb)` / `.isOpen` | Pause when hub UI covers the game (sync) — see [Pausing](#pausing-when-hub-ui-opens-huboverlay). |
| `hub.presence` · `hub.social` · `hub.mp` · `hub.rooms` · `hub.notify` | Presence, friends/player cards, invites + launches + tickets, relay rooms, quiet mode — see [Social & multiplayer](#social--multiplayer) and `docs/multiplayer.md`. |
| `hub.race` | Races: a single-player game becomes multiplayer — same seed for everyone, the hub's waiting card / HUD / referee / result / history; the game reports `status` and `finish`/`lose`. See `docs/multiplayer.md` §14. |

**Offline-first (this is automatic — no config):** the SDK keeps a local mirror
of your game's state in `localStorage`, warmed by every successful read. When
the network drops, **reads serve from that cache** and **writes apply
optimistically *and* enqueue a durable op**. On reconnect the queue replays in
order and merges into the server (saves take the latest, `incr` adds on top of
the server value, `max`/scores keep the best, grants sum). Connection state is
detected both ways (`navigator.onLine` + request outcomes), so it recovers on
its own. See [Offline & installable](#offline--installable-pwa) for the full
picture, the merge rules, and the window events (`hub:online`, `hub:offline`,
`hub:sync`, `hub:status`).

A few operations genuinely need the server and **reject when offline** rather
than fake it: `login` / `signup` / `claim` / `logout`, the `exchange` / `sell` /
`buy` economy swaps, and all `*Trade` calls. (`ensureGuest` falls back to a
local guest so play continues.)

---

## TypeScript client (recommended for TS games)

Games with a build step install the client from npm:
**`@diffenderfer-games/hub`** (its package README has the entry points, errors,
offline and versioning details). While it is on `2.0.0-next.N` prereleases, pin
it exactly: `npm install --save-exact @diffenderfer-games/hub@<version>`. It
has full types for every endpoint, no `window.HubSDK` is needed, and there are
no ambient globals. Run `npx hub-doctor` in the game's CI (dg-template's
`npm run hub-doctor`): it fails when the installed client is outside the live
hub's supported range or the `game.*` block is invalid. Never vendor the
client's sources. The social namespaces are thin: they forward to the runtime
`/_hub/social.js` that the menu loads, so social features update without an
upgrade.

```ts
import { hub } from '@diffenderfer-games/hub';  // auto-detects slug + API base
// or: import { createHub } from '@diffenderfer-games/hub'; const hub = createHub({ slug, apiBase });

const { user } = await hub.me();        // user: User | null

interface SaveData { level: number; gold: number }
await hub.putSave<SaveData>('auto', { level: 7, gold: 120 }, 'Slot A');
const { save } = await hub.getSave<SaveData>('auto');
save?.data.level;                       // typed as number

await hub.submitScore('highscore', 9001, { title: 'High Score', sort: 'desc' });
const { entries } = await hub.getLeaderboard('highscore'); // LeaderboardEntry[]
```

Differences from the plain JS SDK:

- **Throws `HubError` on failure** (instead of returning `null`). `HubError`
  carries `.status` — the HTTP code (`401` not signed in, `404` unknown
  game/board, `413` too large), or `undefined` for a transport/offline error
  (also exposed as `.isOffline`). Wrap calls in try/catch:

  ```ts
  import { HubError } from './hub';
  try {
    await hub.submitScore('highscore', score, { title: 'High Score' });
  } catch (e) {
    if (e instanceof HubError && e.status === 401) showLoginPrompt();
    else if (e instanceof HubError && e.isOffline) {/* running standalone */}
  }
  ```

- **Error details.** `HubError` also carries the server's machine-readable extras:
  `.code` (e.g. `'content_rejected'`, `'rate_limited'`, `'suspended'`,
  `'claim_required'`), `.reason`, `.hint` (a kid-friendly sentence to show)
  and `.retryAfterMs`. A **422** (text refused by the safety filter) throws the
  subclass **`ContentRejectedError`**. See
  [Content safety](#content-safety--the-rejection-contract).
- **Generics** on `getSave<T>`, `putSave<T>`, `getProfile<T>`, `setProfile<T>`
  type your save/profile payloads.
- **Analytics helpers** (`recordPlay`, `heartbeat`, `event`) are
  fire-and-forget — they never throw.
- All response types (`User`, `Save<T>`, `Board`, `LeaderboardEntry`,
  `Metrics`, …) are exported for your own signatures.

The injected menu still provides the login UI and fires play/heartbeat, so even
a game that only reads via this client gets sign-in for free.

### Offline mode (and developing without the hub running)

The TS client mirrors the injected SDK: a `localStorage`-backed cache, a durable
mutation queue, two-way connection detection, and `prefetchAll()` — so it works
both as a dev convenience (build with no backend) and as real offline support in
production. Controlled by the `offline` option:

- `'auto'` (default) — try the network; on a **connection failure** fall back to
  local storage *and* queue writes. Real API errors (4xx) still throw. It
  **recovers automatically**: when a later request succeeds (or the browser
  fires `online`), the queue flushes and the cache re-warms.
- `'always'` — never touch the network; pure local. Ideal for `vite dev` with
  no host.
- `'never'` — strict; always hit the network, throw if it's down (no queue).

```ts
import { Hub } from './hub';
// e.g. in dev, force local; in prod, let it auto-detect:
const hub = new Hub({ offline: import.meta.env.DEV ? 'always' : 'auto' });
```

Offline, **writes apply to the cache and go into the outbox**, replaying in
order on reconnect (saves take the latest, `incr` sums, `max`/scores keep the
best); stats, saves, profile, inventory and leaderboard bests persist locally.
See [Offline and replay](#offline-and-replay) for what replays, the
guarantees, and how a game queues its own operations. Extra surface,
matching the injected SDK: `hub.pending()`, `hub.sync()`, `hub.onStatus(cb)`,
`hub.prefetchAll()`, `hub.isOnline`, and the `hub:online` / `hub:offline` /
`hub:sync` / `hub:status` window events. `OfflineError` (a `HubError` subclass)
is exported for online-only paths.

In `'always'`/dev mode `login`/`signup` still record a local dev user so
logged-in flows work; analytics buffer and cross-game listings stay safe.
Nothing throws merely for being offline (except the strictly online-only ops),
so your game code is identical whether or not the hub is up.

---

## Offline and replay

Calls that change something and can safely wait are queued while the hub
can't be reached, in a typed **outbox** in `localStorage`
(`hub:<slug>:outbox:<id>`, one key per operation), and replayed **in order**
when it is back. Each queued operation has a **kind**; the kind's handler
performs it, and may make several dependent calls (a later call can use an
earlier one's reply), so a chain of calls is one operation.

### Saves offline

The client notes, per game and player, what it last saw of each save slot
on the hub: from the snapshot `prefetchAll()` loads (it lists every slot),
from an online `getSave`, and from each write that lands. Offline,
`getSave(slot)` answers from the device's copy only when it knows the hub's
copy of that slot, when the device wrote the slot itself and the write is
still queued, or when the player is the local offline user. Otherwise (a
fresh device or a cleared browser that hasn't reached the hub yet) it
**rejects** with a `HubError` whose `code` is `save_unknown` (exported as
`SAVE_UNKNOWN_CODE`; `isOffline` is `true`) instead of answering
`save: null`, so a game never mistakes "not loaded" for "no save" and starts
over on top of the player's real progress. Treat it like any failed pull:
keep your local state and don't push it up as if it were the cloud copy.
Queued writes are then checked by the hub when they replay (`base`, above).

### What replays

The hub registers a kind for everything it can safely replay. Each is one
call unless noted; the contract lists the endpoints in
`OFFLINE_REPLAY_ENDPOINTS` (`@diffenderfer-games/hub-contract`), and the
client's route table carries them as `offline: 'replay'`.

| Client call | Kind | Endpoint | Folds into waiting ops |
|---|---|---|---|
| `putSave`, `deleteSave` | `hub.save` | `writeSave`, `deleteSave` | last write to a slot wins (replaces the waiting ones) |
| `setStat`, `incrStat`, `maxStat` | `hub.stat` | `updateGameStat` | per stat and mode: `incr` adds up, `max` keeps the largest, `set` keeps the last |
| `submitScore` | `hub.score` | `submitScore` | per board: keeps the best (lowest on `asc` boards) |
| `setProfile` | `hub.profile` | `setGameProfile` | patches merge |
| `hub.daily.complete` | `hub.daily` | `completeDailyChallenge` (+ `startDailyChallenge`) | never; a composite op, see below |
| `grant`, `exchange`, `buy`, `sell` | `hub.grant`, `hub.exchange` | `grantInventoryItems`, `exchangeInventoryItems` | never: every grant counts |
| `setFavorite` | `hub.favorite` | `setGameFavorite` | last star or unstar of a game wins |
| `hub.resume.save`, `hub.resume.clear` | `hub.resume` | `saveResumeSlot`, `clearResumeSlot` | one slot per game: the newest save or clear replaces the waiting one |
| `hub.daily.save`, `hub.daily.discard` | `hub.saved` | `saveSavedGameState`, `discardSavedGame` (+ `startDailyChallenge` for a day started offline) | one per (game, day): the newest save or discard replaces the waiting one |

- **Saves:** a `putSave` replayed from the queue carries the slot's
  `updatedAt` on the hub as this device last saw it (`base`, `null` when it
  saw no save or never saw the slot). When another device has saved that
  slot since, the hub refuses it with 409 `save_conflict`: the op is dropped,
  fires `failed` and appears in the `hub:sync` conflicts, and the hub's copy
  is kept. A write sent at once while online carries no `base` and always
  lands, as before. See [Saves offline](#saves-offline).
- **Daily:** a day must be *started* online (it needs the hub's signed
  token), but it can be *completed* offline: `hub.daily.complete()` then
  resolves `null`, fires `hub:daily-queued`, and `hub:daily-complete` follows
  when it lands. If the token has expired by then, the op starts the day
  again for a fresh token and completes with that.
- **Exchanges** offline are checked against the cached holdings (a 409
  `HubError` when they can't cover `take`) and applied to them at once; the
  hub has the last word when the op replays.
- **Analytics** (`recordPlay`, `heartbeat`, `event`) use their own capped
  buffer (heartbeats are dropped first) and are sent at least once, without
  dedupe.
- **Online-only** (they throw an `OfflineError` or a `HubError` offline):
  sign-in, social, chat, multiplayer, races, trades with other players,
  `resetGame`.

### Hooking a game in: `hub.offline`

```ts
import { hub } from '@diffenderfer-games/hub';

// Once at load, before or after enqueueing: what a 'mygame.finishRun' op does.
hub.offline.define<{ score: number; level: number }>('mygame.finishRun', async (run, context) => {
  const { rank } = await context.call('submitScore', { slug: 'mygame', key: 'runs', score: run.score });
  await context.call('updateGameStat', { slug: 'mygame', key: 'best-rank', value: rank ?? 0, mode: 'max' });
  // Your own server: send context.key('unlock') so it can dedupe a retry too.
  await fetch('/mygame/api/unlock', { method: 'POST', headers: { 'x-op': context.key('unlock') }, body: JSON.stringify(run) });
});

// Whenever it happens, online or not: queued at once, sent as soon as it can be.
hub.offline.enqueue('mygame.finishRun', { score: 4200, level: 7 });

hub.offline.pending();                                    // waiting ops, oldest first (hub's and yours)
hub.offline.on('replayed', ({ op, result }) => { /* landed */ });
hub.offline.on('failed', ({ op, error }) => { /* dropped: tell the player */ });
hub.offline.on('queued', ({ op }) => { /* queued, or folded into a waiting op */ });
```

- A definition can be a bare handler, or `{ run, mergeKey, merge, replaces }`
  to fold new ops into waiting ones the way the hub's kinds do (`replaces:
  true` = the newest op with the same `mergeKey` replaces the waiting ones;
  `merge(waiting, incoming)` folds into the newest waiting one).
- `context.call(name, fields)` calls any hub endpoint by its contract name.
  Calls to replayable endpoints carry an operation key; **make the same calls
  in the same order on every try**, since the key is the op's id plus the
  call's position. `context.attempt` counts tries; `context.isReplay` is
  `false` when the op ran at once (online, nothing waiting).
- Kind names starting with `hub.` are the hub's own. Payloads are any JSON.
  The op's id is in `op.id`.
- The same events reach the page as `hub:offline-queued`,
  `hub:offline-replayed` and `hub:offline-failed` window events, and
  `hub.pending()`, `hub.sync()`, `hub.onStatus()` and `hub:sync` count and
  drive the outbox as before.

### Guarantees

- **Order:** ops replay one at a time in the order they were queued. Folding
  keeps an op's place (a replacing save moves to the end). A failing op holds
  the ops behind it until it lands or is dropped.
- **Exactly once on the hub:** every call to a replayable endpoint sends its
  operation key in `x-hub-op`; the hub runs it once per caller and key,
  answers a repeat with the remembered reply, and keeps keys for **7 days**
  (`OFFLINE_DEDUPE_TTL_MS`). So a request that landed but whose reply was lost
  is not applied twice. An op replay has started is never changed by folding.
  Calls your handler makes elsewhere are at least once: dedupe them with
  `context.key(step)`.
- **Failures:** a transport failure (offline) waits for the connection; a
  passing failure (408, 425, 429, 5xx, or a `TypeError` from your own fetch)
  retries with backoff (1 s doubling to 60 s, with jitter), up to 8 tries,
  then drops; any other refusal (400, 401, 403, 404, 409, 413, 422, …) or
  other thrown error drops the op at once. A dropped op fires `failed` and
  appears in the `hub:sync` conflicts.
- **Across reloads and tabs:** the outbox survives reloads and replays on
  the next load once the hub is reachable. One tab (or client copy on the
  page) replays at a time, holding a Web Lock (`hub:<slug>:outbox-lease`),
  or a renewed 15 s `localStorage` lease where Web Locks are missing.
- **Undefined kinds:** an op whose kind this client hasn't defined holds the
  queue (so order is kept) until a client that knows it, normally the
  game's own after its `define`, replays it.
- **Size cap:** up to 500 ops and about 1 MB of JSON per game. Past that,
  `enqueue` and offline writes throw a `HubError` with code
  `offline_queue_full` (status 507); nothing waiting is dropped.
- **Menu:** the hub menu shows "N changes waiting to sync" and a thin ring on
  its connection dot while anything waits; **Sync now** pushes at once.

---

## Offline & installable (PWA)

Every hub-enabled game (and the catalog) is a installable, offline-capable PWA
with **nothing to add to your game**. Two layers cooperate:

**1. App shell (service worker).** The host serves one shared service worker at
`/_hub/sw.js` and registers it per scope (each game at `/<slug>/`, the catalog
at `/`). It runtime-caches your HTML, JS, CSS, images, audio, fonts, and
allow-listed CDNs (jsDelivr, Google Fonts, unpkg, cdnjs) as they load, so after
one online visit the game **loads and plays with no connection**. Strategy:
network-first for navigations (falls back to the cached shell) and for
same-origin assets (3 s timeout, then the cached copy; the host answers with
cheap ETag/304 revalidations), cache-first for CDNs. Players stuck on an old
version (e.g. an installed home-screen app with no reload) can use the menu's
**Update & reload** button: it unregisters the service workers, clears Cache
Storage and reloads from the network, keeping saves and settings. `/_api/*` is never
cached — offline data is the SDK's job (above).

**2. Install ("add to home screen").** A per-game web manifest, icons (your
cover image + the DG logo), and the iOS/Android install meta are injected for
you, so players can install the game (or the whole catalog) as a standalone app.
On desktop Chrome/Edge it's the address-bar install button; on iOS/Android it's
"Add to Home Screen"; Safari macOS uses "Add to Dock".

**Data offline (the SDK).** Covered above — local cache + the outbox +
ordered replay on reconnect ([Offline and replay](#offline-and-replay)). Listen for status if you want to surface it yourself:

```js
window.addEventListener('hub:offline', () => showBadge('offline'));
window.addEventListener('hub:online',  () => showBadge('online'));
window.addEventListener('hub:sync', (e) => {
  // e.detail: { pending, flushed, conflicts }
});
hub.prefetchAll(); // optionally warm the cache for all games up front
```

**Opt out / tune.** Add `"pwa": false` to your `game` block to skip the
manifest/SW/install tags for one app, or set `HUB_PWA=0` to disable the whole
layer. Service-worker behaviour is controlled by env vars on the host:
`HUB_SW_VERSION` (bump it only to force every client to drop its caches), `HUB_SW_MAX_ENTRIES`,
and `HUB_SW_CACHEABLE_HOSTS` (the cross-origin allowlist). See `packages/server/internal/src/config.ts`.
Same-origin code is always fetched from the network first, and the cache is used
only when the network fails (offline), so a deploy reaches players at once while
the last copy they loaded keeps working offline. Each game's cache keeps its newest
`HUB_SW_MAX_ENTRIES` files, so old builds' files age out.

> **Secure context:** service workers, install, and the Gamepad API only work
> over **HTTPS or `localhost`**. In production that's the Caddy TLS front
> (`diffenderfer.games`); for a local kiosk, point the browser at
> `http://localhost:<port>`, not a LAN IP.

---

## Controller & arcade support

A controller adapter is injected with the menu, so **standard gamepads and
arcade sticks work in every game with no code**. Arcade controls reach it the
usual way: wire buttons/sticks to a USB encoder, which the browser exposes as a
gamepad via the Web Gamepad API. The adapter reads direction from **both** the
analog stick and the d-pad, so it works whichever way your encoder reports it.

It runs in three contexts automatically:

- **In a game** — translates the pad into synthesized keyboard events (with
  `key`, `code`, and legacy `keyCode` all set). Holding a direction holds the key.
- **On the catalog** — moves a highlight across the tiles and opens the focused
  game.
- **In the hub menu** — the **Select/Back button (8)** pops the menu from
  anywhere; while open, the stick navigates its items, A activates, B closes.
  So the whole arcade is playable with no keyboard.

### Mapping controls per game

The default is arrows to move and the face buttons to the usual action keys
(A→Space, B→Enter, X→Z, Y→X, Start→Enter, Select→Esc). Override per game with a
`controls` block in `package.json`; values are
[`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values)
strings, and `buttons` keys are Standard-Gamepad button indices:

```json
"game": {
  "type": "static", "title": "My Game", "serveDir": "dist",
  "controls": {
    "up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD",
    "buttons": { "0": "Space", "1": "ShiftLeft", "9": "Enter" }
  }
}
```

For **two players**, give a `players` array — pad 0 uses `players[0]`, pad 1 uses
`players[1]`, and so on:

```json
"controls": {
  "players": [
    { "left": "KeyA", "right": "KeyD", "up": "KeyW", "down": "KeyS", "buttons": { "0": "Space" } },
    { "left": "ArrowLeft", "right": "ArrowRight", "up": "ArrowUp", "down": "ArrowDown", "buttons": { "0": "Enter" } }
  ]
}
```

> Synthesized key events are how the adapter stays game-agnostic — it works as
> long as your game reads keyboard input. The same secure-context rule applies:
> the Gamepad API needs HTTPS or `localhost`.

The above is the **zero-config** layer. For first-class input, opt into the
input system below.

---

## Input system (`hub.input`)

A unified input layer: declare **named inputs** that each read as a scalar
`0..1`, map them to keyboard / mouse / touch / gamepad, and read them the same
way on every device. The hub handles device detection, mouse↔gamepad
arbitration, virtual on-screen controls for touch, gamepad/menu navigation, an
on-screen keyboard, and player remapping that persists. It's renderer-agnostic
(works for fully-Pixi and HTML+Pixi games) because all hub-drawn UI is a DOM
overlay. Available as `hub.input` from `/_hub/hub.js` or from the npm package
`@diffenderfer-games/hub`.

### Declare and read

```ts
import { hub } from '/_hub/hub.js';   // or from '@diffenderfer-games/hub' (npm)

hub.input.define({
  groups: {
    play: {
      inputs: {
        moveLeft:  { keys:['a','ArrowLeft'],  gamepad:{ axis:[0,'-'] }, touch:{ stick:'move', axis:'x-' } },
        moveRight: { keys:['d','ArrowRight'], gamepad:{ axis:[0,'+'] }, touch:{ stick:'move', axis:'x+' } },
        jump:      { keys:[' '], gamepad:{ button:0 }, touch:{ button:'jump' } },
        shoot:     { mouse:{ button:0 }, gamepad:{ button:7 }, touch:{ button:'fire' } },
        pause:     { keys:['Escape','p'], gamepad:{ button:9 } },
      },
      axes: { move: { x:['moveLeft','moveRight'] } },
      virtual: [
        { id:'move', type:'joystick', place:'bottom-left' },
        { id:'jump', type:'button', place:'bottom-right', label:'A' },
        { id:'fire', type:'button', place:'bottom-right', label:'B' },
      ],
    },
  },
});
hub.input.enable('play');

// in your game loop:
if (hub.input.down('jump')) jump();          // edge: true the frame it crosses ≥0.5
const move = hub.input.vector('move');        // { x, y, mag }  (mag 0..1)
const firing = hub.input.value('shoot') >= 0.5;
```

Each input exposes `value`/`raw` (`0..1`), `isDown`, `isUp` (frame-based edges).
`hub.input.axis(name)` returns `-1..1` (the axis's `x`, or its `y` when it
only declares `y`); `hub.input.vector(name)` returns
`{x,y,mag}` with `mag ≤ 1`.

### Groups, devices, arbitration

- **Groups** are enabled/disabled (`hub.input.enable('play')` /
  `disable('pause')`) — enable gameplay during play, a menu group while paused.
  A disabled group's inputs read 0 and its virtual controls hide.
- **Touch devices** show the declared **virtual controls** (joysticks, buttons,
  d-pads, tap regions). Every control is fully game-styled: `place` (anchor),
  `size` (or `width`/`height` for non-square), `shape`
  (`circle`/`round`/`square`/`pill`), `axis` for sticks (`both` default, or a
  single-axis `x`/`y` — e.g. a horizontal `pill` stick for a side-scroller),
  `color` (border/knob/pressed), `bg`,
  `text`, `opacity`, and `label`/`html`. See [Touch control layout](#touch-control-layout)
  for where they go and how to keep them off your HUD. Controls hide when a gamepad is active (toggle in the menu's
  **Controls**). By default, virtual controls show on touch devices and hide
  otherwise; a game that doesn't need them on touch can set a different default
  with `hub.input.setVirtualDefault(false)` (pass `true` to force-show, `null`
  to restore auto). The player's own show/hide toggle always wins over this.
- Keyboard always works; **mouse and gamepad are last-used-wins** (using the
  gamepad ignores the mouse until the mouse moves again). Subscribe with
  `hub.input.on('sourcechange', s => …)`.

### Touch control layout

The hub places every virtual control for the current screen and re-places them
on every resize and rotation:

- **Sticks** sit in their `place` corner, side by side inward.
- **Buttons** cluster *beside* the sticks sharing their corner (stacked in
  columns, three per column). On a screen where that doesn't fit (a 360–430px
  portrait phone with a stick in each bottom corner) every corner cluster with
  sticks moves into **rows above its sticks** (below, for top corners), the
  first-declared button innermost, each side kept to its half of the screen.
  `top`/`bottom`/`center` buttons form a centred row.
- **No overlaps:** auto-placed controls never overlap each other, a stick, a
  `pos`-pinned control or one the player dragged. A button that still has no
  room moves to the nearest free spot.
- Everything stays inside the device **safe area** (notch, home bar), 22px
  from the edges, and clear of the hub's race HUD while it shows.
- **Player layouts win:** a control the player dragged (menu **Controls → Edit
  touch layout**) keeps its spot, stored as % of the screen, across resizes and
  rotations. It is re-clamped on-screen, and nudged to the nearest free spot if
  the rotation would put it on a stick. **Reset to defaults** clears it.

To keep controls off your own HUD:

```ts
// A band along an edge that auto-placed controls avoid (px from that edge).
// Merged with earlier calls; pass 0 to clear an edge. Re-layout is immediate.
const hud = document.getElementById('hud')!;
const sync = () => hub.input.setInsets({ top: Math.ceil(hud.getBoundingClientRect().bottom) });
sync(); new ResizeObserver(sync).observe(hud); addEventListener('resize', sync);

// Or nudge one control away from its anchor's edges (px): x inward from the
// left/right edge, y away from the top/bottom edge.
{ id: 'restart', type: 'button', place: 'top-right', offset: { y: 60 } }

// Or pin it outright (px from the viewport edges; skips the auto layout).
{ id: 'pause', type: 'button', place: 'bottom-left', pos: { left: 18, bottom: 176 } }
```

`setInsets` and `offset` only move auto-placed controls; `pos` and the player's
dragged spots ignore them. A `top` inset also keeps the **hub's toasts** (invites,
messages, "Want a ping when it's your turn?") below your top bar: they sit just
under it instead of over it. Without one the hub looks for the bar itself (a
fixed, absolute or sticky element along the top edge, under the toasts); a bar
drawn on a canvas needs the inset. `setInsets` is newer than some hub builds, so a game
loading `/_hub/hub.js` can guard it: `hub.input.setInsets?.({ top })`.

### Navigable menus (the easy way)

The hub menu is gamepad-navigable automatically. To make **your game's own**
menus (pause, game-over, title) gamepad-navigable, one line is usually enough:

```ts
hub.input.autoNavigate('#pause button, #gameover button, #title button');
// optional: hub.input.autoNavigate(sel, { back: () => resume() });  // B button
```

Pass a CSS selector (or a function returning elements). Whenever any match is
**visible** and a **gamepad** is the active device, the d-pad/stick move a
highlight ring across them and **A** clicks the focused one (**B** → `back`). It
re-queries every frame, so it follows menus showing/hiding — call it once at
startup. It's a no-op for mouse/touch/keyboard (those use the menu natively),
and it does **not** suppress gameplay (your existing pause logic gates that), so
the gamepad's pause/Start still works to resume.

### Navigable groups (full control)

For finer control (or Pixi-drawn UI), mark a group `navigable` to let the
gamepad/keys traverse and activate UI —
real HTML elements (auto bounds + click/focus) or registered Pixi elements
(`getBounds()` + `onAct`). It highlights the active element, emits
`focus`/`blur`/`act`, re-queries elements after each interaction, and opens the
**on-screen keyboard** for text fields.

```ts
groups: { menu: {
  navigable: { next:'navNext', prev:'navPrev', up:'navUp', down:'navDown', act:'navAct',
    elements: () => Array.from(document.querySelectorAll('#pause [data-nav]')) },
  inputs: { navNext:{...}, navPrev:{...}, navAct:{ keys:['Enter'], gamepad:{ button:0 } }, ... },
}}
```

### Focus rings

The input system shows focus only to keyboard and gamepad players. It records
the last input on `<html>` as `data-hub-input`: `keys` (a key or a gamepad),
`pointer` (a mouse or pen) or `touch` (a finger; also the starting value on
touch screens). Typing in a text field and lone modifier keys don't count, so
an on-screen keyboard never switches it to `keys`.

- The navigation highlight (navigable groups, `autoNavigate`, the hub menu) and
  the catalog's `gp-focus` tile highlight show only while it is `keys`.
- While it is `touch`, buttons and links show no focus outline, the browser's
  own ring included.
- The ring is a two-tone `box-shadow` (a dark gap, then a light ring) that
  follows the element's own `border-radius`, so it reads on light and dark
  buttons. Tune it with CSS variables on your page:

  | Variable | Default | What |
  |---|---|---|
  | `--hub-focus-color` | `#fff` | the ring |
  | `--hub-focus-inner` | `rgba(13, 15, 20, 0.85)` | the gap between the element and the ring |
  | `--hub-focus-width` | `3px` | the ring's width |
  | `--hub-focus-gap` | `2px` | the gap's width |

A game with its own focus style can key it off the same attribute, for example
`html[data-hub-input="keys"] .my-btn:focus { … }`, or keep `:focus-visible` and
drop it on touch screens with `@media (hover: none) and (pointer: coarse)`.
`FOCUS_RING_SHADOW` (from `@diffenderfer-games/hub/input`) is the ring as a
`box-shadow` value.

### Remapping & persistence

Players open **Controls** in the hub menu to rebind any input (capture the next
key/gamepad button) and customize virtual controls (show/hide, drag to
reposition). Overrides save to `localStorage` (offline-safe) and sync to the
cloud for signed-in players (reserved `__controls` save). They're merged over
the game's defaults at init — your `define()` stays the source of truth.

> The canonical client is the npm package `@diffenderfer-games/hub`
> (`packages/public/hub`); the hub's build bundles it to `/_hub/hub.js`, and
> `/_hub/sdk.js` is a back-compat shim re-exporting it.

---

## Leaderboards

A game can have **many** leaderboards, each identified by a `boardKey`. A board
stores **one best entry per user**. The first score submitted to a new key
creates the board, setting its title and sort direction; later submissions
can't rename it.

### Declaring boards up front (recommended)

So your boards show on the catalog *before* anyone has scored, declare them in
your `package.json` `game.leaderboards`. The host pre-creates them on boot
(idempotent — safe to leave). Each entry is `{ key, title, sort, showZeros? }`
(`sort` is `"desc"` by default, `"asc"` for "lower is better" like times):

```json
"game": {
  "type": "static", "title": "Geometry Dungeon", "serveDir": "dist",
  "leaderboards": [
    { "key": "arcade-points", "title": "Arcade — Points", "sort": "desc" },
    { "key": "any%-time",     "title": "Any% Time",       "sort": "asc"  }
  ]
}
```

**Zero scores are hidden by default.** A score of exactly `0` is treated as
"hasn't really played" and is omitted from every board view (the catalog, a
game's own board, and a player's own records). If a `0` is a *legitimate* result
for your board (e.g. fewest-deaths, lowest-time), set `"showZeros": true` on the
declaration to keep zeros visible.

**Server-source boards.** An own-server game can add `"source": "server"` to a
declaration. That board then accepts scores **only** from the game's server
(trusted results via `hub-server.mjs`, see `docs/multiplayer.md` §9), and the
browser's `submitScore` to it gets a 403. Use it for competitive online boards.

Declaring is optional — `submitScore` still auto-creates a board on first use —
but a declared board has its title/sort fixed by you, and appears empty
("No entries yet") until the first score. Your game still decides *when* to
submit (e.g. iansaur submits `time`/`creatures` once three levels are cleared).

```js
// Higher is better (default):
await hub.submitScore('arcade-high', 50000, { title: 'Arcade High Score' });

// Lower is better (e.g. speedruns) — set sort once, on first submit:
await hub.submitScore('any%-time', 92.4, { title: 'Any% Time', sort: 'asc' });

// Attach arbitrary context to an entry:
await hub.submitScore('max-level', 12, { title: 'Max Level', meta: { class: 'mage' } });
```

`submitScore` returns `{ board, best, rank }`. Only an *improvement* (per the
board's sort direction) replaces the user's existing entry. Reading:

```js
const { board, entries } = await hub.getLeaderboard('arcade-high', 10);
// entries: [{ rank, userId, username, score, meta }, ...]
```

The root catalog page shows the top entries of every board across all games.

---

## Daily challenges

Opt a game in with `"dailyChallenges": true` in its `package.json` `game` block.
Each daily-enabled game offers **one deterministic challenge per UTC day**; a
player can complete each day once, and can back-fill the **last 30 days**. The
hub:

- shows a **calendar** in the injected menu (in a daily game): days still to
  play are gold, completed days are ✓. A small **calendar rides the menu
  button**: gold while today's challenge is still to play (on the home page:
  while any game's is), green with a check as soon as `hub.daily.complete`
  lands (no reload needed; another tab catches up when it is shown again);
- puts today's calendar badge on each daily game's row in the menu's game
  list and on its home page card: tapping it starts today's challenge (in
  another game through its `?daily=YYYY-MM-DD` deep link, in this game
  through `play`) and a toast confirms it, again on arrival; a green badge
  just says today's is done;
- adds a cross-game **Daily** section to the home page (per-game day chips +
  a global standing);
- auto-creates a per-game **"Daily Challenges"** leaderboard ranked by days
  completed, and a **global** board summing completions across every game.

**When "today" changes.** The daily day is the **UTC date**: a new daily starts
at **00:00 UTC** (8 pm EDT / 7 pm EST, 5 pm PDT, 9 am in Tokyo). The server says
which day it is (`today` in `GET /daily` and `GET /games/:slug/daily`), and
every hub surface uses that one day: the menu button, the month calendar, the
game rows, the home cards and their taps (`?daily=<day>`), and the home sheet's
Daily tab (only without an answer from the hub does a surface use the UTC date
of the device's clock). The calendar lays out daily days as plain dates, so in
the US evening its "today" ring sits on tomorrow's date, and in Tokyo before
9 am on yesterday's. Once today's daily is done, the calendar says when the
next one starts ("New daily in 3h"), and an open menu redraws itself at the
rollover. Games should do the same: use the `day` the hub hands to `play`, or
`today` from `hub.daily.status()`, never the local date.

### Wiring a game (two calls, plus one line to restore)

```js
// 1) Register how a day is played. `seed` is the server's deterministic seed
//    for (game, day) — derive difficulty/level/etc from it. Difficulty should
//    be random (drawn from the seed) so each day feels fresh.
hub.daily.define({
  play(challenge) {        // { day, seed, token, instanceId, saved, savedVersion, resumed }
    if (challenge.saved) return startFrom(challenge.saved);   // a day in progress: back where the player left it
    const rng = mulberry32(challenge.seed);
    const difficulty = DIFFS[Math.floor(rng() * DIFFS.length)];
    startLevel(deriveLevel(rng), difficulty);   // your game's "start this level"
  },
});

// 2) When the player finishes, record it (only if a daily is active).
if (hub.daily.active) hub.daily.complete({ score, difficulty, timeMs });
```

That's it. The menu starts a day (`hub.daily.startAndPlay(day)` → your `play`),
and a deep link `/<slug>/?daily=YYYY-MM-DD` (from the home hub) auto-starts that
day on load. `complete(meta)` stores the metadata and bumps your completion
count. A **failed or abandoned** attempt records nothing: the day stays in
progress, and the player can pick it up again.

**Seed-based vs level-based.** Procedural games derive everything from the seed
(`mulberry32(seed)` → difficulty + layout). Level-based games (a fixed set of
levels) just pick one, e.g. `load((seed % 100) + 1)`. Either way the same date
is the same challenge for everyone, because the seed is server-issued.

> Completion is gated by a short-lived **signed token** the server mints when a
> day starts (so a client can't fabricate completions), and is idempotent — a
> day counts once. Daily runs are kept separate from a game's normal
> progress/boards.

### Days in progress (saved games)

A started day is a **saved game** of its own (see [Saved games](#saved-games)):

- **It is never lost or duplicated.** Starting a day that is in progress (the
  calendar, a `?daily=` link, "Resume") picks it up again, whatever its
  age: the 30-day window only limits *starting* a new day. Any number of days
  can be in progress at once.
- **Winning it any time later gives that day's credit**: the token names the
  day's saved game, and finishing it records that day (a finish on a later
  UTC day is kept with a hidden `backfilled` flag; the credit is the same).
- **`challenge.saved`** is what was last saved for the day (`null` when it
  starts fresh). Games that already use `hub.resume` need no new saving code:
  **`hub.resume.save` during a daily saves to the day**, not to the game's run
  (and `hub.resume.clear()` during a daily starts the day over from its
  seed). A game whose daily state differs from its run calls
  `hub.daily.save({ state, progress })` itself. A game that saves nothing still
  gets the day in "Resume" (its label is "Started"); resuming it replays
  the day from its seed.
- **`cancel()` pauses**: the day stays in progress (and its last save is sent).
  **`discard()`** gives the day up; it can then be started fresh while it is in
  the window. The hub's own lists ask the player before discarding.
- **Switching days doesn't pause for you.** `hub.daily.resume(id)` or
  `startAndPlay(day)` for another day replaces the active day without saving
  it: save the current day first (`hub.resume.save` or `hub.daily.save`) so
  its progress is kept.
- The calendar marks days in progress with ◐, also on days older than the
  window ("Still in progress: Oct 2"), and so does the game sheet's Daily tab.
- Up to 60 days per game can be in progress (409 `too_many_dailies` past it).
- Offline, a day can be started (it gets a device-only id), saved and won; it
  lands on the hub as the one saved game for that day when the connection is
  back.

### `hub.daily` API

| call | what |
| --- | --- |
| `hub.daily.define({ play })` | Register the day-runner (once, at load). `play(challenge)` gets `{ day, seed, token, instanceId, saved, savedVersion, resumed, alreadyCompleted }`. |
| `hub.daily.active` | The challenge being played, or null. |
| `hub.daily.complete(meta?)` | Record the active day with optional metadata and finish its saved game. Ends the daily run at once (`active` is `null` straight away, whatever the hub answers). |
| `hub.daily.save({ state, progress, title?, version? })` | Save the active day (debounced like `hub.resume.save`; works offline). `false` with no daily active, or for a replay of a completed day. |
| `hub.daily.cancel()` | Pause: the player left the daily unfinished (quit, picked another level, started a normal game). Nothing is recorded; the day stays in progress. **Call it** whenever play leaves a daily without `complete`. |
| `hub.daily.discard()` | Give the active day up (its progress is lost; the day can be started again while in the window). |
| `hub.daily.resume(instanceId)` | Pick a day in progress up by its saved game's id (from `hub.saved`), with `challenge.saved`. A no-op while that day is being played. |
| `hub.daily.inProgress()` | This game's days in progress (saved games of kind `daily`). |
| `hub.daily.startAndPlay(day)` | Start (or pick up) a specific day (the menu calls this). |
| `hub.daily.status()` | This game's 30-day window, your completions and your days in progress (`inProgress`). |
| `hub.daily.all()` | Every daily game (with `completions` and `inProgress`) + the global standings (home hub). |

Events: `hub:daily-started`, `hub:daily-resumed`, `hub:daily-complete`,
`hub:daily-paused`, `hub:daily-discarded`, `hub:daily-queued`, `hub:daily-error`.

A daily run lasts from `play` until `complete()`, `cancel()` or `discard()`
(or the page unloads, which is a pause). The hub can't tell on its own that
your game went back to normal play, so while `hub.daily.active` is set, other
features treat the page as in a daily: `hub.resume.save` saves to the day. If
the player can leave a daily any other way than winning it, call
`hub.daily.cancel()` on that path (a level select, "Free play", a new game,
quitting to the title).

---

## Saves and stats

- **Saves** are per user, per game, in named **slots** (`'auto'`, `'slot1'`,
  whatever you like — `[A-Za-z0-9_.:-]`, ≤64 chars). `data` is any JSON up to
  64 KB. Use multiple slots for multiple save files.
- **Stats** are per user, per game numeric values under string keys, with
  `set` / `incr` / `max` update modes. They're readable by anyone (for profile
  pages), so don't store secrets in them.

```js
await hub.incrStat('games_played', 1);
await hub.maxStat('best_combo', combo);
const { stats } = await hub.getStats(); // { games_played: 9, best_combo: 27 }
```

### Cloud-syncing a game that already has a localStorage save

If your game already persists to `localStorage`, keep that as the local layer
and use a single save slot (`'main'`) as the cloud mirror. The pattern the
bundled games use:

- **Push on save** — whenever you write localStorage, also `hub.putSave('main', state)`
  (debounced, fire-and-forget). It's a no-op unless signed in.
- **Pull at boot** — before reading your local save, `await hub.getSave('main')`;
  adopt the cloud copy only when it represents *more* progress (compare a
  monotonic metric like total points), otherwise push your local up to seed it.
  This avoids clobbering local progress.
- **Login mid-session** — listen for the injected menu's `hub:auth` event and
  upload current progress (don't pull — it would overwrite an active game):

  ```js
  window.addEventListener('hub:auth', (e) => {
    if (e.detail.user) hub.putSave('main', state).catch(() => {});
  });
  ```

`hub:auth` fires on the `window` whenever the player logs in or out via the
menu (`e.detail.user` is the user or `null`). Games that have their own local
persistence should construct a **cloud-only** client so failures just fall
through to local rather than to the SDK's own localStorage:
`new Hub({ offline: 'never' })` and wrap calls in try/catch.

---

## Saved games

Everything a player has in progress, in one place: the home page's **Resume**
card (next to *Friends & chat* and *Play online*), its window, the
**Resume** section of the hub menu inside every game, and the **Resume**
tab of each game's card sheet (all called "Your games" until October 2026). There are three kinds, and **players
never see their internal names** ("run", "turn game", "instance"):

| Kind | What players see | How a game makes one |
|---|---|---|
| `run` | "Your saved game" | `hub.resume.save(...)` during a long single-player run ([Saved runs](#saved-runs-hubresume)) |
| `daily` | "Daily challenge · Yesterday" | starting a daily challenge ([Days in progress](#days-in-progress-saved-games)) |
| `turns` | "Online with Sam · your turn" | an online game played over days (`hub.turns`, docs/multiplayer.md §16) |

**Nothing expires.** A saved game leaves the lists only when it is finished,
discarded, or (online) left. The card's line says what is waiting ("Your turn
in 2 · 3 daily challenges · Solitaire"), its pill counts the online games
waiting on the player's move, and the window groups them as players think of
them: **Your turn**, **Daily challenges**, **Saved games**, **Online games**.
Each row has the game's main button (Resume, Play or Open) and, behind "⋯",
Discard (daily and saved games), or Mute, Nudge and Leave (online games),
asking first where it can't be undone.

Saved games are private: a daily or a saved run is its owner's alone; an
online game is visible to its seated players only (and admins, logged).

### `hub.saved`: a game's own "Continue" list

A game can list its own games in progress (in its own style, on its title
screen) and open the one the player picked, wherever they picked it:

```ts
const opened = hub.saved.opened;                     // the Resume window, the menu, an invite: synchronous
if (opened) await openInstance(opened.id, opened.kind);
else showTitle(await hub.saved.list());              // "Continue: Level 12 · Yesterday's daily · Online with Sam (your turn)"
hub.saved.onOpen((game) => openInstance(game.id, game.kind));   // picked from the hub menu while the game runs: no reload
hub.saved.on('change', (games) => refreshContinueList(games));

async function openInstance(id, kind) {
  if (kind === 'run') return startFrom(await hub.resume.load({ version: V }));
  if (kind === 'daily') return hub.daily.resume(id);        // → define().play(challenge), with challenge.saved
  if (kind === 'turns') return showOnlineGame(await hub.turns.open(id));
}
```

A game that only uses `hub.resume` or `hub.daily` needs none of this: the
lists open a saved run with `?hub_resume=1` and a daily with `?daily=<day>`,
which those already handle.

| Call | What it does |
| --- | --- |
| `hub.saved.list({ kinds? })` | This game's games in progress: online games waiting on the player first (oldest turn first), then the newest. Works offline (the device's copies). |
| `hub.saved.listAll()` | Every game's (the home page and the menu). Online, plus this device's copies. |
| `hub.saved.opened` | `{ id, kind }` of the game this page was opened for (`?hub_open=<id>&hub_kind=<kind>`, taken out of the address bar), or `null`. Synchronous. |
| `hub.saved.onOpen(handler, { kinds? })` | Switch to a game of this game picked from the hub menu without a reload (without a handler the page reloads with `?hub_open`). With `kinds` (e.g. `['turns']`) the handler takes only those; the others still reload the page. Returns a function that removes it. |
| `hub.saved.open(id)` | Open one: this game's through `onOpen` (or a reload), another game's by going there. |
| `hub.saved.discard(id)` | Discard a daily or a saved run (the caller asks first). Online games are left with `game.leave()`. |
| `hub.saved.counts()` | `{ yourTurn, dailies, runs, waiting, total }` across every game. |
| `hub.saved.on('change', cb)` | This game's list changed (a save here or on another device, a finish, a discard, a move). |

Each entry is a `SavedGame` (contract `api/saved.ts`): `id`, `game`,
`gameTitle`, `path`, `kind`, `status`, `title`, `progress: { label, fraction }`,
`version`, `createdAt`, `updatedAt`, `daily: { day, seed }` (daily) and
`turns` (online: seats, whose turn, `isMyTurn`, `unseen`, `deadline`), plus
`isLocalOnly` for one saved only on this device so far.

The menu's **Reset game** discards the game's saved run and offers to discard
its daily challenges in progress too; online games are never touched by it.

### Saved runs (`hub.resume`)

A long single-player run (a solitaire deal, level 12 of a climb, a skirmish
against the computer) can be picked up again later, on any device. The game
auto-saves the run with `hub.resume`; it shows in **Resume** with the
game's picture and name, your progress label and bar and "played 2 hours
ago". Resume opens `/<slug>/?hub_resume=1&hub_open=<id>&hub_kind=run`, and the
game restores at once, without asking.

**One saved run per player per game; the latest save wins.** It is private:
only the player who saved it ever sees it (guests too; a guest's runs move
into their account when they log in, unless the account already has a run in
that game: the account's run is kept). It never expires: it is kept until the
game clears it, the player discards it, or the menu's **Reset game**.

**Never for online play.** Multiplayer rooms, races and online games are not
saved runs: `hub.resume.save` returns `false` and saves nothing while the page
is in a hub room, a race or has an online game open (`hub.resume.blockedBy`
says which). **During a daily challenge it saves to the day instead** (see
[Days in progress](#days-in-progress-saved-games)), and `hub.resume.clear()`
during a daily starts the day over. Own-server online games must simply not
call it during online play.

#### Adopting it (five steps)

1. **Declare it** in `package.json`: `"game": { ..., "resumable": true }`. The
   hub refuses saves (404) from games that don't, and only lists theirs.
2. **Save on meaningful changes**, not every frame: a level reached, a card
   moved, a turn ended, the shop closed. Call it as often as you like; the
   client keeps the run on the device at once, sends the latest after
   3 seconds of quiet, sends straight away when the page is hidden or closed,
   and queues it offline (it replays when the connection is back, once).

   ```ts
   hub.resume.save({
     state: { seed, level, board, score },        // what you need to rebuild the run
     progress: { label: `Level ${level} of 30`, fraction: level / 30 },
     title: 'Hard mode',                          // optional: names this run
     version: 2,                                  // your state's shape version
   });
   ```
3. **Clear it when the run ends**: won, lost or quit (`await hub.resume.clear()`).
   A finished run must not stay in Resume.
4. **Restore at load.** `hub.resume.requested` is a synchronous `true` when the
   page was opened from Resume (the client takes `hub_resume` out of
   the address bar first, so a reload or shared link doesn't resume again).
   Read it before you route or draw a title screen:

   ```ts
   const saved = await hub.resume.load<MyState>({ version: 2 });
   if (saved && hub.resume.requested) {
     startFrom(saved);                 // straight back in, no prompt
   } else if (saved) {
     showContinueButton(saved);        // your own "Continue level 12?"
   } else {
     showTitle();
   }
   ```
   A React or other SPA can read `hub.resume.requested` before mounting its
   router and send the player straight to `/play/:id`.
5. **Test it** like `apps-test/resumedemo` (the reference game, "Ten Level
   Climb", and `test/e2e/resume.test.mjs`).

Static games without a build step get the same API on `window.HubSDK.hub.resume`
or `import { hub } from '/_hub/hub.js'`.

#### What to put in `state`

- Everything needed to rebuild the run exactly, and nothing you can derive:
  a seed and the moves made, or the board itself; the score, the timer, the
  RNG state, the player's hand. Not sprites, caches or settings.
- Any JSON, up to **512 KB** measured as the bytes of its JSON (what the hub
  stores; over it, `save` throws a `HubError` 413). Most runs need a few KB.
- **Bigger states** (a long command log): compress it yourself and save the
  result as a string, then decompress after `load`:

  ```ts
  const gz = new Blob([JSON.stringify(log)]).stream().pipeThrough(new CompressionStream('gzip'));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(await new Response(gz).arrayBuffer())));
  hub.resume.save({ state: { gz: base64 }, progress });
  ```
  (For large arrays build the base64 string in chunks.)
- Nothing secret and nothing other players typed: it is only ever shown back
  to the same player, but it is plain JSON on the device and the hub.

#### Writing good progress labels

The label is the line the player reads in Resume, often a kid
choosing between games. Up to 60 characters (longer is clipped).

| Good | Not good |
| --- | --- |
| "Level 12 of 30" | "lvl=12" |
| "Round 3 of 5" | "state 3" |
| "Wave 7, 3 lives left" | "Saved at 14:02" (the card already says when) |
| "34 cards left" | "Klondike" (that's a `title`) |

Give `fraction` (0 to 1) when you can say how far along the run is; the window
draws a bar. Leave it out for open-ended games.

#### Versioning saved state

Pass `version` (a whole number) to `save`, and the same number to
`load({ version })` / `get({ version })`. When your state's shape changes in a
way old code can't read, bump it: a run saved with an older version is dropped
(cleared) and reads as `null`, so the player starts fresh instead of crashing.
A run saved by a *newer* version (another tab already updated) reads as `null`
but is kept. Small additive changes (a new optional field) don't need a bump:
default the missing field when you restore.

#### Moving from your own resume slot

Many games already keep a run in a save slot (`putSave('resume' | 'solo' |
'game' | 'main')`). Migrate once, on load:

```ts
let saved = await hub.resume.load<MyState>({ version: 1 });
if (saved === null) {
  const { save } = await hub.getSave<MyState>('resume');   // your old slot
  if (save !== null && isRunInProgress(save.data)) {
    saved = save.data;
    hub.resume.save({ state: saved, progress: progressOf(saved), version: 1 });
  }
  if (save !== null) {
    await hub.deleteSave('resume');                         // read it once, then drop it
  }
}
```

Keep using your own slots for things that aren't a run in progress (unlocked
levels, settings, a career).

#### `hub.resume` API

| Call | What it does |
| --- | --- |
| `hub.resume.save({ state, progress: { label, fraction? }, title?, version? })` | Save the run (debounced; works offline). Returns `false` in a race, a room or with an online game open; during a daily it saves to the day. Throws a `HubError` 400 without a label, 413 over 512 KB. |
| `hub.resume.flush()` | Send a waiting save now (the page does this itself when hidden or closed). |
| `hub.resume.clear()` | The run ended: delete it (works offline). |
| `hub.resume.load({ version? })` | The saved state, or `null`. The newer of the device's copy and the hub's wins. |
| `hub.resume.get({ version? })` | The same with `{ state, progress, title, version, savedAt }`. |
| `hub.resume.requested` | `true` when opened from Resume (`?hub_resume=1`). Synchronous. |
| `hub.resume.blockedBy` | `'race'`, `'room'`, `'turns'` (an online game is open) or `null` (`'daily'` is no longer returned: a save during a daily goes to the day). |
| `hub.resume.list()` / `discard(slug)` | The player's saved runs across games / discard one (online only). `hub.saved.listAll()` lists every kind. |

Offline, the save is the `hub.resume` outbox kind (endpoints `saveResumeSlot`
and `clearResumeSlot`); a new save or clear replaces the waiting one. The
outbox entry stays small: it sends the run kept on the device
(`hub:<slug>:resume` in `localStorage`), which is also what `load` and the
home page's Resume read while the hub can't be reached. A save that reaches the
hub after a newer one from another device is not applied, and a late clear
never deletes a run saved after it.

---

## Inventory, economy & trading

A **server-owned** layer for games with collectible items and a soft currency:
a per-(user, game) **inventory** (counts of app-defined item keys) and **coin
balance**, plus async **player-to-player trades**. It's generic — any game can
use it. The unit everything moves in is a **bundle**:

```js
{ items: { "42": 3, "7": 1 }, coins: 120 }   // 3× item "42", 1× item "7", 120 coins
```

Item keys are opaque to the hub (`[A-Za-z0-9_.:-]`, ≤64 chars) — their meaning
is the game's. Quantities and coins are non-negative integers.

### What the ledger guarantees (and what it doesn't)

The hub is the authoritative **ledger**: you can never spend, escrow, or trade
away more than you hold (balances can't go negative), and a **trade conserves
goods** — nothing is created or destroyed when items move between players, so
there's no duplication exploit. What it does **not** do is validate *how* you
got an item: **minting via `grant` is client-trusted**, exactly like scores and
saves (the honor system from [Authentication & trust](#authentication--trust)).
So a modified client can mint itself goods — but it still can't dupe them
through trades or take what others won't give. If you need earned-item integrity,
gate `grant` behind logic you trust.

### Inventory

```js
const { items, coins } = await hub.getInventory();   // items: [{ key, qty }]

// Add goods you earned (opening a box, a level reward). Honor-system.
await hub.grant({ items: { "42": 1 }, coins: 25 });

// Atomic swap with "the house" — remove `take`, add `give`, all-or-nothing.
// Selling an item for coins (fails 409 if you don't own it):
await hub.sell({ "42": 1 }, 55);          // take 1× item 42, give 55 coins
// Buying from a shop (spend coins, receive an item):
await hub.buy(120, { "box.rare": 1 });    // take 120 coins, give 1× item
// Or the general form:
await hub.exchange({ coins: 120 }, { items: { "box.rare": 1 } });
```

Every inventory call returns the **new snapshot** `{ items, coins }`, so your UI
can re-render from the response.

### Trades

A trade is an **offer** from one player to another: *"I give you my `give`
bundle if you give me my `want` bundle."* When created, the sender's `give` is
**escrowed** (moved out of their inventory and held on the offer) so it can't be
double-spent. The recipient — typically **on their next login** — resolves it:

```js
// Send an offer (you must own everything in `give`; it's escrowed now):
const { offer } = await hub.createTrade('Brave-Otter-5807',
  { items: { "42": 2 } },           // give
  { coins: 100 },                   // want
  { note: 'two commons for 100' });

// On the recipient's side, list what's waiting and act on it:
const { offers } = await hub.listTrades({ box: 'incoming', status: 'pending' });
await hub.acceptTrade(offer.id);    // atomic swap (you must own `want`)
await hub.declineTrade(offer.id);   // escrow returns to the sender
await hub.counterTrade(offer.id,    // closes theirs, sends a linked reverse offer
  { coins: 60 }, { items: { "42": 2 } });
// The sender can withdraw a still-pending offer:
await hub.cancelTrade(offer.id);    // escrow returns to them
```

Each call returns `{ offer }` shaped from your perspective:

```js
{
  id, status,                       // pending | accepted | declined | cancelled | countered | expired
  direction,                        // 'incoming' | 'outgoing'
  from: { id, username }, to: { id, username },
  give, want,                       // bundles — `give` is what the *sender* offers
  note, parentId,                   // parentId links a counter to the offer it answers
  createdAt, resolvedAt, expiresAt,
}
```

Rules worth knowing:

- **Trading needs a claimed account.** `create`, `accept`, and `counter` require
  a non-guest (so escrow is never stranded on a throwaway cookie); `decline` and
  `cancel` work for anyone. Nudge guests to claim before trading.
- **Offers expire** (default 14 days) — escrow returns to the sender. A merged
  guest's inventory/coins/incoming offers fold into the account on login.
- Address the recipient by **username** (case-insensitive). `listTrades()` with
  no `box` returns both incoming and outgoing.

### Selling, with a confirmation (the dumplings pattern)

Server-owned inventory makes "sell this for coins" a one-call atomic op. Confirm
in the UI first, then commit and re-render from the returned snapshot:

```js
if (confirm(`Sell your ${name} for ${price} coins?`)) {
  const snap = await hub.sell({ [itemKey]: 1 }, price);   // 409 if you don't own it
  renderFrom(snap);                                        // { items, coins }
}
```

## Favorites

Players can **star** games — in a home page card's game sheet (its "⋯" button) or in
the menu's game list. Starred games sort to the top of both (the home page's other
games follow the player's chosen sort, *Most played*, *Playing now* or *A–Z*,
remembered on the device with the rest of the filters). Stars are stored per account (guests too; they follow a guest through
claim/login) and mirrored to `localStorage`, so the list still renders offline.

```js
const { games } = await hub.favorites();          // ['tetrablox', 'flux'] — oldest star first
await hub.setFavorite('tetrablox', false);         // unstar → { games }
```

`setFavorite` needs a connection. Only registered games can be starred (404
otherwise). The menu draws the star buttons, so most games never call these.

## Labels, ages and the home page

List what kind of game yours is in `game.labels`, from a fixed vocabulary (the
contract exports it as `GAME_LABELS`, display names in `GAME_LABEL_TITLES`):

| Group | Labels |
|---|---|
| Genre | `cards` `board` `puzzle` `arcade` `platformer` `real-time-strategy` `physics` `typing` `word` `sports` `racing` |
| Look | `2d` `3d` |
| Plays on | `phone` (touch controls) `controller` (gamepad support) `desktop` (keyboard or mouse only) |
| Players | `multiplayer` `single-player` |

```json
"game": { "type": "static", "serveDir": "dist", "labels": ["puzzle", "2d", "phone", "controller", "single-player"] }
```

An unknown label is a warning (`hub-doctor`, the host's boot log), never an
error; the home page ignores it. The home page's filter bar offers every label at
least one game uses: any label within a group matches, and every group picked
must match (*Puzzle* or *Word*, and *Phone*).

Say who the game is for in `game.ages`, in years: `{ "min": 6 }` for 6 and up (most
games), or `{ "min": 2, "max": 9 }` when it has an upper end. `min` is 2 or more and
`max`, when given, is at least `min` (the contract's `GameAges`). The game sheet
shows it (*Ages 6+*, *Ages 2–9*) and the filter bar's **Age** box shows only the games
whose range holds the age typed. A game without `game.ages` is left out of an age
filter, so `hub-doctor` warns until you add it; a bad range fails `hub-doctor` and
is ignored (with a warning) by the host.

```json
"game": { "type": "static", "serveDir": "dist", "labels": ["puzzle", "2d"], "ages": { "min": 6 } }
```

The home page (served by dg-host, scripted by `/_hub/home.js`):

- **Cards**: plays, how many are playing (*3 playing* on the cover, led by a
  green person when signed-in players are among them and a grey one for guests;
  counts only, hidden at 0), today's daily badge as its own button beside the
  "⋯" (gold to play, a tap goes to today's daily; green with a check when done;
  nothing without dailies), a top-left pill only when the game isn't live
  (*Offline*, *Updating* during a deploy, *Starting* while its server
  restarts), and a "⋯" button.
- **Game sheet** ("⋯"; full screen on phones, a slide-out on wider screens): *Play*
  (play, the ages and labels, star, "tell me when people want to play"), *Leaderboards*, *Daily* (the
  menu's calendar), *Races* (the player's record) and *Stats*; tabs a game doesn't
  support are hidden.
- **Filter bar**: one line with a pill per active choice; it opens to sort (most
  played, playing now, A–Z), *Starred*, *Daily to play* (today's challenge not done
  yet), an age, labels and authors. Saved in `localStorage` (`dg:catalog-filters`).
- **Random**: jumps into a random game among those the filters show (any game that
  is up when none match).
- **Footer**: GitHub, About (what the site is and how it keeps kids safe) and the
  parents' page.

"Tell me when people want to play" is the `lobby_open` notification preference
(claimed accounts only; at most one alert per game every `lobbyOpenCooldownMs`). It
fires for a public lobby or race that waited `lobbyOpenDelayMs`, and for anything
the hub passes to `notifyGameSubscribers(slug, opening)` (tournaments).

---

## What's new (`game.changes`)

Players see what changed since they last looked: a compact **What's new**
button on the home page with a count (it opens the notes, grouped by game, in a
modal with a **Mark all as seen** button) and, in every
game's menu, the ✨ **What's new** button in the drawer's header, with a count (it opens the list).
The menu button gets a small cyan dot while anything is unseen. Nothing to wire
up in code: you only keep a list in `package.json`.

```json
"game": {
  "changes": [
    "Levels 21 to 30 are here! Can you beat them all?",
    "Fixed a bug where the music kept playing after you paused.",
    { "id": "hats", "text": "Your crew can wear hats now. Find them in the shop!" }
  ]
}
```

**Every time you ship something a player would notice, append one line.** Write it
for a player (often a kid): what they can now do or what got better, in plain
words, one or two short sentences. Leave out internal work (refactors, build
changes, test fixes).

| Good | Not good |
| --- | --- |
| "You can now pause with the Escape key." | "Added pause handler" |
| "Fixed the bug where your score reset when you changed levels." | "Fix #42 score state" |
| "Levels 21 to 30 are here!" | "Refactored level loader, bumped vite" |

How it works:

- **Timestamps come from the deploy.** Every host boot (every deploy) reads each
  live game's list. A note the database hasn't seen before is stamped with that
  moment (when it went live). Notes already stored keep their original time.
  A build that fails doesn't touch the game's notes.
- **Identity.** A plain string is identified by its text (case, spacing and
  trailing punctuation are ignored), so **rewording a string announces it
  again**. To reword without re-announcing, use `{ "id": "short-key", "text": "…" }`
  (id: letters, digits, `_ . : -`, up to 64 chars); its text can then change freely.
  Typos you fix in a plain string will show as a new note, so use an id for long-lived notes you may edit.
  To reword a plain string that is **already published** without announcing it again, replace it with
  `{ "id": "h:<hash>", "text": "…" }`, where `<hash>` is the first 16 hex characters of the sha1 of the
  old text, lowercased, spacing collapsed and trailing punctuation dropped (the hub's `changeKey`):
  the note keeps its key and its date, and only its text changes.
- **Removing** a note from the list stops it showing (it stays in the database,
  and keeps its date if you put it back). Order doesn't matter, but appending
  keeps the file readable. Up to 200 notes are read, 280 characters each.
- **What's listed:** notes from the last **30 days**, at most **6 per game** and
  **30 in total**, newest first. Hidden (`game.hidden`) and removed games never show.
- **What counts as new** (per player, guests included, kept across guest →
  account): a note is new when it went live after the player last cleared it
  *and* after their account was created. Brand-new players aren't handed the
  whole history.
- **Clearing.** "Got it" in a game's menu marks **that game's** notes and the
  host's own notes as seen (that's what the game's list shows). **Mark all as
  seen** on the home page (or "Got it" in the home page's menu) marks
  **everything** seen, across all games.
- **Signed out** (home page with no session): the device remembers when it
  last cleared (`localStorage` `dg:changes-seen`, shared by the panel and the
  menu). A first visit starts that clock, so it shows nothing yet.
- **The host's own notes** (menu, friends, chat, home page…) live in the same
  field in the diffenderfer-games repo's `package.json` and show as
  "diffenderfer.games" on the home page and in every game's list.

The API (most games never call it): `GET /_api/changes[?game=slug]` and
`POST /_api/changes/seen`, see [Endpoint reference](#whats-new-handlerschangesjs).

---

## Server data and backups (`game.data`)

Everything the hub keeps (accounts, saves, scores, saved games…) is in its own
database and is backed up for you. A game that runs **its own server** and
writes files on the box (a SQLite database, JSON files, uploaded images) must
say where, so the admin backup takes them too and a restore puts them back:

```json
"game": {
  "type": "process",
  "start": "node server/server.js",
  "data": [
    { "path": "server/data.db", "kind": "sqlite" },
    "server/uploads"
  ]
}
```

- `path` is relative to the game's folder and may not leave it (letters,
  digits, `.`, `_`, `-` and `/`; no `..`). At most 20 paths.
- `kind: "sqlite"` is one SQLite database file. The backup takes a consistent
  hot copy while your server keeps running (SQLite's online backup), and a
  restore drops the file's stale `-wal`/`-shm` sidecars. Declare every
  database this way, never as part of a folder.
- `kind: "files"` (or a bare string) is a file or a whole folder, copied as
  is. Write files atomically (write a temp file, then rename) so a copy never
  catches one half-written. A restore replaces the whole folder.
- Paths that don't exist yet are fine (nothing is copied); a restore then
  leaves the live copy alone.
- The admin's Backups tab lists process games that declare nothing as **not
  backed up**. Static games have no server and need nothing.
- A restore replaces your files only while your server is stopped: dg-host
  applies it at its start, before any game server runs. Your server just
  reads its files at start as usual.

How backups and restores work, and the disaster-recovery runbook, are in
`DEPLOY.md` §11a.

---

## Social & multiplayer

The hub runs one kid-safe social layer for the whole site. Games get it with no
code; online games opt into more. **The implementer's guide is
[`docs/multiplayer.md`](multiplayer.md).** The design and the wire contract
are in `docs/plans/multiplayer.md` / `docs/plans/multiplayer-impl.md` in the hub
repo.

- **For every player, in every game:**
  - **friends** (added by exact username or from a player card) and **presence**
    ("🟢 Playing Flux · Level 3"), friends only, with privacy and blocks;
  - **direct messages** between mutual friends only, safety-checked *before*
    delivery;
  - **invites** into any online game, and **parties** that move between games;
  - **game suggestions** with a public upvote board;
  - opt-in **browser/phone notifications** (`dm`, `friend_request`,
    `friend_online`, `lobby_open`);
  - **report/block** on every name and message.

  Guests get rooms and quick-chat but no friends, DMs, invites or notifications.
- **How it loads:** the injected `menu.js` loads **`/_hub/social.js`**, which opens
  one WebSocket per tab (`/_ws`), renders the Friends card (which opens the Friends window), toasts and dialogs,
  and installs `window.__HUB_RT__`. The client namespaces forward to it, queueing or
  replaying until it arrives.
  - `hub.presence.set({ kind, detail?, joinable?, watchable?, room?, public?, openSeats?, mode? })` / `.clear()`
  - `hub.social.openPlayer({userId}|{username})`, `openFriends()`, `openChat(id)`,
    `openInvite({userId?, mode?})`, `openSuggest()`, `openNotify({game?})`,
    `friends()`, `counts()`, `chatMode(userIds?)`, `on(ev, cb)`
  - `hub.mp.onLaunch(cb)`, `onJoinInfo(cb)`, `invite(userId, {mode?})`,
    `setBusy(busy, {label?})`, `ticket()`, `setJoinInfo(partyId, info)`, `party()`,
    `inviteLink()` / `revokeInviteLink(token)` (invite links, `docs/multiplayer.md` §7)
  - `hub.rooms.create(opts)` / `join(codeOrId, {spectate?})` / `list({mode?})` /
    `reclaim()` → a room handle with `seats()` and
    `ready/seat/start/send/setState/chat/quick/kick/leave/end`, and
    `on('room'|'msg'|'state'|'chat'|'seat'|'kicked'|'closed'|'abandoned', cb)`;
    `seat` (`away`/`back`/`gone`) is how a game hands a dropped seat to its computer
    player and back (`docs/multiplayer.md` §8, Resilience)
  - `hub.notify.setQuiet(quiet)`
  - `hub.race.define({start, end?, exit?, hud?})`, `create({params, public?})`, `join(code)`,
    `list()`, `browse()`, `openHistory()`, `history()`, `status(stats, progress?)`,
    `finish(stats?)`, `lose(stats?)`, `forfeit()`, `leave()`, `rematch()`, `current()`, `on(ev, cb)`
    — races, opted in with `game.race` (`docs/multiplayer.md` §14)
- **Opting a game in** is the `game.multiplayer` block in `package.json`
  (`lobby`, `players`, `transport: "hub-rooms" | "own-server"`, `invites`, `join`,
  `spectate`, `modes`, `quickChat`, `chatAllow`). The catalog shows an **Online**
  tag, and `GET /games` exposes a summary for the invite picker. A game played
  online over days (`game.turns`, `docs/multiplayer.md` §16) gets a `turns`
  summary (`players`, `modes`) instead, and the picker lists it too: picking it
  starts an online game with the friend invited.
- **Own-server games** keep a copy of the zero-dependency game-server SDK in
  `server/hub-server.mjs` (not on npm; served at `/_hub/hub-server.mjs`, built from
  `packages/server/server-sdk`; `npm run sync-hub-server` in the game copies
  it from the sibling host checkout). With it
  they verify 60-second identity tickets offline, check chat, and post trusted results
  through the loopback-only `/_api/internal/*` routes. The host injects
  `HUB_URL` and `HUB_APP_KEY` into hub-enabled process apps.
- **Pages:** **`/parents`** is a plain-language page for parents (how chat is kept
  safe, the parent chat lock, the contact link), written to match the live config.
  **`/_admin`** is the admin console (suggestions, reports, moderation log, filter lab,
  users and suspension, live switches). It's a 404 for anyone who isn't an admin.

## Avatars

Every player has an avatar: a cartoon head and a small body "blob" built from
pieces the hub drew. Players make theirs in the hub's **"Make your avatar"**
designer (guide: [`avatar-designer.md`](avatar-designer.md)). Players who never
make one get a stable default generated from their user id, so everyone has a
face. A look is presets and colours only (no text, uploads or drawing), so it is
kid-safe by construction. The design is `docs/plans/avatars.md` (§14 has the
decisions, including the art style).

**The rule for games:** show players' avatars wherever you show their names, and
never draw your own faces for real players. Computer players keep their own
characters (or use `hub.avatar.bot(seed)`).

### Where the avatar comes from

A look travels as a short **code** (`AV1…`, about 20 characters). It is already
on every payload that carries a player, so most games never fetch anything:

| Payload | Field |
|---|---|
| `hub.me()` user, the `hello` snapshot, `SocialMe` | `look` |
| `PlayerLite` (friends, player cards, recent players, tournament entrants and brackets, Play online hosts) | `look` |
| `RoomSeat` (refreshed live when a seated player changes their avatar) | `look` |
| race racers, result players and race history (`''` for a hidden racer) | `look` |
| leaderboard entries | `look` |
| own-server tickets (`@dg/hub-server`'s verified `user`) | `look` |

The older `avatar` token (`a0`…`a23`) is still sent for clients pinned to an old
version; new code should use `look`. `''` means the player is hidden from you:
draw the silhouette (every renderer does this for you).

### `hub.avatar`: looks without the renderer

The root client has a small `hub.avatar` namespace with no art and no renderer:

```ts
import { hub } from '@diffenderfer-games/hub';

const me = await hub.avatar.mine();          // { code, look, isDefault, hidden } (works offline from the device cache)
const meNow = hub.avatar.mineSync();         // the cached one, or your default; null while nobody is signed in
const myId = hub.userId();                   // your user id, or null (see Who you are)
const them = await hub.avatar.of(userId);    // batched with other calls in the same tick, cached
const seats = await hub.avatar.many(ids);    // Map<userId, AvatarRef>
const fromSeat = hub.avatar.from(seat);      // anything with `look` (and `userId`/`id`): no request
const bot = hub.avatar.bot('uno:bot:2');     // a seeded default for computer players and local seats
hub.avatar.on('change', ({ userId, ref }) => { /* someone you can see changed theirs */ });
await hub.avatar.openDesigner({ reason: 'game' }); // "Make your avatar" over the game → { saved }
const kit = await hub.avatar.load();         // the renderer below, with its art ready
```

`hub.avatar.save(look)` saves your own look (queued offline, latest wins); the
designer is the usual way.

**Wait for `change`; don't poll.** `change` fires whenever a look you can see
differs from the one the page last had: someone changed theirs, your account
appeared (a first-time guest's account is made by the menu just after the game
starts), or the live connection came back and a change sent while it was down
is fetched again. Before your account exists `mine()` resolves at once with a
default look (and `mineSync()` is `null`); your own look then arrives as a
`change` with your `userId`.

#### Who you are

`hub.userId()` is your user id (`null` while nobody is signed in). It is
synchronous and needs no `hub.me()`: it follows the menu's new-guest account,
sign-in and sign-out, and the live connection. Use it to find your seat and to
pick your own changes out of `change`:

```ts
const isMine = (seat: { userId: number | null }) => seat.userId !== null && seat.userId === hub.userId();
hub.avatar.on('change', ({ userId, ref }) => {
  if (userId === hub.userId()) myBadge.setLook(ref.code);   // yours, including the first one
  else seatFor(userId)?.setLook(ref.code);
});
```

### `@diffenderfer-games/hub/avatar`: the renderer

```ts
import { ready, render, animator, lookToward, layout } from '@diffenderfer-games/hub/avatar';
await ready(); // loads the art chunk once; renders are synchronous after this
```

Every render takes a **look-like**: a code, an `AvatarLook`, an `AvatarRef`, or
`null` (the silhouette). Options (all optional):

| Option | Meaning |
|---|---|
| `size` | px of the longer edge (default 48) |
| `frame` | `'head'` (a badge, the default), `'bust'` or `'full'` (the whole character, feet at the bottom) |
| `background` | `'badge'` (the site's rounded panel and ring; default for `head`), `'none'`, or a `#rrggbb` |
| `facing` | `'S'` (default), `'SE'`, `'E'`, `'NE'`, `'N'`, `'NW'`, `'W'`, `'SW'` (or `view: 'front' \| 'back' \| 'left' \| 'right'`) |
| `pose` | `{ expression, look: {x, y}, blink, talk, body, phase, status }` (an animator's `pose(t)` fills all of it) |
| `title` | the accessible name ("Sam's avatar"); without it the avatar is decorative (`aria-hidden`) |
| `rim` | a light edge for dark scenes (the world) |

#### DOM

```ts
// Markup (safe to insert: catalog paths and derived colours only)
chip.innerHTML = render.svg(seat.look, { size: 40 });

// A live element that re-renders only when the pose changes
const face = render.element(seat.look, { size: 40, frame: 'bust' });
chip.append(face.el);
face.update(anim.pose(performance.now()));

// The custom element (call defineAvatarElement() once; /_hub/avatar.js does it for you)
import { defineAvatarElement } from '@diffenderfer-games/hub/avatar';
defineAvatarElement();
```

```html
<dg-avatar look="AV1…" size="48" expression="happy" look-x="-1" animate title="Sam's avatar"></dg-avatar>
```

`<dg-avatar>` takes `look`, `size`, `frame`, `facing`, `expression`, `look-x`,
`look-y`, `body`, `status`, `background`, `title` and `animate` (blinks and
idles at up to 30 fps while connected). Its `animator` property gives full
control. **In React**, write `class`, not `className`, on `<dg-avatar>`, and
pass every option as an attribute string: `<dg-avatar class="seat-face"
look={seat.look} size="40" animate="" />`.

#### Canvas 2D

```ts
render.canvas(ctx, seat.look, { x: 10, y: 10, size: 64, pose: anim.pose(now) });       // the frame box's top-left at (x, y)
render.canvasAt(ctx, seat.look, { x: px, y: py, scale: 0.4, facing: 'SE', pose });      // feet at (x, y), px per rig unit
const bitmap = await render.bitmap(seat.look, { size: 64 });                            // ImageBitmap (cached)
const url = await render.dataUrl(seat.look, { size: 64 }, 'png');                       // or 'svg'
```

#### PixiJS (`/avatar/pixi`; pass your PIXI, the hub has no pixi dependency)

```ts
import * as PIXI from 'pixi.js';
import { animator } from '@diffenderfer-games/hub/avatar';
import { pixiAvatar, avatarTexture, createCrowd } from '@diffenderfer-games/hub/avatar/pixi';

const anim = animator(seat.look, { seed: seat.userId });
const face = pixiAvatar(PIXI, seat.look, { size: 64, animator: anim });
stage.addChild(face.view);                       // a Sprite, anchored at its centre
app.ticker.add(() => face.update(performance.now()));
const still = avatarTexture(PIXI, seat.look, { size: 64 });   // a still Texture (works on Pixi 7 too)
```

The adapters take pixi's real namespace (`import * as PIXI`) or an object of
the named imports, and give back **pixi's own types**: `face.view` is a
`Sprite` and `avatarTexture` a `Texture`, so they go into a `Container` with no
cast. Nothing to declare:

```ts
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { pixiAvatar, type PixiAvatar } from '@diffenderfer-games/hub/avatar/pixi';

const PIXI_FOR_AVATARS = { Container, Rectangle, Sprite, Texture };  // or pass it inline
const seatFace: PixiAvatar<Sprite> = pixiAvatar(PIXI_FOR_AVATARS, seat.look, { size: 48 });
seatLayer.addChild(seatFace.view);              // a pixi Sprite
```

For crowds (the world, big lobbies), `createCrowd(PIXI, { atlas: createAtlas(), container })`
bakes looks into shared atlas pages (time-sliced), y-sorts one container, and
draws up to six `live: true` avatars as full vector faces:
`crowd.set(id, { look, x, y, facing, body, status, name, friend, you, activity, emote })`,
`crowd.update(t)` once a frame, `crowd.remove(id)`.

#### three.js (`/avatar/three`; pass your THREE)

```ts
import * as THREE from 'three';
import { avatarCanvasTexture, avatarSprite } from '@diffenderfer-games/hub/avatar/three';

const { sprite, avatar } = avatarSprite(THREE, me.code, { frame: 'head', size: 128, height: 0.4 });
helmet.add(sprite);
avatar.update(anim.pose(now));                   // redraws at most 30 times a second, only on change
const tex = avatarCanvasTexture(THREE, me.code, { size: 128 }); // a CanvasTexture for your own material
```

The same goes for three.js: pass `THREE` or the named imports
(`{ CanvasTexture, SpriteMaterial, Sprite, SRGBColorSpace }`; `avatarCanvasTexture`
needs only `CanvasTexture`) and you get three's own `Sprite` and
`CanvasTexture` back, ready for `scene.add(sprite)` or
`new MeshBasicMaterial({ map: tex.texture })` with no cast or subclass.

#### No build step

```html
<script type="module" src="/_hub/avatar.js"></script>
<script type="module">
  const { render, animator } = window.HubAvatar;   // also .pixi and .three
</script>
```

`hub.avatar.load()` in `/_hub/hub.js` loads this same file at run time. Servers
and workers use `@diffenderfer-games/hub/avatar/svg` (`ready`, `renderSvg`, no
DOM), and plain `<img>` tags can use the hub's server-rendered
`/_hub/avatar/<code>.svg?s=64&f=head&e=happy&lx=-1&ly=0&b=badge` (cached
forever per code).

### Expressions and gaze

Faces move by parameters, not drawings, so any expression combines with any
gaze, blink and talking.

- **Expressions (16):** `neutral`, `happy`, `laugh`, `grin`, `sad`, `cry`,
  `surprised`, `shocked`, `angry`, `grumpy`, `thinking`, `wink`, `smug`,
  `worried`, `sleepy`, `determined`. Blend two with `mix('happy', 'surprised', 0.4)`,
  or pass your own `FaceParams`.
- **Gaze:** `look: { x, y }` in [−1, 1] (x right, y down) moves the pupils and
  turns the head a little. `lookToward(fromPoint, toPoint)` turns two screen
  points into a gaze, for card tables where every seat looks at the active player.
- **The animator** is pure in time: calls append to a schedule and `pose(t)`
  evaluates it, so it works in any loop, in tests and in replays.

```ts
const anim = animator(seat.look, { seed: seat.userId });   // blinks every 2–6 s, idles
anim.express('happy', { holdMs: 1500 });   // then back to the base face
anim.setBase('thinking');                  // the resting face
anim.lookAt(lookToward(seatPos(seat), seatPos(active)));
anim.talkFor(1200);                        // or talk(true/false), talkLevel(0..1) from audio
anim.react('cheer');                       // nod, shake, bounce, cheer, gasp, flinch, shrug, sleep, wave
anim.feel('victim');                       // win, lose, bigPlay, victim, waiting, yourTurn, idle
const pose = anim.pose(performance.now());
```

**Use `feel()` for game events** so every game reacts the same way: `win`
(laugh and cheer), `lose` (sad), `bigPlay` (grin and bounce), `victim` (shocked
and flinch, e.g. hit by a +4), `yourTurn` (determined and a nod), `waiting`
(thinking). `expressionFromEmote('e:😂')` maps the hub's quick-chat emotes to
faces. **Reduced motion** (`prefers-reduced-motion`, or `reducedMotion: true`)
turns off the bob, sway and reaction movement, keeps blinks and expressions
(with quick cross-fades), and shows a still open mouth for talking.

### Bodies, facings and the world

`pose.body` is `idle`, `walk`, `run`, `sit`, `play`, `wave`, `cheer`, `jump`,
`dance` or `away`; cycle poses read `pose.phase` (0 to 1).
`pose.status` adds a runtime prop: `goggles`, `headset`, `cards`, `controller`,
`trophy`, `crown` or `book` (never stored in the look). `facingFrom(dx, dy, 8)`
turns movement into a facing. `layout(look, { facing, pose })` returns the rig's
anchors (`feet`, `head`, `eyeLine`, `mouth`, `hatTop`, `nameplate`, `bubble`,
`seat`, `prop`, `pod`, …; feet at (0, 0), y down, the head about 100 units
tall): place name plates and bubbles with these, never with magic numbers.
`overlays.nameTag({ name, friend, you })` (a friend gets a green dot and a ★),
`activityBubble({ game })`, `emoteBubble(emote)`, `reactionBubble('!' | '?' | '…' | 'zzz' | '♥')`
and `selectionRing()` draw the world's overlays the same way everywhere
(`overlaySvg`, `paintOverlay`).

### New parts and older game builds

The catalog grows by appending (`CATALOG_REVISION`; revision 3 added eight
glasses and lens tints). Every saved code keeps decoding to the same avatar.
A game draws avatars with the renderer and art **bundled in its own copy** of
`@diffenderfer-games/hub/avatar` (`hub.avatar.load()` imports it from the
package, not from the host), so an npm game shows new parts once it upgrades
the package; until then it draws a part it doesn't know as its fallback (an
unknown pair of glasses is left off), and a lens tint is skipped. Static games
on `/_hub/hub.js` and the hub's own surfaces (menu, Friends, designer) update
with the host.

A look's glasses can carry a second colour, `tint` (the lens, from the `lens`
palette or any colour), only on glasses tagged `tinted` (`isTinted(id)`);
`FRAME_PRESETS` is the designer's order of frame colours (accessory presets).
Long hair hangs **behind** the body: the renderer draws the parts of a hair
style below the shoulder line before the body, and the rest over the head.

### Accessibility and wording

Avatars are decorative next to a name. Give a `title` ("Sam's avatar") only
where the avatar stands alone, and use `describe(look)` ("Short curly auburn
hair, green eyes and freckles.") where the avatar is the content.
`avatarEmoji(look)` gives a person emoji with the nearest skin tone for plain
text. Players see "avatar", "Make your avatar", "Edit avatar", never "look",
"code", "default" or "preset".

### Performance

- **Up to about 12 on screen** (card tables, race HUDs): live faces, one
  `pose(t)` each per frame. `render.element` and the adapters re-render only when
  the quantised pose changes, so a still face costs nothing.
- **Up to about 40** (lists, brackets, leaderboards): still SVGs or cached
  bitmaps, animated only on events.
- **Crowds** (30–200): `createCrowd` with the atlas, at most six live faces
  (two on low-end devices), bakes time-sliced at about 4 ms a frame; an avatar
  shows the silhouette until its frame is baked.
- **Bundle cost:** the root client gains `hub.avatar` (the codec and defaults,
  no art). `/avatar` loads its art chunk lazily on `ready()`; `/_hub/avatar.js`
  is about 34 KB gzipped with the art. Games that never import `/avatar` pay
  nothing for the renderer.
- Never use Pixi's `arc()` for avatar shapes (it draws a stray line from the
  origin in this codebase's Pixi); the renderer builds everything from paths.

---

## The world (`game.world`)

The hub has a walkable world: tile-map rooms where players' avatars walk, sit at
tables and use portals between rooms (design: `docs/plans/world.md`). The hub's own
rooms (`lounge`, `park`, `station`, `camp`) need nothing from games. A game can have
**its own room**, served as the world `game.<slug>`:

```jsonc
"game": {
  "world": {
    "map": "world/lobby.json",            // optional: a committed dg-world@1 map file (wins when valid)
    "generate": {                          // optional: generate it (or the fallback for a bad file)
      "type": "lounge",                    // a hub world type: lounge, park, station, camp
      "seed": "garbage",                   // default: the game's slug
      "needs": { "tables": 6, "game": "Garbage", "portals": ["park"] }
    }
  }
}
```

- Give `map`, `generate` or both. The hub reads the map file at load, checks it
  (shape, sizes, every spot reachable, a `start` spawn) and runs its text (title,
  labels, game names) through the content filter; a missing or invalid file falls
  back to `generate`. **The hub never runs a game's script**: generate your map at
  build time and commit the JSON.
- Make maps with `@diffenderfer-games/world` (the generator, builder and validator) or
  in [Tiled](https://www.mapeditor.org/) and convert: `npx dg-world from-tiled
  world/lobby.tmj world/lobby.json` (and `to-tiled` back). `npx dg-world check
  world/lobby.json` prints every problem. A map file is at most **256 KB**; layers are
  saved compressed (`"encoding": "rle"`). Bump the map's `revision` when you change it.
- Same seed and needs, same map: a generated map records its `generatorVersion`, and
  the hub serves every map under a content hash, so players fetch it once per change.
- **`npx hub-doctor`** checks a `game.world.map` file (it exists, is valid and is
  within the size limit) and warns about an unknown world type.

The live world runs over the hub socket (`world.*` ops and events, contract
`realtime/ops/world.ts`): the hub referees every step with the same collision code
the client walks with, shows each player the others near them, overflows a full room
into a second instance (entering or walking through a door to a friend joins *their*
instance when it has room), and remembers where each player stood. The map file is
`GET /_api/world/maps/<key>?rev=<rev>`. Games don't call any of this.

**Adventure Mode** is the world as players reach it: the top card on the home page
and in the hub menu (it glows each time a player sees it, a page load or an opening
of the menu, for about 13 s; a still border for less motion) opens `/world` (`/world/<place>` deep-links; `/world` alone
goes back to your last world, the Hall the first time). Guests can come in. dg-host
serves the page; `/_hub/adventure.js` loads `/_hub/world.js` and `/_hub/avatar.js`.
The hub menu works inside (the world's input pauses under it, `hub.overlay.autoPause`),
and **To All Games** (in the world's top bar, and the menu's top card there; once called
Library Mode) goes back to the games. The top bar shows the place's name ("The Hall"). In it:

- **Walking and running:** you walk 6.3 tiles/s; hold **Shift** to run half as fast again
  (9.45), on any walk (keys, a click, a walk to a friend). A gamepad's left stick or d-pad
  walks, and the stick pushed all the way (or RB/RT held) runs; on a phone a far tap runs
  until you are close. The hub referees up to the run speed with headroom
  (`worldWalkSpeed`, `@dg/hub-internal/world-pace`).
- **Walk to a friend:** Friends lists the friends in the world and where (only friends
  who show you their presence; never across a block). "Walk to" asks `world.find` for
  their world, instance, cell and the portals on the way (the portal graph's fewest-hops
  route, `planWorldRoute` in `@diffenderfer-games/world`), then walks the A* path to
  each door and through it, step by refereed step, to a free cell beside them, facing
  them. It follows them if they move and stops when you move yourself, they leave or
  hide, or no door leads there.
- **Say something** (and Enter on a keyboard) puts a bubble over your head for a few
  seconds. Quick-chat phrases and emotes go to everyone who can see you (emotes only
  in quiet zones; nothing when chat is off). **Typed text only when your chat allows
  it** (`WorldPlace.chat` is `on`: not a guest, no parent lock, a friend to type to),
  moderated like all chat (the 422 hint, the draft kept, softening, mutes), and
  delivered **only to your mutual friends who can see you**; strangers never receive
  it (docs/plans/multiplayer.md: free text only between mutual friends). Rate-limited
  (`worldSayPerFiveSec`).
- **Tips:** a first visit shows seven short tips, each done when the player does the
  thing or taps Got it (Skip tips ends them; ? in the top bar shows them again), kept
  per player in localStorage.

### Playing over the world (`game.embed`)

In the world, **arcade cabinets and game spots** (tables, the race grid, consoles)
play a game. Walk up and press **E** (or tap the prompt, or click the thing): the game
opens **in a box over the world**, which keeps running behind a gentle blur (other
players keep walking), or, when it can't, as its own page. A game says it works in
the box, and how big it likes to be, with `game.embed`:

```jsonc
"game": {
  "embed": {
    "supported": true,
    "size": [480, 720],             // the ideal size, CSS px; or { "w": 800, "h": 600, "aspect": 1.333 }
    "minScale": 0.7,                 // optional (default 0.7): the smallest scale the box may use
    "frame": "embed/cabinet.svg"     // optional: an SVG drawn round the box (the format below)
  }
}
```

- **When the box is used (the 70 % rule):** the world fits the game's `size` (plus its
  frame, or the hub's neon bezel, and the control bar) into the window, never above
  scale 1. When that scale is at least `minScale` (0.7), the game plays over the
  world; otherwise (a phone, a small window, `supported: false`, no `game.embed`) the
  world goes to the game's page. `aspect` keeps the game's shape (letterboxed) when
  the player fills the window; without it the game gets the whole window and lays
  itself out. If the window shrinks while it plays, a note offers "Play it full size".
- **Nothing else over the box:** while a game is open the hub menu's button (and its
  corner peek spot) hides, so the box's own icons are the only controls; the game's
  Select still opens the menu, and the button is back when the game closes. The "Add to
  your home screen?" bar is never offered in Adventure Mode (`/world`), only on the home
  page and the games' pages.
- **The box:** your normal page in an iframe at `/<slug>/?hub_embed=1` (same origin;
  `allow="autoplay; fullscreen; gamepad"`). Top right, three icon buttons: **go to**
  (the game's own page), **fill the window / back to the cabinet**, and **exit** (back
  to the world). It powers on and off like an old screen; with less motion it just
  appears.
- **One menu:** with `?hub_embed=1` the injected menu hides its button, the intro is
  skipped, and the world's menu is the menu. Select/Start (and anything that opens the
  hub menu) opens the world's; hub UI opening over the box pauses the game through
  the usual `hub.overlay.autoPause` (the page's overlay stack gets a `menu` entry), so
  **a game already wired for autoPause needs nothing new**. Saves, stats, boards,
  presence and online play work as on the page.
- **Focus and input:** the world's own input pauses while the box is open; keyboard and
  gamepad focus go into the game (Tab stays in the box). **Esc leaves** unless the game
  handled the key (call `event.preventDefault()` on the Escape keydown you use, e.g.
  to pause or to go back a screen); **holding B** on a gamepad for 0.6 s leaves (a
  short press is yours; the exit button fills a ring while it's held).
- **Audio:** the iframe is allowed to autoplay after the tap that opened it; unlock
  your `AudioContext` on the first gesture as usual. The world has no sound of its own,
  so nothing competes. Closing the box removes the iframe (the game stops).
- **Check your game embedded:** open `/<slug>/?hub_embed=1` in an iframe of the same
  origin; no frame-busting (`top.location = …`), no `X-Frame-Options`/`frame-ancestors`
  that forbid the site itself, and it must lay out at any size near `size`.

**The frame format ("dg-frame").** An SVG drawn round the box; the iframe is laid over
its screen. Rules (`sanitizeFrameSvg` in `@diffenderfer-games/hub-contract`, run by
`hub-doctor`, the hub and the host):

- one `<svg>` root with `viewBox="minX minY width height"` (plain numbers);
- **the screen:** exactly one `<rect data-screen …>` (or `id="screen"`) with
  plain-number `x`, `y`, `width`, `height` (and optional `rx`, the iframe's corner
  radius), inside the viewBox, with no `transform` on it or its groups. Make its shape
  match `size` (the doctor warns past 3 %); the frame scales so its screen is the
  game's width;
- vector art only: shapes, paths, text, gradients, patterns, clip paths, masks,
  filters, markers, `<use href="#local">`, a `<style>` sheet, and SMIL `<animate>`,
  `<animateTransform>` and `<set>` of visual attributes (blinking bulbs, a marquee);
  players who ask for less motion get a still copy;
- **refused (the frame is not used, the hub's bezel is drawn):** `<script>`,
  `<foreignObject>`, `<image>`, `<a>`, `on*` handlers, any reference that isn't
  `#local` (`href`, `url(…)`), `javascript:`/`data:`/`http:` URLs, `@import`, CSS escapes,
  animating `href`, DOCTYPEs, entities and processing instructions; at most **256 KB**,
  4000 elements, 32 deep. Editor data (Inkscape, Sodipodi, `<metadata>`) is dropped
  with a warning.

The host serves the sanitised copy (never your file) at `/_frames/<slug>.svg?v=<hash>`
(`&still=1` for the still copy) with a CSP that allows nothing but inline styles. The
catalog (`GET /_api/games`) lists each game's `embed` (`w`, `h`, `aspect`, `minScale`
and, with a valid frame, its URLs, viewBox and screen). Example: Bubble Pop's arcade
cabinet (`embed/cabinet.svg` in its repo).

**The arcade's cabinets** play the catalog's games that play over the world first,
then its other arcade games. **Tapping a game spot** (or clicking it) walks you to it
(the cabinet's front, a free seat at a table: `useCells` in `@diffenderfer-games/world`),
turns you to face it and shows the prompt; tapping it again, the prompt, or **E**
plays. Sitting down at a table from its prompt plays at once. As a spot starts to
glow, a bubble with the game's cover and name pops up over it for a few seconds.

**Doors into games' rooms.** Every game with `game.world` gets a door into its room,
generated from the catalog: in its family's room (`roomTypeForLabels`: the card room,
the board-game café, the arcade, the war room) where the wall has space, else in the
Hall. Each door has a name plate with the game's cover, the room's way out leads back
to that door (unless the game's `needs.portals` says otherwise), and walking to a
friend routes through it. **Near any door or portal**, a sign beside it says where it
goes and which games are there (a game room's game; a room's game-room doors, cabinets
and spots, a few and "+N more"); tap a game on it to play.

## Content safety & the rejection contract

**Everything players type** is checked server-side before it's stored or shown:
DMs, room/party chat, suggestions, usernames (signup/claim/rename), per-game
`displayName`, trade notes, presence `detail` and room names. The pipeline is:

1. shape limits;
2. a character allowlist;
3. normalization (leet, repeats, separators);
4. word/phrase lists;
5. link, contact and personal-info detectors;
6. **softening** of game-violence words ("kill" → "reduce to 0 HP", "bomb" →
   "confetti cannon", "shot" → "zapped");
7. spam and shouting checks, strikes and mutes;
8. an optional **AI reviewer** (OpenRouter, configured by env).

The client never receives the word lists. If the AI stage is configured but failing,
free text fails **closed** (`check_unavailable`) and quick-chat keeps working.

- **Free text only between mutual friends.** Everyone else gets **quick-chat**:
  phrase ids such as `gg`, emote ids such as `e:👍`, and a game's own
  `g:<slug>:<n>`. The effective **chat mode** (`on` | `quick` | `off`) is the
  strictest of:
  - the `HUB_CHAT` env;
  - the admin runtime switch, which can only tighten it;
  - any participant's parent chat lock or mute;
  - whether everyone is a mutual friend.
- **The rejection contract.** REST answers **422** and a WS ack answers `ok:false`,
  both with:

  ```json
  { "error": "That message can't be sent.", "code": "content_rejected",
    "reason": "link", "hint": "Links aren't allowed — try describing it instead.", "retryAfterMs": 0 }
  ```

  `reason` is one of:
  - `link`, `personal_info`, `contact`;
  - `language`, `slur`, `sexual`, `grown_up`, `unkind`, `threat`, `drugs`;
  - `spam`, `shouting`, `too_long`, `empty`, `chars`, `reserved`;
  - `rate_limited`, `muted`, `check_unavailable`, `chat_off`, `quick_only`, `suspended`.

  **UI rules:**
  - keep the draft, and show `hint` under the input;
  - for `muted` / `rate_limited`, count down `retryAfterMs`;
  - never show a message as sent before the server acks it;
  - never say which word matched.

  Usernames rejected at signup/claim answer **400** with the same body.
- **Softened text is delivered softened.** The sender sees it too, with a one-time
  "Some words were swapped for friendlier ones ✨". A game may exempt soften-list
  words for its own rooms with `game.multiplayer.chatAllow` (e.g. `["shot"]` for
  pool). It can never exempt reject-list words.
- **Suspended accounts** keep single-player (saves, stats, daily, profile). Every
  social, multiplayer, suggestion, trade and `players/*` route answers **403
  `{code:'suspended'}`**, and the socket is closed with 4003.
- Word lists live in `packages/server/safety/lists/` (format and attribution in its
  `README.md`). The corpora in `packages/server/safety/test/fixtures/filter/` lock the behaviour in.

---

## Analytics

The injected menu records `play` and `heartbeat` automatically, so basic
numbers (total plays, unique players, active-now) work with no code from you.
Anonymous players are counted via a `hub_cid` cookie; signing in links the same
visitor to their account. To record your own events:

```js
await hub.event('level_complete');
```

`GET /_api/games/<slug>/analytics` and `GET /_api/analytics` return the
aggregates (also rendered on the catalog home page).

---

## Guests & claiming (no sign-in required)

Players don't have to sign in to keep progress. On a game page the injected
menu calls `hub.ensureGuest()`, which mints a **guest account** — a real user
with an auto-generated name like `Golden-Koala-5807` and no password — and a
session cookie. From then on saves, stats and scores persist under that guest,
tracked by the cookie across visits on that device.

A guest **isn't a different kind of record** — it's a normal user row. So
"finishing" the account is just a rename:

- `hub.claim(username, password)` — sets a username + password on the *current*
  guest row. Because every save/stat/leaderboard row already points at that
  `user_id`, **all progress carries over with nothing to migrate.** The menu's
  logged-out UI shows the guest name and a "Create account" form that calls this.
- `hub.login(username, password)` — for a returning player on a new device.
  If they're currently a guest, the server **folds that guest's progress into
  the account** and deletes the guest, so nothing on the device is stranded.
  **The account's own data always wins:** a guest's save slot, profile, resume
  run or daily day moves only where the account has none; `incrStat` totals
  add up, `maxStat` bests and leaderboard entries keep the better, `setStat`
  values stay the account's; coins and items add up; settings stay the
  account's. The menu reloads after login so each game re-pulls the account's
  save. (`hub.signup` while a guest works like `claim`: the guest becomes the
  new account, progress and all.)

`me()` returns `user.guest: true|false` so you can tell them apart. Caveat:
a guest is tied to the browser cookie — clearing cookies loses an *unclaimed*
guest, so nudge players to claim.

## Authentication & trust

- Auth is a cookie-based session (`hub_session`, HttpOnly, SameSite=Lax,
  `Secure` behind HTTPS). The menu handles guest creation, claiming, login and
  logout; you rarely need to call these yourself.
- Because all games share one origin and one cookie, **any hosted game's code
  runs with the player's session.** Hosted games are trusted first-party. Don't
  embed untrusted third-party code in a game.
- Scores and stats are client-submitted (honor system). The hub validates types
  and keeps only best scores, but it cannot tell a real score from a forged
  one. If your game needs cheat-resistance, validate on logic you control
  before submitting.
- Cross-*site* requests (from other websites) are rejected on mutating calls.

---

## Endpoint reference

All under `/_api`. JSON in, JSON out; errors are `{ "error": "..." }` with a
4xx/5xx status. `:slug` must be a real game.

### Auth
- `POST /auth/guest` (no body) → `{user}` (+ session cookie) — idempotent; mints a guest if none
- `POST /auth/claim` `{username,password}` → `{user}` — register the current guest (must be a guest)
- `POST /auth/signup` `{username,password}` → `{user}` (+ session cookie; a current guest becomes the account)
- `POST /auth/login` `{username,password}` → `{user}` (+ session cookie; merges a guest if one is active)
- `POST /auth/logout` → `{ok}`
- `GET  /me` → `{ user|null, profiles:[{game,displayName}] }` (`user.guest` flags an unclaimed guest)
- `GET  /me/records[?game=slug]` → `{ games:[{slug,title,records:[{key,title,score,sortDir,rank}]}] }` — the caller's standings
- `GET  /me/snapshot[?top=5]` → `{ user, games:{<slug>:{profile,saves,stats,inventory}}, records, leaderboards }` — everything for the current user, in one request (powers the SDK's `prefetchAll`)

### Profile (auth required)
- `GET /games/:slug/profile` → `{ profile|null }`
- `PUT /games/:slug/profile` `{displayName?,data?}` → `{profile}`

### Saves (auth required)
- `GET    /games/:slug/saves` → `{ saves:[{slot,label,updatedAt}] }`
- `GET    /games/:slug/saves/:slot` → `{ save|null }`
- `PUT    /games/:slug/saves/:slot` `{data,label?}` → `{ok,updatedAt}`
- `DELETE /games/:slug/saves/:slot` → `{ok}`

### Resume (auth required; see [Saved runs](#saved-runs-hubresume))
- `GET    /games/:slug/resume` → `{ resume: {state,progress:{label,fraction},title,version,updatedAt}|null }`
- `PUT    /games/:slug/resume` `{state,progress:{label,fraction?},title?,version?,savedAt?}` → `{ok,updatedAt,applied}` (404 unless `game.resumable`; 413 over 512 KB; 60 saves a minute per player, shared with saved games). The run is a saved game of kind `run`.
- `DELETE /games/:slug/resume[?before=<ms>]` → `{ok}`
- `GET    /me/resume` → `{ games:[{game,gameTitle,path,hasImage,progress,title,version,updatedAt}] }` (any session; no state; empty when signed out)

### Saved games (see [Saved games](#saved-games))
- `GET  /saved[?game=<slug>][&kinds=daily,run,turns]` → `{ games:[SavedGame], counts:{yourTurn,dailies,runs,waiting,total} }` (any session; empty when signed out; online games waiting on you first, then the newest)
- `GET  /saved/:id` → `{ game:SavedGame, state }` (auth; your daily or run only, else 404)
- `PUT  /saved/:id/state` `{state,progress:{label,fraction?},title?,version?,savedAt?}` → `{ok,updatedAt,applied}` (auth; 409 `instance_closed` once finished or discarded; 413 over 512 KB; offline replay)
- `POST /saved/:id/discard` → `{ok}` (auth; idempotent; 409 for an online game; offline replay)
- `POST /games/:slug/saved/discard` `{kinds:["daily","run"]}` → `{ok,discarded}` (auth; Reset game)
- Socket event `saved` `{game:SavedGame}` to every tab of the player whenever one of their games in progress changes.

### Stats
- `GET  /games/:slug/stats` → `{stats}` (own, auth) — or `?user=<id>` (public)
- `POST /games/:slug/stats` `{key,value,mode}` → `{key,value}` (auth)

### Leaderboards
- `POST /games/:slug/leaderboards/:key/scores` `{score,title?,sort?,meta?}` → `{board,best,rank}` (auth)
- `GET  /games/:slug/leaderboards` → `{ boards:[{key,title,sortDir}] }`
- `GET  /games/:slug/leaderboards/:key?limit=50` → `{ board, entries:[{rank,userId,username,score,meta}] }`
- `GET  /leaderboards?top=5` → `{ games:[{slug,title,boards:[{key,title,sortDir,top:[...]}]}] }`

### Daily challenges (game must set `dailyChallenges: true`)
- `GET  /games/:slug/daily` → `{ enabled, today, completions:{[day]:{completedAt,meta}}, inProgress:[day] }` (per-user state; `today` is the UTC day key)
- `POST /games/:slug/daily/:day/start` → `{ token, day, seed, expiresAt, alreadyCompleted, completedAt, meta, instanceId, saved, savedVersion, resumed }` (auth; finds or makes the day's saved game and mints a token naming it; a day in progress resumes at any age, a new start needs the window; 409 `too_many_dailies`)
- `POST /daily/instances/:id/resume` → the same (auth; a fresh token and the saved state, no window check; 409 `instance_closed`)
- `POST /games/:slug/daily/:day/complete` `{token,meta?}` → `{ ok, day, count, rank }` (auth; idempotent; finishes the day's saved game; 401 for a discarded one)
- `GET  /daily` → `{ today, games:[{slug,title,completions,inProgress}], global:[{rank,userId,username,score}] }` — cross-game hub + global standing

### Inventory & economy (auth required)
- `GET  /games/:slug/inventory` → `{ items:[{key,qty}], coins }`
- `POST /games/:slug/inventory/grant` `{items?,coins?}` → new snapshot (add goods)
- `POST /games/:slug/inventory/exchange` `{take?,give?}` → new snapshot (atomic remove `take` + add `give`; 409 if uncovered)

### Trades (auth required; create/accept/counter need a claimed account)
- `POST /games/:slug/trades` `{toUser,give?,want?,note?}` → `{offer}` (escrows `give`)
- `GET  /games/:slug/trades?box=incoming|outgoing&status=pending` → `{offers:[...]}`
- `POST /games/:slug/trades/:id/accept` → `{offer}` (atomic swap; 409 if you can't cover `want`)
- `POST /games/:slug/trades/:id/decline` → `{offer}` (recipient; refunds escrow)
- `POST /games/:slug/trades/:id/cancel` → `{offer}` (sender; refunds escrow)
- `POST /games/:slug/trades/:id/counter` `{give?,want?,note?}` → `{offer}` (closes original, sends linked reverse)

### Analytics
- `POST /games/:slug/events` `{type}` → `{ok}` (anonymous allowed)
- `GET  /games/:slug/analytics` → `{slug,totalPlays,uniquePlayers,activeNow}`
- `GET  /analytics` → `{ global:{...}, games:[{slug,title,...}] }`

### Catalog
- `GET /games` → `{ games:[{slug,title,path,kind,hasImage,hubEnabled,multiplayer}] }` — `multiplayer` is `{transport,players,invites,join,spectate,modes:[{key,title}]}` or `null`
- `GET /catalog/players` *(public)* → `{ games: { [slug]: {accounts, guests} } }`: how many have each game open right now (counts only, never who; games with nobody are absent; cached 5 s)
- `GET /games/:slug/me/activity` (auth required) → `{plays, minutesPlayed, firstPlayedAt, lastPlayedAt, windowDays}`: the caller's own plays and visible minutes in the game, within the analytics retention window

### Favorites (auth required)
- `GET /favorites` → `{ games:[slug] }` (oldest star first)
- `PUT /favorites/:slug` `{on}` → `{ games }` (idempotent; 404 for an unknown game)

Every route below needs a signed-in, **not suspended** user (403 `suspended`)
unless marked *public*. *claimed* = not a guest (403 `claim_required`). Text
fields go through the filter and answer **422** `content_rejected` on refusal.

### Player settings
- `GET /me/settings` (*public*) → `{ showIntro }`: the hub menu's switches. Guests and signed-out visitors always get `{ showIntro: true }`.
- `PUT /me/settings` `{ showIntro }` → `{ showIntro }` (*claimed*). Used by the menu only; games don't need it.

### What's new (`handlers/changes.js`)
- `GET /changes[?game=slug][&since=ms]` (*public*) → `{ items:[{id,game,title,text,at,new}], unseen, signedIn }`. `game`: that game's notes + the host's (`game: "_hub"`); omitted = every game. Newest first; last 30 days, ≤6 per game, ≤30 total. `since`: used only when signed out (the device's last-cleared time; none = nothing is new).
- `POST /changes/seen` `{ game: slug }` | `{ all: true }` → `{ ok, seenAt }` (auth required, guests OK; 404 for an unknown game). `game` marks that game's notes and the host's; `all` marks everything.

### Social (`handlers/social.js`)
- `GET  /social/config` (*public*) → `{chatMode, ai, contactUrl, parentsUrl, vapidPublicKey, quickChat:{id:text}, emotes, limits:{dmMaxChars,roomChatMaxChars,suggestionTitleMax,suggestionBodyMax}, avatars}`
- `GET  /social/me` → `{me:{id,username,avatar,guest,role,privacy,dmPolicy,chatLock,mutedUntil,suspendedUntil?}, notify, pushSubs}` (allowed while suspended)
- `PUT  /social/me` (*claimed*) `{avatar?, privacy?: 'friends'|'nobody', dmPolicy?: 'friends'|'nobody'}` → `{me}`
- `POST /social/chat-lock` (*claimed*) `{on:true}` or `{on:false, password}` → `{me}` (parent lock; turning it off needs the password, 5 tries / 15 min, 403 `bad_password`)
- `GET  /social/friends` → `{friends:[FriendEntry], incoming, outgoing, blocked}` (guests get empty lists)
- `POST /social/friends` (*claimed*) `{username}` or `{userId}`, plus optional `message` → `{status:'requested'|'friends'}` (a reverse request auto-accepts; `message` is a first message, moderated as a DM up front — a rejection is a 422 and no request is made — then held and delivered as the first DM once they're friends, never shown to a non-friend; errors `no_player`, `bad_target`, `guest_target`, `blocked`, `pending_limit`, `friends_limit`, `friend_requests_off`, `rate_limited`)
- `POST /social/friends/:id/accept` · `/decline` (*claimed*) → `{ok}`
- `DELETE /social/friends/:id` (*claimed*) → `{ok}` (unfriend or cancel an outgoing request)
- `PUT  /social/friends/:id/notify` (*claimed*) `{online}` → `{ok}` ("tell me when they're online")
- `POST /social/blocks` (*claimed*) `{userId}` → `{ok}` · `DELETE /social/blocks/:id` → `{ok}`
- `GET  /social/players/:id` · `GET /social/players/by-name/:name` → `PlayerCard {id,username,avatar,guest,relation,presence,canFriend,canMessage,canInvite,canReport}`
- `GET  /social/recent` (*claimed*) → `{players:[{…PlayerLite, game, lastAt}]}`
- `GET  /social/counts` (*public*) → `{online, byGame:{slug:n}}`

### Avatars ([Avatars](#avatars))
- `GET  /avatar/me` (*signed in*, allowed while suspended) → `{look, code, isDefault, updatedAt, nudge:{shown, dismissedAt, promptedAt, upgrade}}`
- `PUT  /avatar/me` (*active*, guests too) `{look, savedAt?}` → the same plus `applied` (400 `bad_avatar` with `field`; 30 saves / 10 min; an older `savedAt` than the stored look is not applied)
- `DELETE /avatar/me` (*active*) → back to the default
- `POST /avatar/me/nudge` `{event:'shown'|'dismissed'|'prompted'|'upgradeSeen'}` → `{nudge}`
- `GET  /avatar/of/:id` → `{id, code, isDefault}` (300 / min) · `POST /avatar/batch` `{ids:[≤100]}` → `{codes:{id:code}}` (unknown ids left out; 120 / min)
- `GET  /_hub/avatar/<code>.svg?f=&e=&lx=&ly=&s=&b=` (*public*) → the server-rendered SVG (`immutable` for a real code; the silhouette for garbage)
- Socket: `ev:avatar {userId, code}` to your own tabs, your friends and the players and spectators in your room or race

### The world ([The world](#the-world-gameworld))
- `GET  /world/maps/:key?rev=` → `{key, rev, map}` (a `dg-world@1` file; `key` is `lounge`, `park`, `station`, `camp` or `game.<slug>`; `immutable` with the current `rev`; 404 `world_not_found`)
- Socket ops: `world.enter {world, spawn?}` → place · `world.leave` · `world.move {steps[≤12], facing?}` → `{at, facing, accepted}` · `world.sit {object, index}` · `world.stand` · `world.teleport {portal}` → place · `world.say {quick}` (quick-chat only)
- Socket events: `world.state {instance, join, update, leave}` · `world.say {instance, userId, quick, text}`; presence carries `world`
- `GET  /games` lists `embed {w, h, aspect?, minScale, frame?: {url, stillUrl, viewBox, screen}}` for games that play over the world; dg-host serves the sanitised frame at `/_frames/<slug>.svg?v=<hash>[&still=1]` (*public*, `image/svg+xml`, locked-down CSP)

### Messages (`handlers/messages.js`, mutual friends only)
- `GET  /social/conversations` → `{conversations:[{user, last, unread}]}`
- `GET  /social/messages/:userId?before=<id>` → `{messages (oldest→newest, ≤50), more, mode:'on'|'quick'|'off'}`
- `POST /social/messages/:userId` `{text}` or `{quick}` → `{message:{id,from,to,text,quick?,at,read,softened?}}` (moderated **before** it's stored or delivered; 403 `not_friends` / `dms_closed`, 422 `chat_off` / `quick_only` / content reasons)
- `POST /social/messages/:userId/read` `{upTo}` → `{ok}`

### Reports
- `POST /social/reports` `{kind:'message'|'user'|'username'|'suggestion'|'room_chat'|'presence', targetUserId, refId?, reason:'mean'|'bad_words'|'personal'|'inappropriate'|'spam'|'other'}` → `{ok, id}` (the server snapshots the content itself; 3 independent claimed reporters in 24 h → auto-mute + admin flag)

### Notifications (`handlers/notify.js`)
- `GET  /social/notify` → `{dm, friend_request, invite, friendOnlineAll, friendOnline:[userId], lobbyOpen:[slug], yourTurn, yourTurnOff:[slug], yourTurnAsked, quiet:{from,to,tz}|null}` (`yourTurn` is on by default once the player allows pushes on some device, until they set it)
- `PUT  /social/notify` `{kind:'dm'|'friend_request'|'invite'|'friend_online'|'lobby_open'|'your_turn', target?, enabled}` → the same shape (`friend_online` with no `target` is the "any friend" switch; `your_turn` with no `target` is "When it's my turn", with a slug that game's switch; either answers the one-time question)
- `PUT  /social/notify/quiet` `{quiet:{from:'21:00',to:'08:00',tz:'America/New_York'}|null}` → the same shape (quiet hours: pushes wait until they end, one per tag, never dropped; invites and tournament calls are never held; toasts are never held; 400 for an unknown zone or an empty window)
- `POST /social/push` `{subscription}` → `{ok}` · `DELETE /social/push` `{endpoint}` → `{ok}` (Web Push; ≤5 per user)

### Suggestions
- `GET  /suggestions?sort=votes|new` (*public*) → `{approved:[Suggestion], mine:[Suggestion]}`
- `POST /suggestions` (*claimed*) `{title (≤60), body (≤500)}` → `{suggestion}` (3/day, 20 pending)
- `POST /suggestions/:id/vote` · `DELETE /suggestions/:id/vote` (*claimed*) → `{votes, voted}`
- `DELETE /suggestions/:id` (*claimed*) → `{ok}` (withdraw your own pending one)

### Multiplayer (`handlers/mp.js`)
- `POST /mp/invites` `{to, game, mode?}` → `{invite, launchToken, url}` (creates/reuses the inviter's party; 403 `cannot_invite`, 404 `not_multiplayer`, 400 `not_supported` / `bad_mode`, 409 `party_full` / `already_member`)
- `POST /mp/invites/:id/accept` → `{launchToken, url}` · `POST /mp/invites/:id/decline` → `{ok}` · `DELETE /mp/invites/:id` → `{ok}` (cancel)
- `GET  /mp/launch/:token` → `{launch:{kind:'host'|'guest'|'join'|'watch', game, mode?, partyId?, party?, joinInfo?, room?, host?, target?, via?}}` (single use, 2 min; 404 `launch_invalid`)
- `POST /mp/parties/:id/join-info` (leader) `{info:{k:v} (≤8 keys, values ≤64)}` → `{ok}` · `POST /mp/parties/:id/leave` → `{ok}`
- `POST /mp/join` `{userId, watch?, fromLobbyOpen?}` → `{launchToken, url}` (from a friend's joinable/watchable presence; 409 `not_joinable`)
- `POST /mp/links` `{game}` → `{token, url, game, mode?, room, createdBy, expiresAt}` (claimed; an invite link to the room I'm in, reused while it lives; 409 `not_in_room`, 429 `too_many_links`) · `GET /mp/links?game=` → `{links}` (mine, plus links to rooms I host) · `DELETE /mp/links/:token` → `{ok}` (creator or room host)
- `POST /mp/links/:token/open` → `{launchToken, url}` (a `join` launch while a seat is free, else `watch`, with `via:'link'`; 404 `link_invalid` / `link_room_gone`, 409 `room_full`)
- `POST /mp/ticket` `{slug}` → `{ticket, expiresAt}` (60 s identity ticket for that game's own server)

### Tournaments (batch-2026-10 R15; game guide: `docs/multiplayer.md` §15)
- `GET  /play-online` → `{counts:{now, invites, mine, upcoming}, lobbies, gameInvites, tournamentInvites, mine, upcoming}` (anyone; signed out: open tournaments only). The home page's **Play online** card and the menu's row show `counts`; the window lists the rest. `lobbies` are public lobbies and races waiting for a player (claimed hosts who show their presence, nobody across a block); join one with `POST /mp/join {userId, fromLobbyOpen:true}`.
- `GET  /tournaments?game=` → `{tournaments}` (open ones plus mine, invited or followed; ended ones for 3 days) · `GET /tournaments/:id?key=` → the detail with `players` and the bracket's `matches` (404 `tournament_not_found` for a closed one not shared with me; `key` is a shared link's invite key)
- `POST /tournaments` (*claimed*) `{games:[slug] (≤8), title? (≤48, content filter), pick?:'fixed'|'random-once'|'random-each', lives?:1|2|3, seeding?:'random'|'rank', visibility?:'open'|'closed', start?:{kind:'filled'}|{kind:'scheduled', at}, minPlayers?, maxPlayers? (2–64), readyMinutes? (1–60, default 10), invite?:[userId]}` → detail. The defaults are the quick public 1v1. 400 `not_supported` (a game without tournaments), 422 (title), 429 (5 a day, 3 open at once).
- `POST /tournaments/:id/join` `{key?}` (guests too) → detail (starts a `filled` one with enough players; 409 `tournament_closed` / `tournament_full`, 403 `cannot_join` across a block) · `POST /tournaments/:id/leave` → detail (before the start the place is freed; after it the player is out; from an invited player who hasn't signed up it is "No thanks": the invite stops showing for them, nobody is told; 409 `not_entered` otherwise)
- `PUT /tournaments/:id/follow` (*claimed*) `{leadMinutes?}` → summary (reminder that long before a scheduled start) · `DELETE /tournaments/:id/follow` → `{ok}`
- Creator: `POST /tournaments/:id/invites` `{userIds}` → `{invited}` (friends only) · `POST /tournaments/:id/start` · `DELETE /tournaments/:id` (cancel; admins too)
- `POST /tournaments/:id/matches/:match/launch` → `{launchToken, url}`: a `host` launch for the better seed, `guest` for the other, sharing the match's party; the launch carries `tournament:{id, title, match, opponent}`. 409 `match_not_ready`.
- Socket event `tournament` `{tournament}` (the recipient's own summary) on every change to a tournament they are attached to. Alerts are kind `tournament` (match ready, forfeit warning, "starts in N min", started, ended, invited): a toast with a visible tab, else Web Push for claimed accounts; links are `/?hub_tournament=<id>` (the runtime opens the sheet).
- Limits (`HUB_LIMITS_JSON`): `tournamentsPerDay` (5), `tournamentsOpenMax` (3), `tournamentTickMs` (5000), `tournamentMatchMaxMs` (90 min), `tournamentMinuteMs` (60000; tests shorten it).

Live traffic (presence, friends/DM/invite events, hub relay rooms `room.*`, party
chat) is on the WebSocket **`/_ws`**: JSON envelopes `{t:'op', id, op, d}` →
`{t:'ack', id, ok, d|err}`, plus pushed `{t:'ev', ev, d}`. Games use it only through
`hub.rooms` / `hub.presence`. The op and event tables are in
`docs/plans/multiplayer-impl.md` §4 and §6.

### Online games over days (claimed accounts; see docs/multiplayer.md §16)
- `POST /turns` `{game,mode?,options?,invite?,link?,public?,seats?,bots?,deadline?}` → `TurnGameView` · `GET /turns/:id` → `TurnGameView` (seated players only)
- `POST /turns/:id/join` `{key?}` · `POST /turns/join` `{key}` · `POST /turns/:id/start` · `POST /turns/:id/invite` `{userIds}`
- `POST /turns/:id/moves` `{seq,move}` → `{game,events}` (403 `not_your_turn`, 409 `stale`, 422 `illegal` + `rule`, 500 `rules_error`, 503 `rules_busy`, 413 over 2 KB; 30/min)
- `GET  /turns/:id/history?since=<seq>` → `{moves:[{seq,seat,events,at}]}` · `POST /turns/:id/leave` · `/nudge` · `/rematch` · `/auto` (an overdue turn, or an absent player's seat for the rest of the game) · `/chat` `{text?|quick?}` · `PUT /turns/:id/notify` `{mode}`
- `GET  /turns[?game=]` → `{games:[SavedGame]}` · `GET /open-turns[?game=]` → `{games:[OpenTurnGame]}`
- Socket events `turn` (per seat: `{id,game,seq,seat,events,view,summary,outcome}`) and `turn.chat` `{id,line}`.

### Internal (game servers only)
Loopback only, no `x-forwarded-for`, headers `x-hub-app: <slug>` + `x-hub-key: <HUB_APP_KEY>`.
Anything else gets a 404. Use `hub-server.mjs` rather than calling these by hand.
- `POST /internal/chat` `{userId, text?|quick?, members:[userId], context?}` → `{ok:true, text, quick?, softened?}` or `{ok:false, err}` (never a 422)
- `POST /internal/results` `{room?, mode?, players:[{userId, place?, won?, stats?, scores?}], tournament?:{id, match}}` → `{ok}` (increments `online_games`/`online_wins` + `stats`; `scores` go to `source:"server"` boards only; ≤16 players; with `tournament`, decides that ready match when both its players are named and exactly one `won`)
- `POST /internal/recent` `{userIds}` → `{ok}`

### Admin (role `admin` only)
- `GET  /admin/overview` → online/byGame/rooms/parties, AI health, switches, open reports, pending suggestions, flagged users
- `GET  /admin/reports?status=open|resolved` · `POST /admin/reports/:id/resolve` `{action:'dismiss'|'hide'|'mute'|'suspend'|'rename', duration?, note?}`
- `GET  /admin/modlog?userId=&verdict=&severity=&limit=`
- `GET  /admin/saved?game=&user=&kind=` → saved games and the online games' health · `GET /admin/saved/:id` (full state; logged) · `POST /admin/saved/:id/action` `{action:"end"|"seat-bot"|"clear-flag"|"delete", seat?}`
- `POST /admin/filter/test` `{text, surface}` → `{result, forms}` · `GET|POST|DELETE /admin/filter/terms` `{term, list:'block'|'phrase'|'allow'|'soften', replacement?}`
- `GET  /admin/users?q=` · `GET /admin/users/:id` · `POST /admin/users/:id/suspend` `{duration:'24h'|'7d'|'30d'|'perm', reason}` · `/unsuspend` `{restoreMessages}` · `/mute` `{duration}` · `/unmute` · `/rename` `{username?, force?}`
- `GET  /admin/suggestions?status=` · `POST /admin/suggestions/:id` `{status?, adminNote?}`
- `GET|PUT /admin/switches` `{chat?:'on'|'quick'|'off', dms?, friendRequests?, strangerText?, aiEngine?}` (`chat` can only be stricter than `HUB_CHAT`; `strangerText`, off by default, lets players who aren't friends type in game chats: online games, rooms, game servers; never guests or parent-locked accounts)
- `POST /admin/username-scan` → `{hits:[{id, username, reason}]}`
- `GET  /admin/backups` → `{backups:[{name, kind:'backup'|'safety'|'upload', size, createdAt}], inventory, pendingRestore}` · `POST /admin/backups` → `{backup, files}` (takes one; logged) · `POST /admin/backups/:name/preview` → the dry run (changes nothing) · `POST /admin/backups/:name/restore` `{confirm:'RESTORE'}` → `{ok, safetyBackup, restarting}` (logged; both servers restart). The archives move outside `/_api`: `GET /_admin/backups/<name>` downloads one and `POST /_admin/backups/upload` (the raw `.tar.gz` body) stores one, admins only. See `DEPLOY.md` §11a.

### Test mode (`HUB_TEST=1` and loopback only)
- `POST /test/suspend` `{userId, ms}` · `POST /test/unsuspend` `{userId}`
- `GET  /test/alerts/:userId` (notifications raised) · `GET /test/push/:userId` (the push outbox)
- `POST /test/reset-limits`

---

## Host configuration (env)

Social and multiplayer knobs, read at boot and validated by one schema
(`packages/server/internal/src/config.ts`). Set them on the systemd unit (see `DEPLOY.md`).

| Env | Default | Meaning |
|---|---|---|
| `HUB_ADMINS` | `ClickerMonkey` | Comma list of usernames (case-insensitive) that become admins once **claimed**. The role sticks to the user id. |
| `HUB_CHAT` | `on` | Site chat switch: `on` (friends free text + quick-chat), `quick` (phrases only), `off` (no messaging). The admin switch can only tighten it. |
| `HUB_MOD_OPENROUTER_KEY` | unset | OpenRouter key for the AI reviewer (every engine). Unset means rules-only: friends keep free text, checked by the word filter. |
| `HUB_MOD_ENGINE` | `llm` | Which AI reviewer runs: `llm` (a chat model follows `safety/ai-rubric.md`), `guard` (TypeSafe's Jev decision model answers `safety/jev-questions.json`) or `both` (Jev first, the LLM decides the uncertain ones). The admin Live tab can override it at runtime. An engine that isn't configured is rules-only. See "AI engines" below. |
| `HUB_MOD_MODEL` | unset | The `llm` engine's OpenRouter model, e.g. `anthropic/claude-haiku-4.5`. Needed for `llm` and `both`. With only the key + this set, behaviour is exactly as before the guard engine existed. |
| `HUB_MOD_MODEL_SLOW` | `= HUB_MOD_MODEL` | LLM model for usernames and suggestions (not latency-sensitive). |
| `HUB_MOD_GUARD_MODEL` (alias `HUB_MOD_JEV_MODEL`) | `typesafe/jev-1.13` | The `guard` engine's Jev release. Keep it **pinned**: Jev's probabilities (and so the thresholds) are tuned per release; don't use `~typesafe/jev-latest`. Re-run the comparison before moving to a new release. |
| `HUB_MOD_JEV_THRESHOLD_CHAT` | `0.4` | Jev blocks a DM / room / party message when P(unsafe) ≥ this. |
| `HUB_MOD_JEV_THRESHOLD` | `0.5` | Same for usernames, room names and suggestions. |
| `HUB_MOD_ESCALATE_BAND` | `0.2,0.7` | `both`: P(unsafe) below the low end is allowed and at/above the high end blocked by Jev alone; in between (or grown-up hints inside a conversation, or a Jev error) the LLM decides. |
| `HUB_MOD_TIMEOUT_MS` | `2500` | AI call timeout (per call). Failures fail closed (`check_unavailable`). |
| `HUB_MOD_GUARD_TIMEOUT_MS` | `1500` (capped by `HUB_MOD_TIMEOUT_MS`) | Jev call timeout. Healthy Jev answers in a few hundred ms; a short timeout lets `both` hand a slow message to the LLM quickly. |
| `HUB_CONTACT_URL` | unset | Parents' contact link on `/parents` (a mailto: or form URL). The section is hidden when unset. |
| `HUB_VAPID_PUBLIC` / `HUB_VAPID_PRIVATE` | generated into `DATA_DIR/vapid.json` | Web Push keys (base64url, raw P-256). Back the file up. New keys invalidate every push subscription. |
| `HUB_MP_SECRET` | random, persisted to `DATA_DIR/mp-secret` | Root secret for game tickets and per-game `HUB_APP_KEY`s. |
| `HUB_REALTIME` | on | `0` disables `/_ws` (an escape hatch: social goes quiet, single-player is unaffected). |
| `HUB_TEST` | off | `1` = test mode: relaxed limits, fake AI, push outbox, `/_api/test/*`. **Never in production.** |
| `HUB_LIMITS_JSON` | `{}` | JSON overrides for any `SOCIAL_LIMITS` field (tests). |
| `HUB_BACKUP_DIR` | `DATA_DIR/backups` (production: `/root/backups/diffenderfer-games`, set on `dg-hub.service`) | Where admin backups, uploads and the safety backup before a restore are kept on the box. |
| `HUB_BACKUP_KEEP` | `10` | Backups of each kind (taken, safety, uploaded) kept on the box; older ones are removed. |
| `HUB_BACKUP_MAX_BYTES` | `536870912` (512 MB) | Largest archive an admin may upload to restore. |
| `HUB_BACKUP_ENV_FILE` | `/etc/diffenderfer-games.env` | The host env file copied into each backup when readable (it holds secrets; a restore never writes it). |
| `HOST_INTERNAL_URL` | `http://127.0.0.1:8080` | dg-host as the hub reaches it (loopback), to restart it after a restore. |

### AI engines

The AI reviewer (stage 2 of moderation, after the word filter) has two engines and a
combination. All three share the failure policy (not configured → rules-only;
configured but failing → fail closed with "try again"; 10 straight failures pause that
engine for 2 minutes), the 10k-entry verdict cache (keyed by engine + model) and the
`HUB_TEST` fake (`[[block]]` / `[[aierror]]`). Hints, strikes and log severity are the
same whichever engine blocks; the moderation log tags AI rejects with `llm` or `guard`.

| Engine | What runs | Cost / latency (measured) | Strengths | Weaknesses |
|---|---|---|---|---|
| `llm` | A chat model (`HUB_MOD_MODEL`) reads the rubric + last 6 messages and answers JSON. | ≈ $0.0012 per message; median ≈ 0.8 s, p90 ≈ 1.4 s (Claude Haiku 4.5) | Reliable; best at nuance it can explain. Caught every grooming line in our sample. | ~24x the cost of Jev; missed "my brother vapes" and labels disguised swearing `other`/`unkind`. |
| `guard` | TypeSafe's **Jev** (`HUB_MOD_GUARD_MODEL`, OpenRouter Decisions API) returns P(unsafe) and a reason for the questions in `jev-questions.json`, with the same 6 messages of context. | ≈ $0.00005 per message (the questions are ~1.5k input tokens; output is free); ≈ 200 ms when healthy | When it answered, it was right on every message of the 47-message sample (safe ≤ 0.10, unsafe ≥ 0.78, so thresholds have a wide margin), incl. subtle grooming and "s n a p". Probabilities let you tune strictness without prompt edits. | A young provider: on 2026-10-08 the median was ~4 s and ~1 in 5 calls failed (timeouts, 529 overloaded, 503). Alone, every failure is a fail-closed "try again". |
| `both` | Jev first (1.5 s timeout); confident answers stand, the uncertain band (and grown-up hints in a conversation) goes to the LLM. If Jev fails the LLM covers; if the LLM fails Jev's verdict stands. | Jev on every message + the LLM on the few uncertain or failed ones (on our sample: only Jev's failures escalated) | 47/47 right on the sample; survives either provider failing; LLM cost only on escalations. | Two providers to watch; when Jev is slow, messages wait up to the guard timeout before the LLM. |

**Recommendation:** `both` for production (chat, names and suggestions alike): it
keeps Jev's accuracy and cost when Jev is healthy and degrades to the LLM when it isn't.
Use `guard` alone only once Jev's latency and error rate look stable in the Live tab
(names and suggestions tolerate it best); `llm` alone stays the simplest reliable
choice. The Live tab shows per-engine checks, block rate, errors, latency and cost
since the host started, so you can switch at runtime and compare.
| `HUB_APPS_DIR` | `<repo>/apps` | Where to scan for apps (the test kit points it at a temp dir). |

---

## Advanced

Override slug or API base (e.g. testing against a remote host) with a fresh
client:

```js
import { createHub } from '/_hub/sdk.js';
const hub = createHub({ slug: 'my-slug', apiBase: '/_api' });
```

The injected `window.__HUB__` is the source of truth for slug/apiBase when the
game is hosted; the path-segment fallback only kicks in if it's absent.

---

## Changelog

- **2026-10-15** — **Backups.** Games that keep their own data on the box
  declare it in `game.data` (see
  [Server data and backups](#server-data-and-backups-gamedata)) so the
  admin's manual backup and restore cover it. No client change.

- **2026-10-11** — **Saves offline.** Offline, `getSave` rejects with
  `save_unknown` when the device has never seen the hub's copy of the slot,
  instead of answering `save: null`; a save write replayed from the offline
  queue carries `base` (the hub's `updatedAt` it was built on) and the hub
  refuses it with 409 `save_conflict` when the slot changed since. Logging
  in from a guest now keeps the account's saves. See
  [Saves offline](#saves-offline). npm client only (next prerelease).

- **2026-10-09** — **Offline and replay.** Writes made offline go into a typed
  outbox and replay in order, exactly once on the hub (operation keys,
  deduped for 7 days), across reloads, one tab at a time. Daily completions,
  inventory grants and exchanges, and stars now queue offline too. Games queue
  their own operations with `hub.offline.define` / `enqueue` / `pending` /
  `on`. The menu shows "N changes waiting to sync". See
  [Offline and replay](#offline-and-replay). npm client only (next prerelease).

- **2026-10-08** — **Touch control layout.** The auto layout is width-aware and
  collision-free: on narrow portrait phones buttons stack in rows above the
  sticks instead of piling up between them, and no auto-placed control overlaps
  another or leaves the safe area. A player's dragged layout now survives
  resizes and rotations (it used to snap back to the defaults until reload), and
  **Edit touch layout** shrinks the Controls panel to a small bar so the
  controls can actually be dragged. New: `hub.input.setInsets({top,…})` and a
  per-control `offset` to keep controls off a game's HUD. See
  [Touch control layout](#touch-control-layout). **Vendored games: re-sync.**


- **2026-10-08** — **What's new.** Games list player-facing changes in
  `package.json` `game.changes`; each deploy stamps new notes with the time it
  went live. Shown in a home-page panel and a compact menu card (with a count and
  a dot on the menu button), with per-player seen marks (per game, or everything
  from the home page). See [What's new](#whats-new-gamechanges). `menu.js` and
  the home page only: **no client re-sync needed**, but please add notes to
  your game from now on.

- **2026-10-04** — **Native multiplayer & kid-safe social layer.**
  - **Social for every game, with no code:** friends, presence, DMs, invites,
    parties, game suggestions, opt-in Web Push notifications and report/block. It
    lives in the menu's Friends card / window via the new runtime `/_hub/social.js`
    over `/_ws`.
  - **New client namespaces:** `hub.overlay` (pause events + `autoPause`, **adopt in
    every game**), `hub.presence`, `hub.social`, `hub.mp`, `hub.rooms`, `hub.notify`.
  - **Favorites:** `hub.favorites()` / `hub.setFavorite()`.
  - **Errors:** `HubError` gains `code`/`reason`/`hint`/`retryAfterMs`, plus
    `ContentRejectedError` for 422s.
  - **Opt-in for online games:** `game.multiplayer`.
  - **Own-server games:** the game-server SDK `server/hub-server.mjs`
    (tickets, chat, trusted results) and `"source": "server"` leaderboards.
  - **Safety:** a server-side content filter (with softening and an optional
    OpenRouter AI stage) on all player text. It now also covers usernames,
    `displayName` and trade notes. Login, signup and claim are rate-limited.
  - **Pages:** `/parents` and the admin console `/_admin`.
  - **New env:** `HUB_ADMINS`, `HUB_CHAT`, `HUB_MOD_*`, `HUB_CONTACT_URL`,
    `HUB_VAPID_*`, `HUB_MP_SECRET`, `HUB_REALTIME`, `HUB_TEST`, `HUB_LIMITS_JSON`,
    `HUB_APPS_DIR`.
  - **Vendored games need one re-sync** (`npm run sync-hub`) to get the new
    namespaces: the file set grows to `uistack.ts` + `social/rt-types.ts`. After that,
    social features update without re-syncing. Guide: [`docs/multiplayer.md`](multiplayer.md).

- **2026-09-27** — Movable menu button: hold it 3s (or drawer → **Move button**)
  to enter a wiggling move mode, drag it anywhere (or arrow keys), tap / Enter /
  3s idle to save. Stored per game in `hub:<slug>:menupos` as `{corner,dx,dy}`
  (nearest-corner anchored, re-clamped on resize, safe-area aware); overrides
  `menuPosition`/`menuOffset`. **Reset position** in the drawer. Works with
  `hub.menu.setVisible` (the peek hotspot follows the saved spot). `menu.js`
  only — no client re-sync needed. See [Where the menu sits](#where-the-menu-sits).

- **2026-09-27** — `hub.menu.setVisible(bool)` / `show()` / `hide()` / `visible`:
  games can hide the injected menu button during active play (fade transition,
  `aria-hidden`, corner peek hotspot, gamepad Select still opens it). Shared via
  `window.__HUB_MENU_VISIBLE__` + the `hub:menu-visibility` event. See
  [Hiding the menu during play](#hiding-the-menu-during-play). Vendored games
  need `npm run sync-hub` (or the copy routine) to get the typed API; the
  global/event work without it.
