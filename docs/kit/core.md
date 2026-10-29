# kit/core

Source: `src/kit/core/` (KIT: copy byte-identical; change it in the template first).

The base of the kit. It holds the hub types the other modules share (`HubLike`), the typed hub window events, safe storage, the injected clock, the shared "what is the player doing" value (`Activity`), the player-facing strings and a few small helpers. Every other kit module imports it. A game rarely touches it directly: `defineGame` builds the clock, the activity and the stores and hands them to the hooks through `GameContext`. You reach for core when you write your own helper that needs storage, time, JSON checks or a hub event.

## What the game does

The game gets most of core through `GameContext` (`ctx.hub`, `ctx.clock`, `ctx.activity`). Direct imports are for guards and small helpers.

```ts
import { dayKey, localStore, onWindow, scopedKey, singleFlight, wordingProblems } from '../kit/core/index.ts';

const key = scopedKey('mygame', 'tips-seen', 7); // "mygame:tips-seen::u7"
localStore.setJson(key, { seen: true }); // false if storage is blocked; never throws
const off = onWindow('hub:daily-complete', (d) => console.log('done', d.day));
const loadOnce = singleFlight(() => fetch('/data.json').then((r) => r.json()));
const today = dayKey(Date.now()); // UTC "YYYY-MM-DD"
if (wordingProblems('You kill 3 runs').length > 0) console.warn('bad copy');
off();
```

To change a kit word, pass `strings` in the game definition (`defineGame` calls `setKitStrings`).

## What the kit does for you

- Gives every module one `Clock`, so time can be faked in tests (`fakeClock()` in [testing](testing.md)).
- Parses every hub `CustomEvent` through a checked parser, so a bad detail never reaches a handler.
- Makes storage safe: private mode, a full quota or blocked storage fall back instead of throwing.
- Tracks the play mode (`normal`, `daily`, `race`, `online`) in `Activity`. The profile, boards and Continue read it.
- Keeps every player-facing kit word in one table (`KIT_STRINGS`), checked against the hub wording rules.
- Turns rule breaks into a thrown `KitRuleError` in dev, tests and the e2e harness, and into a one-time warning in production.

## Rules it enforces

