# Devices: keyboard, gamepad, touch and mouse

KIT doc. How a game handles every kind of player input and tells the player
which buttons to press, so it feels like a real console game on a desktop, a
phone and a TV with a controller. The APIs are in [input.md](input.md) (inputs,
menus, button prompts) and [ui.md](ui.md) (focus, chips' looks, the back
guard); this page is how to put them together. For example, Rift Racers
(`diffenderfer-games/rift-racers`, `docs/game.md` § Controls) does all of it.

## 1. The standard

- **Every screen plays with each device alone**: a keyboard, a gamepad, a
  finger. A mouse works wherever a finger does. No screen needs a second
  device to get past it.
- **The screen shows the buttons of the device in hand**: keycaps on a
  keyboard (or with a mouse), Xbox or PlayStation glyphs with a pad, nothing
  but big tappable controls on a touch screen. It swaps the moment the player
  picks up another device, mid-screen, with nothing redrawn.
- **One meaning per button on every screen** (§5): A / Enter goes on, B / Esc
  goes back, Start / Esc pauses.
- **Every control has an obvious focused look** for keys and a pad, and none
  for a finger or a mouse (§7).

## 2. Which device is in use: the last one used

Never decide the device once, from what the hardware could do. Follow the
**last input the player actually used**:

| Input                                     | Means                               |
| ----------------------------------------- | ----------------------------------- |
| a finger or a pen on the screen           | touch                               |
| a key (not a lone modifier, not typing)   | keys                                |
| a mouse click, or the mouse moved ≥ 40 px | keys (a mouse player reads keycaps) |
| a pad button past 0.1 or a stick past 0.3 | pad (the hub's `sourcechange`)      |

Why not the hardware:

- `navigator.maxTouchPoints > 0` is true on **touch-screen laptops** and
  convertibles whose player uses the keyboard, a mouse or a pad. Touch
  controls shown to them cover the game for nothing.
- `(pointer: coarse)` alone is true on some hybrids and false on **tablets
  with a keyboard** whose player still taps; and a phone can have a pad paired.
- So the hardware only picks the **starting** state: `(hover: none) and
(pointer: coarse)` (a phone or tablet, whose main pointer is a finger)
  starts on touch; everything else starts on keys until the screen is touched.
- A small mouse move (a palm on the touchpad while a thumb is on the stick)
  doesn't count; a real move (≥ 40 px since the last touch) or a click does.

What already follows the last input (read these, don't track it again):

| Where                              | Values                                  | Set by                                                                     |
| ---------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `html[data-prompts]`               | `keys`, `pad`, `none`                   | the kit's button prompts ([input.md](input.md#button-prompts))             |
| `html[data-pad-style]`             | `xbox`, `ps`                            | the same, from the pad's id                                                |
| `html[data-hub-input]`             | `keys`, `pointer`, `touch`              | the hub: whether focus shows ([hub.md Focus rings](../hub.md#focus-rings)) |
| `hub.input.source`, `sourcechange` | `keyboard`, `mouse`, `gamepad`, `touch` | the hub's arbitration                                                      |
| `html[data-controls]`              | `keys`, `pad`, `touch`                  | the kit, from `hub.input.source` (`controlHints`)                          |

Key a hint's CSS off `html[data-prompts]`: it is the one that treats a mouse as
keys and a finger as touch, and it swaps live.

**The gap: the hub's touch controls.** The hub shows its on-screen controls on
any touch screen with no pad, so a touch laptop gets them while its player
drives with the keyboard. Until the hub decides that by the last input too
(the recommendation to the hub: `OnScreenControls.isShowing` follows the last
input, as above; then a game needs none of §4's code), a game with touch
controls tells the hub itself (§4).

## 3. What to show for each device

| Device   | Menus                                                                                 | In play                                                      | Words                                           |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| keyboard | a keycap chip on each bound button (Enter, Esc, Q, E…)                                | the game's keys beside what they do (`glyph('use')`, "Swap") | "press", key names                              |
| mouse    | the same keycaps (a mouse player has a keyboard)                                      | the same                                                     | "click"                                         |
| pad      | the pad's glyph: A B X Y, LB RB, LT RT, the d-pad; Xbox letters or PlayStation shapes | the pad's buttons beside what they do                        | button names via chips, never "press A" in text |
| touch    | no chips; every control a big tap target (44 px or more)                              | the hub's on-screen controls; no key hints                   | "tap", "drag"                                   |

- Chips come from the kit: `button(label, fn, { action })`, `bindAction(el,
action)`, `glyph(actions)` ([input.md](input.md#button-prompts)). Their
  looks: `--kit-glyph-*` ([ui.md](ui.md#button-prompts)). Never write a key's
  or a button's name into text: a chip swaps with the device, text doesn't.
- Hide whatever only explains a key on a touch screen, and give the finger
  its own way instead (Rift Racers' colour picker drops its ‹ › arrows and
  lays the swatches out big enough to tap):

  ```css
  html[data-prompts='none'] .my-legend,
  html[data-prompts='none'] .my-hud-keys {
    display: none;
  }
  ```

- A chip says where a button goes on its own: drop a decorative chevron or
  arrow beside it while a chip shows
  (`html[data-prompts='keys'] .my-btn:has(> .kit-glyph[data-keys='yes']) > .my-chev`).
- How to play and tutorials name the controls of the device in use: show the
  chips (`glyph`) for keys and pad, and the touch words under
  `html[data-prompts='none']`.

## 4. Touch controls

- They are the hub's (`InputSpec.virtual(width)`, [input.md](input.md#what-the-game-does));
  where they go and how they avoid each other: [hub.md Touch control layout](../hub.md#touch-control-layout).
  The main action goes bottom right under the right thumb, movement bottom
  left; keep the hub menu's corner clear ([layout.md](layout.md#the-hub-menu-button)).
- Tell the hub about your HUD bands so controls stay off them, again on resize:
  `setHudInsets(hub, { top: [bar], bottom: [strip] })` or `hub.input.setInsets({ top })`.
- A button that names a changing thing (the power-up in hand) updates its face
  with `hub.input.setVirtualHtml(id, html)`, dimmed while it would do nothing.
- Hide them while there is nothing to control (loading, a countdown's
  look over the level, a menu over play) with `hub.input.setVirtualDefault(false)`,
  and give the hub's rule back with `null`. The player's own show/hide in the
  hub menu always wins.
- **Show them only while touch is the last input** (§2). The tracker is small
  and pure, so it can be unit-tested; Rift Racers' `src/game/touch-use.ts` and
  `screens/hud.ts` are the worked example:

  ```ts
  import { hub } from '@diffenderfer-games/hub';

  const MOUSE_TRAVEL = 40;
  const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);
  let touching = matchMedia('(hover: none) and (pointer: coarse)').matches;
  let travel = 0;
  let wanted = true; // false while loading or behind a menu
  let told: false | null | undefined;

  function tell(): void {
    const next = wanted && touching ? null : false; // null: the hub's own rule
    if (next === told) return;
    told = next;
    hub.input.setVirtualDefault?.(next); // (guarded: an older /_hub/hub.js may not have it)
  }
  function set(next: boolean): void {
    travel = 0;
    if (next !== touching) {
      touching = next;
      tell();
    }
  }
  const opts = { capture: true, passive: true };
  addEventListener('pointerdown', (e) => set(e.pointerType === 'touch' || e.pointerType === 'pen'), opts);
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !touching) return;
      travel += Math.hypot(e.movementX, e.movementY);
      if (travel >= MOUSE_TRAVEL) set(false);
    },
    opts,
  );
  addEventListener(
    'keydown',
    (e) => {
      const typing =
        e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName));
      if (!MODIFIERS.has(e.key) && !typing) set(false);
    },
    opts,
  );
  hub.input.on('sourcechange', (s) => {
    if (s === 'gamepad') set(false);
  });
  tell();

  /** Wanted now (the level is on screen) or not (loading, a menu over play). */
  export function touchControls(shown: boolean): void {
    wanted = shown;
    tell();
  }
  ```

  Keep the decision in a function of its own (`(wanted, touching) => false |
null`) and the event wiring separate, so a test can feed it inputs (§9).

- A game with no touch controls at all: `virtual: () => []`. A typing game
  draws its own keyboard ([input.md](input.md#typing-and-word-games)).
- A drag that plays must not scroll or swipe the page: the back guard does it
  in play ([ui.md](ui.md#the-back-guard)); give your own play surfaces
  `touch-action: none` too.

## 5. Button mapping

Menus (the kit's actions, `DEFAULT_PROMPT_BINDINGS`, [input.md](input.md#button-prompts)):

| Pad (Xbox / PS)        | Keys   | Means                                                                       |
| ---------------------- | ------ | --------------------------------------------------------------------------- |
| A / cross              | Enter  | go on: the screen's one primary action (`confirm`)                          |
| B / circle             | Esc    | back, cancel, leave (`back`)                                                |
| X / square             | F      | a secondary action (`alt`)                                                  |
| Y / triangle           | R      | another: a new random level or track, settings (`alt2`)                     |
| LB / RB, L1 / R1       | Q / E  | cycle the screen's main choice: the world, the ship, tabs (`prev` / `next`) |
| LT / RT, L2 / R2       | Z / C  | cycle a second choice: a colour, pages (`page-prev` / `page-next`)          |
| d-pad, left stick      | arrows | move between rows; left and right change the focused row                    |
| Menu / Options (Start) | Esc    | pause in play, resume on the pause screen                                   |

In play the game owns the pad, within these rules:

- **Select (View / Create) is the hub's**: it opens the hub menu (the world's
  menu in the box) and the game's inputs read 0 while it is open. Put nothing
  of the game's on it.
- **B held 0.6 s in the world's box leaves the game**; a short press is the
  game's. Never put a hold-to-do action on B, and never bind `back` on the
  play screen ([hub.md The hub's buttons](../hub.md#the-hubs-buttons)).
- **Start pauses**, and resumes on the pause screen (the kit). Esc too; never a
  letter (a word game types them).
- The main action is A (and Space on a keyboard); analog things go on the
  triggers (throttle, brake); the stick and the d-pad read the same input
  (`gamepad: { axis: [0, '-'], button: [PAD_BUTTON.LEFT] }`).
- A keyboard layout reads both arrows and WASD where it moves.
- Moving the hub's buttons (`hub.input.setPadButtons`) is for a game that truly
  needs Select or a Nintendo layout; the default is to leave them.

## 6. Linear screens

A console menu is driven by a d-pad: up and down move, left and right change,
A goes on, B goes back. Lay every menu out for that:

- **One column, top to bottom**, in reading order, so the pad's moves match
  what the player sees. No grids of small buttons a d-pad has to hunt across.
- **Each setting is one row** that left and right change while it has focus:
  `axisControl(row, (dir) => …)`. Its own ‹ › buttons stay for a mouse and a
  finger; take them out of the navigation (no `data-nav`, `tabIndex = -1`) so
  the row is a single stop. Show a ◀▶ chip on the focused row
  (`glyph(['left', 'right'])`), hidden on touch.
- **The main choice on the shoulders, a second on the triggers**: a ship or
  world picker answers LB / RB wherever the focus is; a colour answers LT / RT.
  Bind its ‹ › buttons (`bindAction(prev, 'prev')`) so they carry the chips.
- **Extras on X and Y** (a new random track on Y / R, settings on Y on the
  title).
- **The first highlight is the screen's Go** (`confirm` comes first in
  `navTargets`); A on a row also goes on (`axisControl`'s act).
- **One way back** (`back`) and one primary (`confirm`) on every screen and
  modal.
- A legend under a busy screen says how it works: `glyph(['up', 'down'])` Move,
  `glyph(['left', 'right'])` Change; hidden on touch.
- A screen that redraws while the player is on it (a lobby) puts the focus
  back on the row it was on.

## 7. Focus

- Every interactable has an obvious focused state for keys and a pad: the
  game's own look through the kit's `--kit-focus-*` variables
  ([ui.md](ui.md#focus); the look: [look.md §3](look.md#3-components)). A
  slider, a row, a card and a swatch count too, not just buttons.
- Never the browser's white or orange box, and nothing at all for a finger or a
  mouse ([polish.md §4](polish.md#4-phones-first)).
- The hub's navigation focuses with `el.focus()`, which isn't always
  `:focus-visible`: style `:focus` under `html[data-hub-input='keys']` and
  `[data-hub-focus]` as well.
- A test can check every control has a look: build each screen, focus each
  control as the hub does and assert one of the game's focus rules matches
  (Rift Racers' `tests/game/focus.test.ts`).

## 8. In play: the HUD's hints

- Show the game's own buttons beside what they do (USE, DROP, SWAP), as chips:
  add them as prompt actions read **from the `play` group itself**, so a chip
  always says what the game reads:

  ```ts
  import { padButtonsOf, type PromptBinding } from '../kit/input/index.ts';

  export const PLAY_PROMPTS: Readonly<Record<string, PromptBinding>> = Object.fromEntries(
    ['use', 'drop', 'swap'].map((name) => {
      const input = controls.groups['play']?.inputs[name];
      return [name, { keys: input?.keys ?? [], pad: padButtonsOf(input?.gamepad) }];
    }),
  );
  // defineGame({ …, prompts: { bindings: PLAY_PROMPTS } }); in the HUD: h('span', {}, glyph('use'), 'Use')
  ```

- In play the chips are hints only: the kit never presses a control from them
  there, and its pad navigation is off when the game reads A or B, so A never
  clicks the HUD's pause button ([input.md](input.md#menus)). The HUD's pause
  button can carry the `pause` chip (`bindAction(pauseBtn, 'pause')`).
- Dim a hint while its button would do nothing; hide the strip on touch (the
  on-screen buttons are the hints there).

## 9. Pause and back on each device

| Device   | Pause                                                                      | Back / leave                                                         |
| -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| keyboard | Esc                                                                        | Esc on a menu; on the title an unused Esc leaves the world's box     |
| pad      | Start; Select opens the hub menu (pauses too)                              | B on a menu; B held 0.6 s leaves the box                             |
| touch    | the HUD's pause button; an edge swipe or the phone's Back (the back guard) | the screen's Back button; on a menu the phone's Back leaves the page |
| any      | hub UI opening, the page hiding                                            |                                                                      |

The kit does all of this ([pause.md](pause.md), [ui.md](ui.md#the-back-guard)).
Your part:

- Keep the `pause` input (Esc, Start) in `play`.
- A `keydown` listener of your own calls `preventDefault()` on Esc only when it
  used it, ignores untrusted events (the hub's controller adapter sends them)
  and stays out of text fields ([world.md](world.md#playing-over-the-world),
  [input.md](input.md#what-hubinput-does-facts-from-the-clients-types)).
- A race or a live match can't pause: the pause button asks to leave instead.
- Pausing when the pad unplugs mid-play is a console habit worth copying: a
  `gamepaddisconnected` listener that calls `ctx.session.pause()` while playing.

## 10. Testing

- **The decision, as a unit test**: feed the last-input tracker a sequence (a
  touch, a key, a pen, a mouse click, a short and a long mouse move, the pad)
  and assert what it shows; a phone query starts on touch, a touch laptop
  doesn't (Rift Racers' `tests/game/touch-use.test.ts`).
- **A pad through the real hub**: `padHarness()` with `FakePad` (a PlayStation
  pad: an id with "DualSense"), [testing.md](testing.md#a-gamepad-through-the-real-hub):
  the game's inputs read right, menus move and press, chips switch to
  `data-prompts="pad"` and `data-pad-style="ps"`. The kit's own:
  `tests/kit/input/prompts.test.ts`.
- **Buttons answer their keys**: press Enter, Esc, Q / E, the shoulders on each
  screen and check the right control fired (Rift Racers'
  `tests/game/console-ui.test.ts`).
- **Browser checks**: the shots' `phone`, `phone-land` and `tablet` sizes
  emulate touch ([screenshots.md](screenshots.md)); `npm run ui:check` checks
  tap targets of 44 px there. For menus as a pad player sees them, a scenario
  sets the mode before the shot
  (`await c.page.evaluate(() => Object.assign(document.documentElement.dataset, { prompts: 'pad', padStyle: 'ps' }))`).
- **Real devices**: a phone on the LAN link for touch. A gamepad needs a
  **secure context** (HTTPS or `localhost`): on `http://192.168.x.x` the
  browser shows no pads at all, so test pads on `localhost` or the deployed
  HTTPS site. Try a touch laptop if there is one: keyboard play must show no
  touch controls.

## 11. Checklist

- [ ] Every screen plays with keys alone, a pad alone and a finger alone.
- [ ] Chips on every bound button: keycaps, Xbox, PlayStation, none on touch; they swap live.
- [ ] No key or button names in text; touch text says "tap" / "drag".
- [ ] Touch controls show only while touch is the last input, never on a touch laptop played with keys; hidden while loading and behind menus; clear of the HUD (`setInsets`) and the hub menu's corner.
- [ ] A / Enter go on, B / Esc go back, Start / Esc pause, on every screen; shoulders and triggers cycle the main and second choice; X / Y the extras.
- [ ] Nothing of the game's on Select; nothing held on B; no `back` binding on the play screen.
- [ ] Menus are one column; each setting a row changed with left and right; the first highlight is Go.
- [ ] Every interactable has the game's focus look for keys and pad; no browser box; nothing on touch.
- [ ] The HUD shows the game's own buttons as chips (from the `play` group), hidden on touch.
- [ ] Esc is `preventDefault()`ed only when used; an edge swipe or Back in play pauses.
- [ ] Unit test of the input decision; a `padHarness` test; shots at phone size and in pad mode; a real pad on `localhost`.
