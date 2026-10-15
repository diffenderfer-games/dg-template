# Screenshots and the contact sheet

KIT doc. Source: `scripts/kit/shots.ts`, `scripts/kit/sheet.ts`,
`scripts/kit/shots/`, `scripts/kit/lib/`. Look at the game; don't guess.

## Running

```bash
npm run shots                          # build, serve dist/ under /<slug>/, every static scenario
npm run shots:hub                      # the hub scenarios on a fresh test host
npm run shots:hub -- --url http://localhost:8490   # …or on a running npm run local
npm run shots -- title pause --size phone,tablet   # some scenarios, some sizes
npm run shots -- --no-build
npm run shots:sheet -- --diff old-shots           # rebuild the sheet, marking changed shots
```

Output in `shots/` (git-ignored):

- `<scenario>-<size>.png`;
- `manifest.json` / `manifest-hub.json`: scenario, size, URL, errors and
  `__game.snap()` for each shot;
- `sheet.png`: every shot on one labelled sheet, zoomed to fit 2048 × 2048;
- `index.html`: the same sheet, full size, with a filter box.

**Any console error fails the run** (the hub's expected ones are allowed: a
404 from a static server's `/_api`, a closed `/_ws`, offline loads). Then
**read `shots/sheet.png`** and check each shot against its "checks" line.

## Sizes

| Size | Viewport |
|---|---|
| `desk` | 1280 × 800 |
| `phone` | 390 × 844, touch, DPR 2 |
| `phone-land` | 844 × 390, touch |
| `tablet` | 820 × 1180, touch |

Default: `phone,desk`.

## Scenarios

Static (the built game alone): `title`, `menu` (keyboard focus ring), `howto`,
`settings`, `play`, `pause`, `gameover`, `toast`, `offline`, `cover`.

Hub (a real hub, signed-in players): `intro`, `hub-menu`, `daily-start`,
`daily-done`, `continue`, `invite`, `lobby`, `race-hud`, `race-result`.
Skipped until their hub phase ships, saying so on the sheet: `avatar`,
`table-launch`, `your-games`.

## Writing a scenario

Add it to `scripts/shots.config.ts` (GAME). Drive the game with `window.__game`
drivers ([test-hook.md](test-hook.md)) instead of clicking through menus:

```ts
export const scenarios: Scenario[] = [
  {
    name: 'boss',
    target: 'static',
    checks: 'the boss bar clear of the menu button',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('extra.toBoss');
      await c.wait(500);
    },
  },
];
export const exclude = ['race-hud']; // kit scenarios this game doesn't need
```

The context gives `open(query?)`, `drive(path, ...args)`, `screen(name)`,
`press(testid)`, `hubClick`/`hubFind` (inside the hub's shadow roots),
`player()` and `befriend(a, b)` (hub only), and `wait(ms)`.

## Cover

`npm run cover` takes the `cover` scenario at desktop size and copies it to
`cover.png`; point `game.image` at it.

## A local hub

```bash
npm run local                 # a free port block (never 8099), the hub's npm run local -- --only <this repo>
npm run probe                 # open the game once: screen, snap, errors, shots/probe-desk.png
npm run shots:hub -- --url http://localhost:<port>
```

`npm run local` writes `.tmp/local.json`; `probe` reads it. The hub finds this
repo because it sits beside the hub checkout under `GitHub/`.

## Ports

This machine runs many dev servers. A busy port can serve a different game.
The scripts listen on port 0 or pick a free block of four ports; `vite preview`
uses `--strictPort`. Never use 8099 (the main local instance).

## Cleaning up

Every browser and server the scripts start is noted in `.tmp/procs.json`
(Chrome is tagged with this repo's path). `npm run clean:procs` stops those,
never another checkout's.

## Probe and layout checks

`npm run ui:check` checks every size on the title, play and pause screens: no
sideways scroll, every button on screen, touch targets at least 44 × 44.
