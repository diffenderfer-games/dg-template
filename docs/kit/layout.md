# kit/layout

Source: `src/kit/layout/` (KIT: copy byte-identical; change it in the template first).

`kit/layout` answers "how big is the screen and where may I draw?". It debounces resize and rotation, reads the safe area (notch, home bar), letterboxes a fixed design into the viewport, and computes the play region: the rectangle inside the safe area, below the race HUD and the top HUD. A game touches it from its renderer (size the canvas, scale the arena) and from any HTML it positions itself.

## What the game does

Use `ctx.region()` and `ctx.onResize` from the `GameContext`; they are built on this module. The stub game's renderer gets `region: () => ctx.region()` and fits its arena into it.

```ts
import { letterbox, isPhone, fitText, type Region } from '../kit/layout/index.ts';

// in the renderer, after every settled resize:
ctx.onResize(() => {
  const r: Region = ctx.region(); // { x, y, width, height } in CSS px
  const fit = letterbox(r.width, r.height, ARENA.width, ARENA.height);
  world.scale.set(fit.scale);
  world.position.set(r.x + fit.x, r.y + fit.y);
});
if (isPhone()) showCompactHud();
const refit = fitText(titleEl, { min: 12 }); // call refit() after the text changes
```

## What the kit does for you

- `ctx.region()` already subtracts the safe area, the race HUD (`--hub-race-hud-top` and `--hub-race-hud-bottom`) and the bottom of every `.kit-hud` and `.kit-corner` element, so the pause button and the HUD never cover play.
- `ctx.onResize(cb)` fires once the size settles (60 ms debounce). On rotation it fires again after 350 ms, because phones report the wrong size for a moment.
- The kit's CSS keeps screens clear of the same areas (`--kit-top`, `--kit-bottom`), see [ui.md](ui.md).

## Helpers

- `safeArea()` reads `env(safe-area-inset-*)` through a hidden probe element.
- `layoutRegion({ width, height, safe, race, top, bottom, menuButton })` is the pure calculation behind `ctx.region()`. `top` and `bottom` are elements whose bounding boxes block the region.
- `raceHud()` reads the race HUD heights from the root element's CSS variables.
- `isPortrait()` is true when the height is greater than the width. `isPhone()` is true when the short side is under 600 CSS px.
- `keepThemeColor(color)` pins `<meta name="theme-color">` and returns the restore function.
- `fitText(el, { min, max })` shrinks the font until the text fits the width; returns a refit function.

## The hub menu button

The hub's menu button sits in the corner `game.menuPosition` names (the
player can move it: arrows, or hold and drag). Keep a **64px square** in that
corner, measured inside the safe area, free of your own UI: no score, button
or bar under it. The kit keeps its own UI out of it: screens start below
`--kit-top`, and the play screen's pause button sits top-left, so keep
`menuPosition` on the right (the template's `top-right`) or move the pause
button. `ctx.region()` keeps gameplay below the HUD row and the pause corner,
not below the menu's square, so leave the square empty in your own HUD and art.
If the corner is fine but a bar of yours runs past it, push
the button with `game.menuOffset` instead.

A top bar of your own: give its height to `hub.input.setInsets({ top })`
(kit/input `setHudInsets(hub, { top: [bar] })` measures it), and update it
when the bar resizes. The hub then places its toasts (invites, messages,
"your turn") below the bar instead of over it, and keeps auto-placed touch
controls off it. A bar drawn on a canvas needs the inset: the hub can't see it.

```ts
const bar = document.querySelector('.my-top-bar')!;
const sync = (): void => hub.input.setInsets({ top: Math.ceil(bar.getBoundingClientRect().bottom) });
sync();
new ResizeObserver(sync).observe(bar);
```

## Rules it enforces

- Leave room for the race HUD and a 390 px phone: [docs/multiplayer.md §14.5](../multiplayer.md#145-testing) (see "Making room for the race HUD").
- Keep touch controls off HUD bands and inside the safe area: [docs/hub.md Touch control layout](../hub.md#touch-control-layout).
- Do not put game UI under the hub menu button: [docs/hub.md Where the menu sits](../hub.md#where-the-menu-sits).

## Options / API

| Export | What |
|---|---|
| `onResize(cb, { debounceMs?, clock?, win? })` | Call `cb(w, h)` when the viewport settles; returns the unsubscribe. |
| `safeArea(doc?)` | The safe-area `Insets` in CSS px. |
| `letterbox(vw, vh, w, h)` | `{ scale, x, y }` to fit a `w` by `h` design, centred. |
| `layoutRegion(opts)` | The `Region` gameplay may use. |
| `raceHud(doc?)` | `{ top, bottom }` race HUD heights in px. |
| `Region`, `Insets` | Rectangle and edge-size types. |
| `fitText(el, opts)` | Shrink text to fit; returns `refit()`. |
| `isPortrait(w?, h?)`, `isPhone(w?, h?)` | Viewport checks (default: the window). |
| `keepThemeColor(color, doc?)` | Hold the theme colour; returns the restore. |

## Tests

- `tests/kit/layout/layout-loop.test.ts` (shared with `kit/loop`): resize debounce and the double measure on rotation, `letterbox`, and the play region leaving room for the safe area, the race HUD, HUD bands and the menu button.
- `npm run ui:check` checks the real screens at four sizes, see [ui.md](ui.md).

## Hub API used:

- None directly. It reads the CSS variables the hub sets on `<html>` (`--hub-race-hud-top`, `--hub-race-hud-bottom`) and the browser's `visualViewport`.
