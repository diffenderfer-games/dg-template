# kit/pause

Source: `src/kit/pause/` (KIT: copy byte-identical; change it in the template first).

Pausing the game when hub UI opens (the menu, a chat, an invite), when the page hides, or when the player asks. Every game needs this, single-player included. `defineGame` calls `installPause` once at boot and connects it to the pause screen and the play screen. The game picks only one thing: whether it resumes by itself when the hub closes (`resumeOnClose`). It also decorates the pause screen if it wants.

## What the game does

```ts
import type { GameDefinition } from '../kit/boot/index.ts';

const game: Partial<GameDefinition<Profile, Run>> = {
  resumeOnClose: false, // action games: show the pause screen when the hub closes (default)
  // resumeOnClose: true, // turn-based or idle games: carry on if the hub caused the pause
  screens: {
    pause: (ctx, el) => { /* add game-specific rows to the kit's pause screen */ },
  },
};

// anywhere with a GameContext
ctx.session.pause();
ctx.session.resume();
```

Using the module directly (as `defineGame` does):

```ts
import { installPause, syncMenuButton } from '../kit/pause/index.ts';

const pause = installPause(hub, { canPause, show, hide, resumeOnClose: false }, { clock });
syncMenuButton(hub, { playing: true, paused: pause.paused });
```

## What the kit does for you

- Registers `hub.overlay.autoPause` exactly once, at boot.
- Never lets a hub close undo a pause the player made (the player's pause takes over a hub pause).
- Pauses when the page is hidden.
- Never pauses when `canPause()` is false: on menus, in a race (the pause button becomes "Leave race?") and in a live online match.
- Swallows the click that closed the hub menu for 300 ms (`SETTLE_MS`) so it does not reach the game.
- Ignores the hub's on-screen keyboard (reason `keyboard`): typing in the game's own text field does not pause.
- Hides the hub menu button while actively playing and shows it on the pause screen and menus (`syncMenuButton`).

## Rules it enforces

- Pause when hub UI opens, close shows the pause screen for action games: [docs/multiplayer.md §4](../multiplayer.md#4-pausing-when-the-hub-opens-every-game).
- The `hub.overlay` API and its events: [docs/hub.md Pausing when hub UI opens](../hub.md#pausing-when-hub-ui-opens-huboverlay).
- Menu button hidden during play, shown when paused: [docs/hub.md Hiding the menu during play](../hub.md#hiding-the-menu-during-play).
- No pausing a live online match (`hub.mp.setBusy`): [docs/multiplayer.md §13](../multiplayer.md#13-definition-of-done).

## Options / API

| Name | What it is |
| --- | --- |
| `installPause(hub, spec, { clock, doc?, win? })` | Installs the rules once; returns a `PauseHandle` |
| `PauseSpec` | `canPause()`, `show(why)`, `hide()`, `resumeOnClose` |
| `PauseReason` | `'hub'`, `'player'` or `'hidden'` |
| `PauseHandle#paused` / `why` | Current state and reason (null when playing) |
| `PauseHandle#pause(why)` | False when `canPause()` refuses; a `player` pause upgrades a `hub` or `hidden` one |
| `PauseHandle#resume()` | Hide the pause screen |
| `PauseHandle#justClosed()` | True for 300 ms after hub UI closed |
| `PauseHandle#dispose()` | Remove every listener |
| `SETTLE_MS` | 300 |
| `syncMenuButton(hub, { playing, paused })` | Idempotent menu button visibility |

## Tests

- `tests/kit/pause/pause.test.ts`
- `tests/hub-events/overlay.test.ts` (rows 1 to 8, against the stub game)
- `tests/hub/kit/pause.test.ts` (a real hub: open the menu, check the overlay log and the pause screen)
- `tests/hub/kit/fake-parity.test.ts` (FakeHub gives the same overlay log as the real hub)

## Hub API used:

- `hub.overlay.autoPause({ pause, resume, resumeOnClose })`
- `hub.overlay.on('open' | 'close', cb)`
- `hub.menu.visible`, `hub.menu.setVisible(visible)`
- Related, set elsewhere: `hub.mp.setBusy` (online match) makes `overlay.canPause` false.
