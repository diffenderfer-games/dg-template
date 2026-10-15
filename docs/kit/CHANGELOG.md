# Kit changelog

KIT doc. One entry per kit version; per module inside. A **major** version
means a hook's signature changed: the entry says how to move a game over.
`npm run kit:sync` prints the entries newer than a game's `kit.json`.

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
