# kit/resume

Source: `src/kit/resume/` (KIT: copy byte-identical; change it in the template first).

The Continue slot: the game in progress, saved to the hub's `hub.resume` so the home page can show a Resume card and the title screen can show Continue. Players see "Continue" and "Your saved game", never "run". `defineGame` creates the slot from the `run` field of the game definition and saves, clears and restores for you. The game only describes its saved shape.

## What the game does

Give `run` a version, a validator and a plain-words progress label.

```ts
import type { ResumeSpec } from '../kit/resume/index.ts';

const run: ResumeSpec<Run> = {
  version: 1, // bump when Run changes shape: older saves then read as nothing saved
  validate: isRun, // (x: Json) => x is Run; check every field you rely on
  progress: (r) => ({ label: `${r.score} of ${r.target} points`, fraction: r.score / r.target }),
  title: (r) => (r.mode === 'daily' ? 'Daily' : null), // optional name
  // legacySlot: 'run',  // an old hub.getSave slot that used to hold the game; migrated once, then deleted
};
```

`Run` must be plain JSON: store `SeededRng.snapshot()` (see [rng](rng.md)), not the generator. Inside hooks you can read `ctx.resume.known` and call `ctx.resume.clear()` if you end a game yourself.

## What the kit does for you

- Saves the game in progress when it changes and when the page hides, and clears it when the game ends (won, lost, quit, new game).
- Does one cached, single-flight lookup (`load`), validates it with your `validate`, and reads a version mismatch as nothing saved.
- Waits for that lookup (at most 8 s, `lateMs`) before a new game replaces the saved one (`beforeNewGame`).
- If a saved game is found only after a new game started, offers it (`offerLate`, once) instead of losing it. The player sees "Found your saved game".
- Migrates an old `getSave` slot once (`legacySlot`), then deletes it.
- Warns in the console when a progress label breaks the wording rules (`wordingProblems`).
- A save the hub refuses (no game slug in the address, a state over the size limit) is skipped with one console warning: it never throws into the session's loop, so the game keeps playing.
- Never saves in a race or an online match. In a daily it saves to the day (`hub.daily.save`), and `clear()` starts the day over from its seed. A normal game is never saved while the hub has a day active (the hub would save it to the day).
- The saved game is one of the title's Continue rows, with the label `progress` gave ([saved.md](saved.md)).

## Rules it enforces

- One slot per player per game, latest save wins, never for rooms, races or dailies: [docs/hub.md Saved runs](../hub.md#saved-runs-hubresume) (a daily saves to its day: [Days in progress](../hub.md#days-in-progress-saved-games)).
- What goes in `state`: [docs/hub.md What to put in `state`](../hub.md#what-to-put-in-state).
- Progress labels in kid words, at most 60 characters: [docs/hub.md Writing good progress labels](../hub.md#writing-good-progress-labels).
- Version the saved state: [docs/hub.md Versioning saved state](../hub.md#versioning-saved-state).
- A daily left unfinished must be cancelled or `resume` stays blocked: see [daily](daily.md).

## Options / API

| Name | What it is |
| --- | --- |
| `ResumeSpec<R>` | `version`, `validate`, `progress`, `title?`, `legacySlot?`, `lateMs?` (default 8000) |
| `createResume(hub, spec, { activity, clock })` | Makes the slot |
| `ResumeSlot#requested` | Page opened from the Resume card (`?hub_resume=1`) |
| `ResumeSlot#known` | The lookup has finished (found, empty or failed) |
| `ResumeSlot#load()` | The saved game or null (cached) |
| `ResumeSlot#save(r)` | False when blocked (race, online; a daily with no daily saves yet) |
| `ResumeSlot#clear()` / `flush()` | Drop it / push now (fire and forget) |
| `ResumeSlot#beforeNewGame()` | `'fresh'` or the saved game |
| `ResumeSlot#offerLate(current, onLate)` | Offer a late-found saved game, once |

## Tests

- `tests/kit/resume/resume.test.ts`
- `tests/hub-events/resume.test.ts` (Continue and the page hiding, through the booted game)
- `tests/hub/kit/progress.test.ts` (Continue in a real browser)

## Hub API used:

- `hub.resume.load({ version })`, `hub.resume.save`, `hub.resume.clear`, `hub.resume.flush`, `hub.resume.requested`
- `hub.daily.save`, `hub.daily.active`
- `hub.getSave(slot)`, `hub.deleteSave(slot)` (legacy slot migration only)
