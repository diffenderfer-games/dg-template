# kit/save

Source: `src/kit/save/` (KIT: copy byte-identical; change it in the template first).

Long-term progress (unlocks, bests, coins) and device settings. The profile is saved to the hub's cloud slot and mirrored in localStorage. It is guarded so progress is never lost when a read fails, two devices write, or the player switches accounts. Settings (sound, music, vibration) belong to the device and never go to the hub. `defineGame` creates both: you give it a `ProfileSpec` and read `ctx.profile` and `ctx.settings`.

## What the game does

Fill `profile` in the game definition, then change the profile only through `ctx.profile.update`.

```ts
import { maxOf, type ProfileSpec } from '../kit/save/index.ts';

type Profile = { best: number; played: number };

const profile: ProfileSpec<Profile> = {
  version: 1, // bump and add migrate() when the shape changes
  defaults: () => ({ best: 0, played: 0 }),
  merge: (cloud, local) => ({ best: maxOf(cloud.best, local.best), played: maxOf(cloud.played, local.played) }),
  validate: (x): x is Profile => typeof x === 'object' && x !== null && 'best' in x && 'played' in x,
};

// in onResult(ctx, run, outcome), a normal game only:
ctx.profile.update((p) => { p.best = Math.max(p.best, run.score); p.played++; });
```

`ctx.profile.data` is usable at once (defaults or the local copy) and is updated in place when the cloud copy loads. `ctx.profile.onChange` fires on every change.

## What the kit does for you

### The guards

1. No push before the cloud read answers.
2. A failed or `save_unknown` read means "unknown", not "empty": nothing is pushed until a later read succeeds (a 401 means signed out, so there is nothing to protect).
3. Progress earned during a slow load is merged, not lost.
4. Each push re-reads and merges onto the latest copy, one at a time. It never writes over a copy it could not read, or one saved by a newer version of the game.
5. An account switch cancels the pending push and re-reads. A guest's progress carries into the account it logs in to; one account's progress never carries into another.
6. Old localStorage keys (`legacy`) fold in once, then stay as `<key>::folded`.
7. `hub:reset` (the menu's "Reset game") wipes the game's local copies.
8. A daily, race or online game never writes the profile unless `allowInDaily: true`.

### Merging

A merge must never lose progress and must give the same answer however often it runs. Use the helpers: `maxOf`, `minOf`, `unionOf`, `newerOf`, `mergeRecords`, `compareProgress`. Never add the two sides: a session would count twice.

### Local copy

Per account, tagged with its owner (`owner` must match the signed-in id or the copy is ignored). Turn it off with `localMirror: false`.

### Settings

`createSettings(spec, store)` keeps typed, versioned device settings under `spec.key`. `defineGame` makes the kit's (`${slug}:settings`).

## Rules it enforces

- Profile writes during a daily, race or online game: [docs/hub.md Daily challenges](../hub.md#daily-challenges).
- Cloud slot, stats and the first-read rule: [docs/hub.md Saves and stats](../hub.md#saves-and-stats).
- Moving an existing localStorage save to the cloud: [docs/hub.md Cloud-syncing a game that already has a localStorage save](../hub.md#cloud-syncing-a-game-that-already-has-a-localstorage-save).
- A save made offline is queued and replayed, `save_unknown` when never seen: [docs/hub.md Saves offline](../hub.md#saves-offline).
- Break a rule (a write during a daily) and `ruleBroken` throws in dev and tests, warns in production.

## Options / API

| Export | What it is |
| --- | --- |
| `ProfileSpec<P>` | `slot?`, `version`, `defaults`, `merge`, `validate`, `migrate?`, `localMirror?`, `legacy?`, `debounceMs?` (default 1000) |
| `createProfile(hub, spec, deps)` | The guarded profile; returns a `ProfileStore<P>` |
| `ProfileStore#data / state / update / ready / flush / onChange / dispose` | `state` is `loading`, `ready` or `unknown` |
| `wrapProfile`, `unwrapProfile`, `replaceContents` | The saved `{ v, data }` envelope; `unwrapProfile` gives `none`, `ok`, `invalid` or `newer` |
| `createProfileLocal(spec, slug, store)` | The owner-tagged local copy (`read`, `write`, `foldLegacy`, `wipe`) |
| `createSettings(spec, store)`, `SettingsSpec`, `SettingsStore` | Device settings (`data`, `set`, `onChange`) |
| `maxOf`, `minOf`, `unionOf`, `newerOf`, `mergeRecords`, `compareProgress` | "Only grows" merge helpers |
| `readFailure`, `isSaveUnknown`, `isOfflineError`, `SAVE_UNKNOWN` | What a failed hub read means |

## Tests

- `tests/kit/save/profile.test.ts` (one regression test per guard)
- `tests/kit/save/settings-merge.test.ts`
- `tests/hub-events/progress.test.ts` (auth, reset, online and sync events against the stub game)

## Hub API used:

- `hub.me()`
- `hub.getSave(slot)`, `hub.putSave(slot, data)`
- `hub.onStatus(cb)`
- Window events: `hub:auth`, `hub:reset`, `hub:online`, `hub:sync`
