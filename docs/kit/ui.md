# kit/ui

Source: `src/kit/ui/` (KIT: copy byte-identical; change it in the template first).

`kit/ui` is the DOM layer over the canvas: one screen at a time, modals, toasts, buttons, toggles and sliders, a tiny DOM builder, and a little juice (banners, count-ups, confetti). Everything is DOM so the hub's menu navigation, focus rings, on-screen keyboard and screen readers work. A game touches it when it decorates the title, HUD or result screens, adds settings rows, shows a message, or builds its own menus.

## What the game does

Build elements with `h()` and the control helpers, and skin the result with CSS variables in `src/game/theme.css`.

```ts
import { h } from '../kit/ui/dom.ts';
import { button, segmented, toggleRow } from '../kit/ui/controls.ts';
import { openModal, confirm } from '../kit/ui/modal.ts';
import { toast, banner, confetti, countUp } from '../kit/ui/index.ts';

const el = h('div.panel', {}, h('p', {}, playerName), button('Go', start, { cls: 'kit-primary', testid: 'go' }));
const sure = await confirm({ title: 'Leave?', yes: 'Leave', no: 'Stay' }); // true for yes
openModal({ title: 'Colours', body: segmented(COLOURS, current, setColour, 'colour'), buttons: [{ label: 'Close', primary: true }] });
toast('Saved', { kind: 'good' }); // or ctx.toast('Saved')
```

Title, HUD, pause and result decoration go through `GameDefinition.screens` (see [boot.md](boot.md)); each hook gets the screen's element.

## What the kit does for you

- `mountUi` creates `#ui`, adds the kit's CSS once, and reads the system's reduced-motion preference. `defineGame` calls it.
- `Screens.show(name, build)` swaps the screen, sets `data-screen` on the root, focuses `[data-autofocus]` (showing the same screen again marks it `data-redraw="true"`, which skips entrances, and keeps focus on a part it reuses), and reports presence (`playing` for `play`, `menu` otherwise), only when it changes.
- `h()` only ever sets text (`textContent`), never HTML, so player names and chat cannot inject markup.
- Every control gets `data-nav` (menu navigation finds it) and a `data-testid` (tests and scripts press it by name). Controls are at least 44 px.
- Modals: the topmost `[data-modal]` is what navigation targets. Escape and back close it unless it is locked (a choice the game is waiting on).
- Juice (`banner`, `countUp`, `confetti`, `stagger`) is off with reduced motion and keeps the result.

## Theming

`KIT_CSS` is themed by CSS variables the game sets in `src/game/theme.css`: `--kit-bg`, `--kit-panel`, `--kit-fg`, `--kit-muted`, `--kit-accent`, `--kit-accent-fg`, `--kit-accent-2`, `--kit-warn`, `--kit-radius`, `--kit-font`. Screens keep clear of the safe area, the race HUD (`--hub-race-hud-top` and `--hub-race-hud-bottom`) through `--kit-top` and `--kit-bottom`. Focus rings use the hub's `--hub-focus-*` variables and show only for keys and pad.

## Styling the kit's screens

The kit puts its CSS (`<style id="kit-css">`) **first** in `<head>`, so the game's
`src/game/theme.css` comes after it and wins every tie. Override with plain selectors:
`:root { --kit-bg: #1b1030; }`, `.kit-btn { border-radius: 18px; }`. No `html:root` or
`html .kit-btn` tricks are needed. The look every game is held to is
[look.md](look.md); the kit's default look is only a scaffold.

## The kit's screen markup

What the kit draws into `#ui` (`#ui[data-screen]` is the current screen). Tests, the
screenshot runner and menu navigation go by `data-testid` and `data-nav`, never by
structure, so a game may restyle any of it, move `.kit-menu` into its own panel, or
replace a button's contents, as long as the buttons keep their test ids.