- Daily, race and online games never touch normal progress (`Activity.isolated()`): [docs/hub.md Daily challenges](../hub.md#daily-challenges).
- No violent words or links in game text; kid wording ("game" and "Continue", never "run"): [docs/multiplayer.md TL;DR](../multiplayer.md#tldr-the-rules).
- Storage keys are scoped per game and per account (`scopedKey`): [docs/hub.md Saves and stats](../hub.md#saves-and-stats).
- Window events come from another bundle and are treated as untrusted: [docs/hub.md Offline and replay](../hub.md#offline-and-replay).
- Test drivers install only in dev, on localhost or under the test harness (`driversAllowed`): [docs/multiplayer.md §12](../multiplayer.md#12-testing-required).

## Options / API

| Export | What it is |
| --- | --- |
| `Clock`, `realClock`, `dayKey(ms)` | Time, timers, frames; UTC day key `YYYY-MM-DD` |
| `createActivity()`, `Activity`, `PlayMode` | The shared play mode; `isolated()` is true for daily, race, online |
| `Store`, `createStore`, `localStore`, `sessionStore`, `scopedKey` | Safe storage |
| `onWindow(name, cb, target?)`, `emitWindow`, `HubWindowEvents` | Typed hub window events |
| `Json`, `JsonObject`, `isJson`, `isJsonObject`, `parseJson`, `cloneJson`, `jsonBytes` | JSON values and checks |
| `jsonEqual`, `stableStringify`, `hashJson` | Re-exported from the daily-puzzle kit |
| `field`, `numField`, `strField`, `boolField` | Read an untrusted object without casts |
| `singleFlight`, `withTimeout`, `delay`, `fireAndForget`, `serialQueue`, `QueueHangError` | Async helpers |
| `Emitter` | A tiny typed event emitter; a throwing listener never stops the others |
| `isDev`, `isLocalhost`, `isTestHarness`, `driversAllowed`, `isShotMode` | Where the game runs |
| `inFrame(win?)`, `isEmbedded(win?, search?)` | In an iframe; in the world's box over Adventure Mode (`?hub_embed=1`, [world.md](world.md#playing-over-the-world)) |
| `KIT_VERSION` | The kit's version (`version.ts`: kit.json and the test hook read it) |
| `KitRuleError`, `isStrict`, `kitWarn`, `ruleBroken` | Loud in dev, quiet in production |
| `KIT_STRINGS`, `t(key, vars)`, `setKitStrings`, `shortDay` | Player words |
| `wordingProblems(text, maxLength?)` | What is wrong with a label (kind words, violent words, over 60 characters) |
| `HubLike` and its parts (`OverlayLike`, `InputLike`, `DailyLike`, `ResumeLike`, `RaceLike`, `MpLike`, `RoomsLike`, `SocialLike`) | The slice of the hub client the kit uses |

### Strings

`t('continueLabel', { label: 'Level 3' })` fills `{name}` placeholders. Override entries with `defineGame({ strings })`. The table follows the hub wording rules: never "run", "turn game" or "instance".

### The manifest

`manifest.ts` reads the game's own `game` block from package.json at build time (a named JSON import, so Vite bundles only that key): `MANIFEST.id` (`game.id`, or `null`), `MANIFEST.turns` (the game declares `game.turns`), `MANIFEST.turnsQuickChat` and `MANIFEST.roomQuickChat` (its quick-chat phrases). package.json stays the one place these are declared.

**The game's id.** Everything the kit stores (settings, the profile, saves, quick-chat keys) is keyed on the game's
id, the permanent key the hub keeps its data under: `game.slug` in `defineGame` if set, else `MANIFEST.id`, else
`hub.slug` (the id the host injects), else the page's first path segment. A game that is renamed keeps its old name
as `game.id` in package.json and gets a new `game.slug` (its public URL; HANDOFF.md "The game block"), so its data
stays put even where the hub only has the address to go on (`npm run dev` at the new slug). Don't pin
`game.slug` in `defineGame` for this. The test `FakeHub` carries the same id (`MANIFEST.id`, else `mygame`).

Page code only: it is not in the core index, since Node can't import JSON without an import attribute.

### Planned hub APIs

`planned.ts` holds type shims for hub APIs that are not published yet: only the world's tables and in-game presence now (`launch.table`, `hub.mp.quickMatch`, `setRoster`; world W2/W3, coming: the world itself shipped in next.9 without them). `HubLike` lists them as optional, and the kit checks for them (`hub.mp.quickMatch !== undefined`) before use. Their tests wait on a phase in [testing](testing.md#planned-hub-tests).

## Tests

- `tests/kit/core/activity.test.ts`, `async.test.ts`, `events.test.ts`, `json.test.ts`, `store.test.ts`, `strings.test.ts`
- `tests/kit/testing/contract.test.ts` checks the real hub client still fits `HubLike`.

## Hub API used:

- Types only, via `import type` from `@diffenderfer-games/hub`: `Hub`, `UiStack`, `InputSystem`, `DailySystem`, `HubResume`, `HubRaceApi`, `HubMpApi`, `HubRoomsApi`, `HubSocialApi`, `HubPresenceApi`, `HubNotifyApi`, `HubSaved`, `HubTurns`, `TurnGame`, `HubAvatar`, `AvatarModule`.
- Window events read: `hub:auth`, `hub:reset`, `hub:daily-started`, `hub:daily-resumed`, `hub:daily-paused`, `hub:daily-discarded`, `hub:daily-complete`, `hub:daily-queued`, `hub:daily-error`, `hub:race-hud`, `hub:menu-visibility`, `hub:online`, `hub:offline`, `hub:sync`, `hub:offline-failed`, `hub:rt-ready`, `hub:rt-failed`, `hub:overlay-open`, `hub:overlay-close`.
