# kit/input

Source: `src/kit/input/` (KIT: copy byte-identical; change it in the template first).

`kit/input` declares the game's input groups with the hub and keeps them in step with the screen: the `play` group is enabled only while playing, touch layouts follow the viewport width, and the kit's DOM menus are navigable by gamepad and keys. A game touches it in one file, `src/game/controls.ts`, which exports an `InputSpec`. It then reads inputs with `ctx.hub.input` in `step`.

## What the game does

Export an `InputSpec` and pass it as `GameDefinition.input`. Keep a `pause` input in `play`: the session pauses on it (Escape and the gamepad's Start; never a letter: a word game types them).

```ts
import type { VirtualDef } from '@diffenderfer-games/hub';
import type { InputSpec } from '../kit/input/index.ts';

const virtual = (width: number): VirtualDef[] => [
  { id: 'move', type: 'joystick', place: 'bottom-left', size: width < 520 ? 120 : 150 },
];

export const controls: InputSpec = {
  groups: {
    play: {
      inputs: { left: { keys: ['a', 'arrowleft'], touch: { stick: 'move', axis: 'x-' } }, pause: { keys: ['escape'], gamepad: { button: 9 } } },
      axes: { move: { x: ['left', 'right'], y: ['up', 'down'] } },
    },
  },
  virtual,
};
// in step(): const move = ctx.hub.input.vector('move');
```

Other groups (a menu or an "inventory open" group) go in `groups`; turn them on with `ctx.controls.sync({ playing, extra: { inventory: true } })`.

Call `ctx.controls.relayout(width)` from `ctx.onResize` if your touch layout depends on the width. `defineGame` does not call it for you.

## What the kit does for you

- `defineControls` defines every group once, with `enabled: false`, and uses `spec.virtual(width)` as the `play` group's touch controls.
- `controls.sync({ playing })` enables `play` while playing and calls the hub only when something changed. While hub UI is open the hub records the change and applies the last one on close. The session calls `sync` on every screen change.
- `relayout(width)` re-defines the groups only when the layout for that width actually differs.
- `installMenuNav` makes every `[data-nav]` control in the kit UI navigable (`hub.input.autoNavigate`). Targets are the topmost open modal's controls, else the current screen's; hidden and disabled controls are skipped. Back closes the top modal unless it is locked, otherwise it pauses, resumes or leaves the result screen.
- `controlHints` sets `html[data-controls]` to `keys`, `touch` or `pad` as the player switches device, so CSS and screens can show the right hint.

## Helpers a game may use

- `setHudInsets(hub, { top, bottom })`: keep auto-placed touch controls off your HUD bands. `defineGame` does not call it.
- `canvasNavElements(buttons)`: make canvas buttons (Pixi menus) nav targets from their bounds and `act`.
- `repeatPress(read, { first, next })`: turn a held button into repeats. Call the returned function once per frame with `dt` in ms.
- `navTargets(root)`: the list `installMenuNav` uses (also handy in tests).

## What `hub.input` does (facts from the client's types)

- **`keys`** are `KeyboardEvent.key` values, case-insensitive (`' '` is Space).
- **One `gamepad` mapping per input**: `{ button: n }` or `{ axis: [n, '+' | '-'] }`, not
  both, not a list (`GamepadMapping` in `@diffenderfer-games/hub`'s `dist/shared/input.d.ts`).
  The d-pad (buttons 12–15) and the stick (axes 0, 1) need separate inputs.
- **`down(name)` and `pressed(name)` are per frame**, not per step: with two fixed steps in
  one frame a press is seen twice, with none it is missed. For a press per step, compare
  `value(name) >= 0.5` with last step's.
- **The hub's controller adapter sends keyboard events from the gamepad** (A → Space, B →
  Enter…), and they are not trusted (`e.isTrusted === false`). A game that listens to
  `keydown` itself ignores untrusted events, or the gamepad types and submits.
- **The hub's on-screen controls** are sticks, d-pads and buttons: there is no on-screen
  keyboard. `virtual: () => []` turns them off.

## Typing and word games

The hub's input system has no text input, and 26 letter inputs are heavy. A typing game:

- **Listens to `keydown` itself** (letters, Enter, Backspace), only while
  `ctx.session.screen === 'play' && !ctx.session.paused`; `preventDefault()`s those keys
  (Enter would click a focused button, Backspace would navigate back); ignores
  `!e.isTrusted` (the controller adapter, above); queues the keys and **drains the queue in
  `step`**, so typing is deterministic and works with any number of steps per frame.
- **Draws its own on-screen keyboard** (DOM, or Pixi with `eventMode = 'static'` and
  `pointerdown`: Pixi pointer events work with the ticker stopped), sized from
  `ctx.region()`, and turns the hub's touch controls off (`virtual: () => []`).
- **Moves a gamepad cursor** over that keyboard: the d-pad and the stick as separate inputs,
  read once per step, and a cursor that keeps its column between rows.
- **Pauses on Escape and Start only** (P is a letter).
- Keeps word lists as generated data in `src/game/data/` (the violent-words lint rule skips
  it; filter what players see, e.g. the answers and their definitions).

Wordle (`diffenderfer-games/wordle`, `src/game/hooks.ts`, `keyboard.ts`, `controls.ts`)
is a working example of all of it.

## Rules it enforces

- One `hub.input.define` for the whole game; groups enabled only when needed: [docs/hub.md Groups, devices, arbitration](../hub.md#groups-devices-arbitration).
- Touch controls come from the hub and avoid HUD bands: [docs/hub.md Touch control layout](../hub.md#touch-control-layout).
- Menus are navigable by gamepad and keys: [docs/hub.md Navigable menus](../hub.md#navigable-menus-the-easy-way).
- Focus rings are the hub's, shown for keys and pad only: [docs/hub.md Focus rings](../hub.md#focus-rings).
- Controls that overlay the game stay clear of hub UI, and the game pauses while it is open: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).

## Options / API

| Export | What |
|---|---|
| `InputSpec` | `{ groups, virtual? }`: what the game declares. |
| `defineControls(hub, spec, width)` | Define the groups; returns a `ControlsHandle`. |
| `ControlsHandle.sync({ playing, extra? })` | Enable or disable groups, only on change. |
| `ControlsHandle.relayout(width)` | Re-define the touch layout if the width changed it. |
| `installMenuNav(hub, { root, back, locked? })` | Make the kit's menus navigable once. |
| `navTargets(root)` | The navigable controls of the top modal or the screens. |
| `canvasNavElements(buttons)` | Canvas buttons as nav targets. |
| `controlHints(hub, cb)` | Call `cb('keys' \| 'touch' \| 'pad')` now and on every change; returns the unsubscribe. |
| `setHudInsets(hub, bands)` | Tell the hub about HUD bands at the top or bottom. |
| `repeatPress(read, opts)` | Held button to repeats (300 ms first, then every 90 ms by default). |

## Tests

- `tests/kit/input/input.test.ts`: enable and disable only on change, a sync while hub UI is open, the touch layout switching at 520 px, nav targets, control hints, HUD insets, `repeatPress`.
- `tests/hub-events/input.test.ts`: the hub input events against the game (FakeHub).

## Hub API used:

- `hub.input.define`, `enable`, `disable`, `autoNavigate`, `setInsets`, `down` (the session reads `pause`).
- `hub.input.source` and `hub.input.on('sourcechange')`.
