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
- `installMenuNav` makes every `[data-nav]` control in the kit UI navigable (`hub.input.autoNavigate`). Targets are the topmost open modal's controls, else the current screen's; hidden and disabled controls are skipped. Back closes the top modal unless it is locked, otherwise it pauses, resumes or leaves the result screen. See [Menus](#menus) for when it is on and whose focus look shows.
- **Start resumes**: on the pause screen the `pause` input's keys and pad button resume (the kit's `kit:resume` group, enabled only while paused), once the press that paused was let go.
- **Esc on a keyboard is the same back**, and it calls `preventDefault()` only when something went back, or in play when an enabled group reads Esc (the `pause` input: the session pauses on the next step). In the world's box an unhandled Esc closes the box, so on the title (nothing to go back to), a locked modal or under hub UI the kit leaves it alone ([world.md](world.md#playing-over-the-world)). A `keydown` listener of your own that uses Esc calls `preventDefault()` too, only when it used it.
- The session reads `pause` once per step (held now, not last step), so a press is never missed in a frame with no step nor seen twice in one with two.
- `controlHints` sets `html[data-controls]` to `keys`, `touch` or `pad` as the player switches device, so CSS and screens can show the right hint.

## Menus

- **Off in play when A or B are the game's.** By default the kit's pad navigation has no targets during active play
  when the `play` group reads the pad's act or back button (A, B: `hub.input.padButtons`), so A is your action and
  never clicks a HUD button (the pause button, a restart), and B does nothing there. Everywhere else (title, pause,
  result, modals, and play screens of games that leave A and B alone) it is on. Esc on a keyboard is unaffected.
  Override with `GameDefinition.nav.active(ctx, state)` (`state.byDefault` is the kit's answer): e.g. a card game whose
  play screen is `[data-nav]` cards returns `true`.
- **Focus is the kit's**: the hub's ring stays off over the kit's menus; the kit's CSS draws it, themed with
  `--kit-focus-*` ([ui.md](ui.md#focus)). `nav: { hubRing: true }` asks for the hub's ring as well.
- HUD buttons keep `data-nav` (tests and the screenshot runner use it); don't strip it to dodge the pad.

## The gamepad

- **Mappings** (`gamepad` on an input) take one button or a list and one axis or a list, so one input reads a stick,
  the d-pad and a shoulder button at once: `left: { keys: ['a'], gamepad: { axis: [0, '-'], button: [14, 4] } }`.
  `PAD_BUTTON` (`@diffenderfer-games/hub/input`) names the standard indices.
- **Dead zone:** a stick reads 0 up to its `deadzone` (default 0.12) and then rises smoothly from 0 to 1 (rescaled, no
  jump); `curve` shapes it (a power, or a function). `deadzone: 0` gives the raw stick to a game that shapes it
  itself (a racer's steering curve) ([hub.md Gamepad mapping](../hub.md#gamepad-mapping)).
- **The hub's buttons** (`hub.input.padButtons`): **Select opens the hub menu** (the game's inputs read 0 while it is
  open: put nothing on it), **A and B** drive menus, and **B held 0.6 s in the world's box leaves the game** (a short
  press is yours). Move them with `hub.input.setPadButtons({ menu, act, back })` (e.g. `{ menu: [16] }` frees Select)
  ([hub.md The hub's buttons](../hub.md#the-hubs-buttons)). Start is the kit's pause.
- The pad becomes the active device on any button past 0.1 or a stick past 0.3; until then (and after a mouse move)
  the hub reads no pad values. Edges: `hub.input.down(name)` / `up(name)` per frame.
- **The Gamepad API needs a secure context**: HTTPS or `localhost`. A phone or PC opening the dev server on a LAN IP
  over http (`http://192.168.x.x:5173`) sees no pads at all; test pads on `localhost` (or over HTTPS).
- Test with a real hub input system and a fake pad: `padHarness()` ([testing.md](testing.md#a-gamepad-through-the-real-hub)).

## Helpers a game may use

- `setHudInsets(hub, { top, bottom })`: keep auto-placed touch controls off your HUD bands. `defineGame` does not call it.
- `canvasNavElements(buttons)`: make canvas buttons (Pixi menus) nav targets from their bounds and `act`.
- `repeatPress(read, { first, next })`: turn a held button into repeats. Call the returned function once per frame with `dt` in ms.
- `navTargets(root)`: the list `installMenuNav` uses (also handy in tests).

## What `hub.input` does (facts from the client's types)

- **`keys`** are `KeyboardEvent.key` values, case-insensitive (`' '` is Space).
- **One `gamepad` mapping per input**, holding any number of buttons and axes (`button: [12, 4]`,
  `axis: [[0, '-'], [2, '-']]`), plus `deadzone` and `curve` (`GamepadMapping`). The strongest source wins.
- **`down(name)`, `up(name)` and `pressed(name)` are per frame**, not per step: with two fixed steps in
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
- Focus shows for keys and pad only, the kit's look over the kit's menus (the hub's ring is off there): [docs/hub.md Focus rings](../hub.md#focus-rings).
- Controls that overlay the game stay clear of hub UI, and the game pauses while it is open: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).

## Options / API

| Export | What |
|---|---|
| `InputSpec` | `{ groups, virtual? }`: what the game declares. |
| `defineControls(hub, spec, width)` | Define the groups; returns a `ControlsHandle`. |
| `ControlsHandle.sync({ playing, paused?, extra? })` | Enable or disable groups, only on change (`paused`: the kit's `kit:resume`). |
| `ControlsHandle.usesPadButton(buttons, group?)` | Does a group (default `play`) read any of these pad buttons? |
| `padButtonsOf(mapping)`, `RESUME_GROUP`, `RESUME_INPUT` | A mapping's buttons as a list; the pause screen's resume group and input. |
| `ControlsHandle.relayout(width)` | Re-define the touch layout if the width changed it. |
| `ControlsHandle.usesKey(key)` | Does an enabled group read this key? (Esc in play is then the game's.) |
| `installMenuNav(hub, { root, back, locked?, ownsEscape?, keys?, active?, ring? })` | Make the kit's menus navigable once, and Esc the same back; `back()` returns whether it went anywhere. Returns the unsubscribe. |
| `navTargets(root)` | The navigable controls of the top modal or the screens. |
| `canvasNavElements(buttons)` | Canvas buttons as nav targets. |
| `controlHints(hub, cb)` | Call `cb('keys' \| 'touch' \| 'pad')` now and on every change; returns the unsubscribe. |
| `setHudInsets(hub, bands)` | Tell the hub about HUD bands at the top or bottom. |
| `repeatPress(read, opts)` | Held button to repeats (300 ms first, then every 90 ms by default). |

## Tests

- `tests/kit/input/input.test.ts`: enable and disable only on change, a sync while hub UI is open, the touch layout switching at 520 px, `usesKey`, nav targets, control hints, HUD insets, `repeatPress`.
- `tests/hub-events/input.test.ts`: the hub input events against the game (FakeHub), when Esc is handled, Start resuming, the pad's menus off in play when A or B are the game's, the back guard.
- `tests/kit/testing/fake-pad.test.ts`: a fake pad through the real hub input system (dead zones, button lists, the active device, the kit's menus and focus).
- `tests/hub/kit/embed.test.ts`: Esc in the world's box on a real hub (the title leaves, play pauses).

## Hub API used:

- `hub.input.define`, `enable`, `disable`, `autoNavigate` (`{ back, ring }`), `padButtons`, `setInsets`, `value` (the session reads `pause` per step), `hub.overlay.isOpen` (Esc under hub UI is the hub's).
- `hub.input.source` and `hub.input.on('sourcechange')`.
