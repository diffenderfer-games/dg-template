# Kit changelog

KIT doc. One entry per kit version; per module inside. A **major** version
means a hook's signature changed: the entry says how to move a game over.
`npm run kit:sync` prints the entries newer than a game's `kit.json`.

## 1.1 (2026-10-15)

The hub client is pinned at **2.0.0-next.7** (what diffenderfer.games runs).
Saved games, online games over days and avatars are live and switched on;
the world stays off (coming in next.9).

- **core** 1.1: `HubLike` takes `hub.saved`, `hub.turns`, `hub.avatar` and
  `hub.userId()` from the client's own types (required, no shims);
  `DailyLike` has `save`, `resume`, `discard`, `inProgress`;
  `planned.ts` keeps only the world. New window events
  `hub:daily-resumed`, `hub:daily-paused`, `hub:daily-discarded`.
- **saved** 1.1: the title's Continue rows come from `hub.saved` (the line
  under Continue is the progress label alone, not "Continue: …" again) (the saved
  game and days in progress, in the hub's wording); `onOpen` takes only the
  kinds the game can open; `discard`, `dailiesInProgress`. `available` is gone.
- **daily, resume, boot** 1.1: a day the player leaves is paused (it stays in
  progress, saved to the day) and comes back with `challenge.saved`; a lost
  day starts over from its seed; a normal game is never saved into a day the
  hub just started; a title still loading never covers a game that started,
  and Your games `change` redraws the title only when its rows changed;
  an opened day plays after the router has mounted it.
- **avatar** 1.1: `avatarRenderer(hub)` loads the hub's renderer
  (`hub.avatar.load()` + `defineAvatarElement()`) before any face draws (the
  title demo drew nothing before); `showFeel` plays the feeling on the
  element's animator (the `feel` attribute did nothing); lobby faces use the
  seat's `look`; the title bust follows your own `change` by
  `hub.userId()`, says "Edit avatar" and sits under the title's buttons
  (a fixed corner covered them on a phone); no initial-letter fallback.
  The starters' `avatar-pixi.ts` / `avatar-three.ts` use the hub's typed adapters.
- **turns** 1.1: the rules contract and `checkTurnRules` are the hub's own
  (`@diffenderfer-games/hub/turns`, re-exported); the adapter is plain
  `hub.turns`. Coming in next.8: the `turns-rules` entry, presence,
  `mayAct`, buzz.
- **testing** 1.1: `FakeHub` always has `saved`, `turns`, `avatar` and
  `userId()` (`planned` takes only `world`); `FakeDaily` keeps days in
  progress (`inProgressDay`); `FakeResume` saves to the day during a daily;
  `HUB_PHASES` marks saved games and avatars shipped.
- **hub-events, hub-suites** 1.1: rows 28, 56, 57 and 62 run; new suites
  `tests/hub/kit/saved.test.ts` and `avatar.test.ts`; `_kit.ts` adds `api(p)`
  and `today(offset)`.
- **scripts** 1.1: the `avatar`, `avatar-designer` and `your-games` shots run.
- **docs, layout, server, world** 1.1 (docs only): the hub menu button's 64px
  corner and `setInsets({ top })` ([layout.md](layout.md#the-hub-menu-button));
  `game.data` for own-server games ([server.md](server.md#backups-gamedata),
  with the next.7 `hub-doctor` gap); the world marked "coming in next.9".

### Moving a game over

1. `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.7`, then `npm run kit:sync`.
2. Online rules (`src/game/turns/rules.ts`): the RNG is the hub's `TurnRng`
   (`rng.int(6)`, not `Math.floor(rng() * 6)`); add `export default rules`.
   `checkTurnRules` throws instead of returning problems: `checkTurnRules(rules, { seats: [2, 3] })`.
3. Tests that built a FakeHub with `planned: { savedGames, turns, avatars }`:
   drop those flags (the APIs are always there). `fake.daily.savedFor.set(day, { saved })`
   is now `fake.daily.inProgressDay(day, saved)`.
4. Code that checked `hub.saved`, `hub.avatar` or `createTurns(hub).available`: they are always there.

## 1.0 (2026-10-15)

The first kit. Every module at 1.0:

- **core, rng, testing**: JSON types, the activity model, strings, the seeded
  RNG, FakeHub and the fakes, the planned-phase list, the balance sim.
- **save, resume, daily, pause, scores, test-hook**: the profile, Continue,
  the daily challenge, pause on hub UI, boards and stats, `window.__game`.
- **boot, input, layout, loop, ui, settings-ui**: `defineGame`, the router and
  screens, controls, the safe region, the fixed-step loop, screens, modals,
  toasts, the settings sheet.
- **race, online, audio, haptics, server**: races, hub rooms (lobby, match,
  chat, reconnect, computer players for away seats), music in a worker,
  vibration, the own-server helper.
- **saved, turns, avatar, world**: written against the planned hub APIs;
  feature-checked, tests skipped until the hub phase ships.
- **hub-events, hub-suites**: a unit test per hub event; browser suites on a
  real hub (pause, saves, daily, race, online, FakeHub parity).
- **scripts**: `check`, `kit:sync/check/hash`, `new-game`, `todo`, `shots`,
  `shots:hub`, `shots:sheet`, `cover`, `local`, `probe`, `ui:check`,
  `clean:procs`, `build:rules`, `world:build/check`, `sync-docs`,
  `sync-hub-server`.
- **ci**: the deploy is gated on `npm run check` and the hub suites.
