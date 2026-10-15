# kit/settings-ui

Source: `src/kit/settings-ui/` (KIT: copy byte-identical; change it in the template first).

`kit/settings-ui` is the standard settings sheet: sound, sound effects volume, music, music volume, vibration and reduced motion, plus any rows the game adds. Settings are device-local (`kit/save` `createSettings`). A game touches it only to add its own rows (difficulty, colours, hints).

## What the game does

Return DOM rows from `settingsRows`. They are added under the standard ones, in the order given.

```ts
import { segmented, toggleRow } from '../kit/ui/controls.ts';

const game: GameDefinition<Profile, Run> = {
  // ...
  settingsRows: (ctx) => [
    toggleRow('Show hints', ctx.profile.data.hints, (on) => ctx.profile.update((p) => { p.hints = on; }), 'setting-hints'),
    segmented(LEVELS, ctx.profile.data.level, (v) => ctx.profile.update((p) => { p.level = v; }), 'setting-level'),
  ],
};
```

Rows that belong to the device (a colour-blind palette) can use `ctx.settings.set(...)` instead of the profile. The settings store is typed `KitSettings`, so a game-only device setting is stored in the profile or its own store, not here.

## What the kit does for you

- The Settings button on the title and pause screens opens the sheet (`defineGame` wires `settingsSheet`).
- Each change is saved at once to `<slug>:settings` in local storage.
- Sound, music and volumes are read by `kit/audio`; vibration is read by `kit/haptics` (`ctx.haptic`); reduced motion turns the kit's juice and animations off. See [audio.md](audio.md), [haptics.md](haptics.md) and [ui.md](ui.md).
- The reduced-motion default follows the system's `prefers-reduced-motion`.
- "Reset game" is not here: it is the hub menu's (`hub:reset`, which clears the saved game). The kit only offers local preferences.

## Rules it enforces

- Controls are navigable, named and at least 44 px: [docs/hub.md Navigable menus](../hub.md#navigable-menus-the-easy-way).
- Respect the player's motion preference: [ui.md](ui.md) (juice is off with reduced motion).
- Sound is unlocked on a gesture and ducked on pause: [docs/audio.md](../audio.md).

## Options / API

| Export | What |
|---|---|
| `KitSettings` | `{ sound, music, musicVolume, sfxVolume, haptics, reducedMotion }`. |
| `kitSettingsDefaults()` | The defaults (volumes 0.9 and 0.7, everything on, reduced motion from the system). |
| `settingsSheet({ settings, haptics?, rows?, onClose? })` | Open the sheet as a modal; returns a `ModalHandle`. |

Test ids: `settings` (the modal), `setting-sound`, `setting-sfx-volume`, `setting-music`, `setting-music-volume`, `setting-haptics`, `setting-reduced-motion`, `settings-close`. Pass `haptics: false` to hide the vibration row (`defineGame` does not pass it).

## Tests

- `tests/kit/ui/ui.test.ts`, "settings sheet": toggles persist and reduced motion turns the juice off.
- `tests/kit/save/` covers the settings store itself.

## Hub API used:

- None. Settings live in the browser's local storage; the hub's cloud profile is `kit/save`'s job.