| Screen | Markup (test ids in brackets) |
| --- | --- |
| title | `div.kit-title-screen.kit-dim` > `h1.kit-title` [`game-title`], `p.kit-tagline` (when there is a tagline), `div.kit-menu` > the buttons: `continue` (the first saved game) and `continue-<id>` (the others), `play`, `daily`, `race`, `race-browse`, `turns-new`, `online`, `quick-match`, `settings`, `howto` (only the features the game has) |
| loading | `div.kit-loading` > `p.kit-tagline` |
| play | `div` > `div.kit-corner` > `button.kit-btn.kit-pause-btn` [`pause`]; `div.kit-hud` [`hud`] (the game's `screens.hud` mounts into it) |
| pause | `div.kit-dim` > `h2.kit-title`, `div.kit-menu` > [`resume`], [`restart`], [`settings`], [`quit`] |
| result | `div.kit-dim` > `h2.kit-title` [`result-title`], `div.kit-result-body` (the game's `screens.result` fills it), `div.kit-menu` > [`play-again`], [`quit`] |
| modals | `div.kit-modal` [`modal`, or the modal's own id: `howto`, `confirm`, `settings`…] > `div.kit-modal-sheet` > `h2.kit-modal-title`, `div.kit-modal-body`, `div.kit-modal-buttons` (`confirm-yes`, `confirm-no`, `howto-ok`) |

A kit button is `button.kit-btn[data-nav]` (`.kit-primary` for the main one) >
`span.kit-btn-icon` (optional), `span.kit-btn-label`, `span.kit-btn-sub` (optional: the
Continue row's label, "Done today"). Buttons in `.kit-menu` slide in one after another
(`stagger`).

## Toasts

`toast(text, { ms?, kind?, actions? })` shows a short message and returns a dismiss function. It closes itself after 3 s (8 s with actions) or when an action is pressed.

- The same text again replaces the toast already showing, so a repeated message does not stack.
- During touch play the toast stack moves from the bottom to just under the HUD (`top: var(--kit-top) + 56px`), because the on-screen controls own the bottom. This applies when `html[data-controls="touch"]` is set or the pointer is coarse, and only on the `play` screen. On other screens and on desktop the stack sits at the bottom.
- Kinds: `info`, `good`, `warn`. Toasts are `role="status"` in an `aria-live="polite"` stack.

## Sharing a link

`shareLink({ url, title, text? })` (kit/ui/share.ts) hands a link on the way the hub's own
share buttons do: the browser's share sheet (`navigator.share`; closing it ends there), else
the clipboard with a "Link copied" toast, else a dialog with the link in a read-only,
preselected field and a Copy button (never `window.prompt`). The online lobby's
**Share the invite link** (`turns-copy-link`) uses it; the raw link isn't shown.

## Checking the layout

`npm run ui:check` (`scripts/kit/ui-check.ts`) builds the game (skip with `--no-build`), serves `dist/`, and opens it in headless Chrome at four sizes: desktop 1280 by 800, phone 390 by 844, phone landscape 844 by 390, tablet 820 by 1180. On each size it shows the title, the play screen (`__game.newGame`) and the pause screen (`__game.pause`) and checks:

- the page does not scroll sideways;
- every visible `#ui` button is inside the viewport;
- on touch sizes, every button is at least 44 by 44 CSS px;
- no unexpected console errors (the hub's benign ones are ignored).

It prints one line per size and screen and exits 1 if any check failed. Run it after changing any screen, the theme or the HUD. It needs the test hook drivers, which it enables with `__HUB_TEST__`.

## Rules it enforces

- Render delivered text only, as text: [docs/multiplayer.md §10](../multiplayer.md#10-chat-in-your-game) and [Sending and rendering](../multiplayer.md#sending-and-rendering).
- Navigable menus and focus rings: [docs/hub.md Navigable menus](../hub.md#navigable-menus-the-easy-way), [Focus rings](../hub.md#focus-rings).
- Keep clear of the hub menu button: [docs/hub.md Where the menu sits](../hub.md#where-the-menu-sits).
- Leave room for the race HUD: [docs/multiplayer.md §14.5](../multiplayer.md#145-testing).

## Options / API

| Export | What |
|---|---|
| `h(tag, attrs, ...kids)`, `append`, `clear` | The DOM builder (`'div.a.b'` adds classes; strings are text). |
| `button`, `segmented`, `toggleRow`, `sliderRow` | Navigable controls with test ids. |
| `openModal`, `confirm`, `topModal`, `closeTopModal` | Modals; `ModalHandle` has `close()` and `setLocked()`. |
| `toast` | Short message with optional actions. |
| `Screens` | One screen at a time with presence. |
| `mountUi`, `ui()` | The `#ui` root, its clock and `reducedMotion`. |
| `banner`, `countUp`, `confetti`, `stagger` | Juice. |
| `KIT_CSS` | The kit's stylesheet. |

## Tests

- `tests/kit/ui/ui.test.ts`: `h()` escapes text, `Screens.show` and presence, locked modals, `confirm`, toast actions and timeouts, the same message replacing the one showing, navigable named controls, reduced-motion juice, the settings sheet.
- `npm run ui:check` for real layouts.

## Hub API used:

- `hub.presence.set` (through `Screens`, wired by `defineGame`). Nothing else; menu navigation is in [input.md](input.md).
