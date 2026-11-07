# kit/haptics

Source: `src/kit/haptics/` (KIT: copy byte-identical; change it in the template first).

`kit/haptics` gives a short buzz on Android (`navigator.vibrate`) and on iOS 18 and later (clicking the label of a hidden `<input type="checkbox" switch>`, which taps). The buzz follows the player's Vibration setting and is throttled. A game touches it by calling `ctx.haptic()` on events worth feeling: a pickup, a hit, a win.

## Settled: read this before touching haptics

The owner has asked for these more than once; they are done. Don't re-investigate them, and don't build them again.

- **Every game button buzzes, already.** The kit does it for every button, `[role=button]` and `[data-nav]` press under `#ui` (`menuTaps`, wired by `defineGame`): kit screens, the game's own menus, cards, HUD buttons and modals (they mount in `#ui` too). A game adds nothing per button.
- **There are exactly two buzzes: small and big.** `ctx.haptic()` is the small tick (button presses, picking up a piece); `ctx.haptic(true)` is the big one (a hit, a capture, a win). Use only these. Never call `navigator.vibrate`, never write a game `haptics.ts` or `button-buzz.ts`.
- **What a game does call itself:** taps the kit can't see as buttons, such as a pick on a canvas board, call `ctx.haptic()`. Gameplay controls inside `#ui` that buzz their own way opt out of the menu tick with `data-no-haptic`.
- **The off switch is the kit's Settings → Vibration row** (`settings.data.haptics`, on by default). It silences every buzz, the menu ticks included. Never add a second setting for it.
- **The hub has no haptics API for games to call.** Its only buzz is the online "your turn" buzz (`hub.turns.setYourTurnBuzz`, the player's own switch in the hub's Settings), which turn games get by themselves. Don't go looking for a hub button-buzz function.
- **"I feel nothing on my phone" is a device question first, not a wiring one.** The wiring is covered by the tests below. Check the device with `scripts/kit/vibration-test.html` (open it from `npm run dev` on the phone, over the LAN) and its settings before changing code:
  - Android: the sound mode isn't Silent or Mute, Settings → Sound & vibration → Vibration & haptics → Touch feedback is on, Battery Saver isn't cutting vibration, and the browser supports `navigator.vibrate`.
  - iOS: version 18 or later, Settings → Sounds & Haptics → System Haptics on, and Settings → Accessibility → Touch → Vibration on. If tapping a real switch on the test page gives no tick, no web page can buzz that phone.
  - Only if the test page shows the device buzzes but the kit's pulses don't (4 ms and 12 ms are short for some Android motors) change the pulse lengths, here in the template, for every game.

## What the game does

```ts
step(ctx, run, dt) {
  const got = step(run, dt, ctx.hub.input.vector('move'));
  if (got > 0) ctx.haptic();        // a light tick (4 ms)
}
onHit: (ctx) => ctx.haptic(true);   // a strong buzz (12 ms; two taps on iOS)
```

That is all most games need. To check a real device, run `npm run dev` and open `scripts/kit/vibration-test.html` on the phone.

## What the kit does for you

- Menu buttons tick by themselves: `defineGame` listens for clicks on the `#ui` layer (`menuTaps`), and any `button`, `[role=button]` or `[data-nav]` press there (a tap, Enter or a gamepad press; not disabled) gives a light buzz. That covers the kit's screens and a game's own menus in `#ui`. Gameplay controls that live in `#ui` (a keypad, board cells) opt out with a `data-no-haptic` attribute on them or a parent.
- `defineGame` builds `ctx.haptic` with `makeBuzz`: it does nothing when the Vibration setting is off (`settings.data.haptics`), and drops buzzes closer than 40 ms apart.
- On Android it calls `navigator.vibrate(4)` or `(12)`.
- On iOS (a touch device without `vibrate`) it creates the hidden switch and its label once (ids start with `kit-haptic`) and clicks the label; a strong buzz clicks twice.
- It never throws: some browsers refuse without a user gesture, and a missed buzz is fine.
- Devices that cannot buzz at all (desktop) do nothing.

## Rules it enforces

- Vibration is a player setting, on by default: [settings-ui.md](settings-ui.md).
- Buzz only from a real gesture to be reliable on iOS (the browser decides); the kit does not fake gestures.
- No hub rule applies. The hub has no haptics API for games; its own online "your turn" buzz is separate (see Settled, above).

## Options / API

| Export                                         | What                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `haptic(strong?, env?)`                        | One buzz now, ignoring the setting and the throttle.                                                               |
| `makeBuzz({ enabled, now, minGapMs?, fire? })` | A settings-gated, throttled buzz function (`ctx.haptic`).                                                          |
| `menuTaps(root, buzz)`                         | A light buzz for every menu-control click under `root`; returns the off switch (`defineGame` calls it on `#ui`).   |
| `isMenuControl(target)`                        | Is this click on a menu control (button, `[role=button]`, `[data-nav]`; not disabled or under `[data-no-haptic]`)? |
| `hapticsSupported(env?)`                       | Can this device buzz at all?                                                                                       |
| `HapticsEnv`                                   | `{ nav, doc, idPrefix? }`: what the buzz touches (fakes in tests).                                                 |

`hapticsSupported` can be used to hide the Vibration row on devices that cannot buzz. The standard sheet does not do this today.

## Tests

- `tests/kit/haptics/haptics.test.ts`: Android 4 ms and 12 ms, no vibrate and no touch (nothing, no throw), the iOS label clicked once or twice, the buzz following the setting and being throttled, menu taps (buttons and nav controls tick; disabled, `data-no-haptic` and non-controls don't).

## Hub API used:

- None. (The hub's "your turn" buzz for turn games is the hub's own: `hub.turns.setYourTurnBuzz`.)
