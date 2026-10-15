# kit/haptics

Source: `src/kit/haptics/` (KIT: copy byte-identical; change it in the template first).

`kit/haptics` gives a short buzz on Android (`navigator.vibrate`) and on iOS 18 and later (clicking the label of a hidden `<input type="checkbox" switch>`, which taps). The buzz follows the player's Vibration setting and is throttled. A game touches it by calling `ctx.haptic()` on events worth feeling: a pickup, a hit, a win.

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

- `defineGame` builds `ctx.haptic` with `makeBuzz`: it does nothing when the Vibration setting is off (`settings.data.haptics`), and drops buzzes closer than 40 ms apart.
- On Android it calls `navigator.vibrate(4)` or `(12)`.
- On iOS (a touch device without `vibrate`) it creates the hidden switch and its label once (ids start with `kit-haptic`) and clicks the label; a strong buzz clicks twice.
- It never throws: some browsers refuse without a user gesture, and a missed buzz is fine.
- Devices that cannot buzz at all (desktop) do nothing.

## Rules it enforces

- Vibration is a player setting, on by default: [settings-ui.md](settings-ui.md).
- Buzz only from a real gesture to be reliable on iOS (the browser decides); the kit does not fake gestures.
- No hub rule applies; the hub has no haptics API.

## Options / API

| Export | What |
|---|---|
| `haptic(strong?, env?)` | One buzz now, ignoring the setting and the throttle. |
| `makeBuzz({ enabled, now, minGapMs?, fire? })` | A settings-gated, throttled buzz function (`ctx.haptic`). |
| `hapticsSupported(env?)` | Can this device buzz at all? |
| `HapticsEnv` | `{ nav, doc, idPrefix? }`: what the buzz touches (fakes in tests). |

`hapticsSupported` can be used to hide the Vibration row on devices that cannot buzz. The standard sheet does not do this today.

## Tests

- `tests/kit/haptics/haptics.test.ts`: Android 4 ms and 12 ms, no vibrate and no touch (nothing, no throw), the iOS label clicked once or twice, the buzz following the setting and being throttled.

## Hub API used:

- None.
