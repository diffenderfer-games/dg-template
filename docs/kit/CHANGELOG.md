# Kit changelog

KIT doc. One entry per kit version; per module inside. A **major** version
means a hook's signature changed: the entry says how to move a game over.
`npm run kit:sync` prints the entries newer than a game's `kit.json`.

## 1.45 (2026-11-13)

- **local 1.2:** the join sheet's Back and Start buttons show which press does them (Esc or B, Enter or Start), as
  every kit button does; B shows only while nobody is seated. Start no longer opens the hub's console from the
  join sheet once the hub client is 2.0.0-next.24 (local seats keep Start for the game). **ui 1.19:** the join
  sheet's chips follow the label (a wide Enter keycap covered a short Start). **core 1.40:**
  `KIT_VERSION` 1.45. **scripts 1.52:** the module versions. **docs 1.51:** this entry, local.md (a local game adds `"consoleCategory": ["Local"]` to
  `package.json` for the console's Local shelf).

## 1.44 (2026-11-12)

- **input 1.7:** left and right stay on the focused control's line, with the pad and the arrows (`alongLines`,
  `sameLine`, nav.ts; `nearestInDirection`, prompts.ts): on a full-width stepper row (Gulp's Computer holes) the
  hub also moved the highlight to Back or Go below while the kit stepped the value. Rift Racers' game-side
  ui/line-nav.ts can go once synced. `alongLines` takes an optional box per control, for a game that moves controls
  for navigation (Gulp's scrolled sheets). **core 1.39:** `KIT_VERSION` 1.44. **scripts 1.51:** the module versions.
  **docs 1.50:** this entry.

## 1.43 (2026-11-11)

- **ui 1.18:** a screen drawn again (the lobby, on every change in the room) keeps the scroll of every scrolled part,
  not only the screen itself: each is found again by its path of tags and classes, even one the game made after the
  screen mounted (Gulp wraps the lobby in a card that scrolls on a phone), and set again a few microtasks and two
  frames later, after the game has dressed the new screen, unless the player scrolls first. Before, any change in the
  room sent everyone's lobby back to its top. **core 1.38:** `KIT_VERSION` 1.43. **scripts 1.50:** the module versions.
  **docs 1.49:** this entry, ui.md.

## 1.42 (2026-11-11)

- **local 1.1:** each player's view shows their own device's button chips: `mountViewLayers` takes each
  player's `device` / `padStyle` (pass `ctx.local.players`) and sets `data-prompts` / `data-pad-style` on
  its layer; the join sheet's empty seats show the last-used pad's style. **ui 1.17:** the per-view chip rules.
  **core 1.37:** `KIT_VERSION` 1.42. **scripts 1.49:** the module versions. **docs 1.48:** this entry, local.md.

## 1.41 (2026-11-10)

- **docs 1.47:** look.md and polish.md point new games at the themed UIs (Dome Dash, Crossfire, Rift Racers)
  as the bar, and say each game gets its own named look; Lingo and Weston are the older stock look, not a reference. **scripts 1.48:** the
  module versions.

- **local 1.0 (new):** 2–4 players on one screen, on the hub client's seats (`hub.input.seats`, hub client
  **2.0.0-next.22**; none on older clients). `defineGame({ local: { max, min, keyboard, colors } })`;
  `ctx.session.newLocal()` opens the join sheet (A/Start or Enter joins, B/Backspace leaves, Start begins) and
  starts a `mode: 'local'` game with `opts.local.players`; `ctx.local` gives each player's inputs
  (`input(seat)`), `connected(seat)` and `haptic(seat)` (their pad's rumble). `viewLayout` / `glViewport` /
  `mountViewLayers` split the screen (2 side by side or stacked; 3 and 4 in a 2×2 grid, the 4th cell the
  standings). **boot 1.22:** the session's `newLocal`; a local game records nothing, Play again keeps the
  players, any other mode or the title gives the seats back, an unplugged pad pauses and says who.
  **core 1.36:** `PlayMode` `'local'` (isolated); the seats shims in planned.ts; `KIT_VERSION` 1.41.
  **ui 1.16:** the join sheet's and views' CSS. **testing 1.21:** `FakeSeats` and `FakeInput.enableSeats()`.
  **hub-events 1.20:** `local.test.ts`. **scripts 1.47:** the module versions. **docs 1.46:** local.md, the kit
  map, this entry.

## 1.40 (2026-11-07)

- **haptics 1.2 (docs):** haptics.md opens with **Settled**: every game button already buzzes (menuTaps on `#ui`); the
  two buzzes are `ctx.haptic()` (small) and `ctx.haptic(true)` (big), never `navigator.vibrate` or a game
  haptics file; the off switch is the kit's Settings → Vibration; the hub has no button-buzz API (only the turns
  "your turn" buzz); "I feel nothing" is checked on the device (vibration-test.html, phone settings) before any
  code change. No code changed. **core 1.35:** `KIT_VERSION` 1.40. **scripts 1.46:** the module versions. **docs 1.45:** the kit map's haptics line, this
  entry.

## 1.39 (2026-11-06)

- **testing 1.20:** the `challenges` hub phase is shipped: the template pins hub client **2.0.0-next.21** (and
  world next.21), which has `hub.challenges`. A game moves over with `npm install --save-exact
@diffenderfer-games/hub@2.0.0-next.21`, `npm run kit:sync`, `npm run hub-doctor`. **core 1.34:** `KIT_VERSION`
  1.39. **scripts 1.45:** the module versions. **docs 1.44:** this entry.

## 1.38 (2026-11-06)

- **boot 1.21:** `TurnBoard.id`, the online game's id (`sg_…`), so a board can bind a challenge for another game
  to its table (`hub.challenges.start({ …, bind: { kind: 'turns', id: board.id, seq, seat: board.mySeat, space } })`).
  **turns 1.10:** turns.md says so. **challenges 1.1:** challenges.md, starting one from an online game.
  **hub-events 1.19:** `turns.test.ts` checks `board.id`. **core 1.33:** `KIT_VERSION` 1.38. **scripts 1.44:** the
  module versions. **docs 1.43:** this entry.

## 1.37 (2026-11-06)

- **challenges 1.0 (new), boot 1.20:** a challenge for another game (Diffenopoly's Game mode, hub client
  next.21's `hub.challenges`). A game adds the optional **`challenge` hook** (`play(ctx, { seed, level, rng })`,
  `goal?(level, run)`); its `outcome` ends it. A page opened at `?hub_challenge=<id>` is routed first at boot
  (`installChallenges`, 8 s to find it): an open one plays at once in the new `challenge` mode with a "Challenge
  for Diffenopoly" banner (`challenge-banner`); the end is reported once (`hub.challenges.complete`, Try again on
  a failure) and the result screen's **Back to Diffenopoly** (`challenge-back`), Back/Esc, or 5 s go back to
  `returnTo`. Restart replays it from its seed; Quit asks "Give up the challenge?" (a loss). One already finished
  goes straight back; one out of time, unreadable, or in a game without the hook says so with the way back.
  Games without the hook need nothing. **core 1.32:** `PlayMode` gains `challenge` (isolated: no profile, boards,
  stats or Continue); `planned.ts` has `ChallengesLike`, `KitChallenge`, `KitChallengeCompletion` and
  `HubLike.challenges` is optional until the pinned client has it; the kit strings `challenge*`, `giveUp`,
  `tryAgain`; `KIT_VERSION` 1.37. **ui 1.15:** `.kit-challenge` (the banner). **testing 1.19:** `FakeChallenges`
  (`createFakeHub({ planned: { challenges: true } })`, `open`, `failCompletes`, `hang`) and the `challenges` hub
  phase (not shipped in the pinned client). **hub-events 1.18:** `challenge.test.ts`. **docs 1.42:** challenges.md,
  hooks.md, boot.md, core.md, testing.md, README; docs/hub.md and docs/multiplayer.md synced (hub "Challenges").
  **scripts 1.43:** the module versions and the new module.

## 1.36 (2026-11-04)

- **online 1.8, boot 1.19:** a guest who just sat down no longer shows as ready (chip "Ready ✓", "You're ready", Play
  on) when the device's clock runs a minute or more ahead of the hub's. `seat.joinedAt` is the hub's time; the lobby,
  its countdowns and the turns start guard now read readiness at `hubNow(info, localNow)` (`online/ready.ts`), which
  learns the device's lead from each seat's first sighting and only ever errs late. **testing 1.18:**
  `FakeRooms.hubBehind` (a hub clock behind the device) and `hubNow()`. **hub-events 1.17:** `lobby.test.ts` checks
  a 2-minute-fast device as host and guest; the harness resets the estimate per boot. **core 1.31:** `KIT_VERSION`
  1.36. **docs 1.41:** online.md, this entry; screenshots.md, look.md and devices.md name the small iPhones.
  **scripts 1.42:** the module versions; the shots, probe and ui-check know three small-iPhone sizes
  (`iphone-se-safari` 375×553, `iphone-se` 375×667, `iphone-mini-safari` 375×635), and `npm run shots` shoots
  `iphone-se-safari` by default (`phone,iphone-se-safari,desk`). **ui 1.14:** a menu screen too tall for the phone
  scrolls from the top (`justify-content: safe center`) instead of squeezing its rows (`flex-shrink: 0`); a title with
  a Continue row used to crush its tagline under the menu on short phones. **agents 1.1:** game-review reads the small
  iPhone shots.

## 1.35 (2026-11-02)

- **online 1.7:** a clearer lobby for every room game (kit/online and kit/live): the room code in big letters with
  "Anyone can join: Play online → Join with a code", Invite link (`lobby-share`, through `shareLink`) beside Invite
  friends (`lobby-invite`), a status line (`lobby-status`) saying what happens next, and per seat a crown on the host
  and a chip (`seat-status-<id>`: Host, Ready ✓, Not ready / Ready in 0:42, Away). **Guests press Ready**
  (`lobby-ready`, a pulsing toggle; the first focus): Play (`lobby-start`) is on only when enough players sit and
  every guest is connected and ready, or seated a minute (`AUTO_READY_MS`, with a 3 s margin; the hub's
  `seat.joinedAt`). **Behaviour change:** kit/live no longer marks guests ready on joining. The host hands the host
  role over (`make-host-<id>`, a hub with `room.setHost`). **Rematch** on the online result screen (`rematch`): the
  first to press hosts the rematch room, everyone else joins it ("Ann started a rematch · 2 in", a toast); the old
  room closing after it ended keeps the results. All feature-detected (`online/ready.ts` `roomExtras`): an older hub
  has no Make host, no Rematch, and Play follows the ready flags. The chooser's With friends is now **Make a room**
  ("Friends, classmates, anyone with the code", still `online-friends`). New strings (`lobby*`, `seat*`,
  `rematch*`, `makeHost*`, `cancel`, `someone`, `leaveMatchSettings`).
- **boot 1.18, settings-ui 1.1, ui 1.13, live 1.4:** Leave the game? during a room's match has a third button, Settings (`confirm-settings`): the settings
  sheet opens and the match goes on. `settingsRows(ctx, { online })` tells the game's rows where they show.
  `ui/screens.ts`: a redrawn screen keeps the focus on the control with the same test id.
- **testing 1.17:** `FakeRoom` has `setHost`, `rematch`, `addSeat(id, extra)`, `patchSeat`, `rematchBy`; `ready()` sets
  the seat's flag; seats carry `joinedAt`; `FakeRooms.older` makes an older hub's rooms. **hub-events:**
  1.16 `lobby.test.ts`; **hub-suites 1.14:** the online suite's guest presses Ready. **core 1.30:** strings,
  `KIT_VERSION` 1.35. **docs 1.39:** online.md, live.md, playing-together.md, settings-ui.md, this entry.
  **scripts 1.40:** the module versions. **hub-suites 1.15, scripts 1.41, docs 1.40:** the online suite checks Ready and Make host
  against a real hub (client 2.0.0-next.19).

## 1.34 (2026-11-01)

- **core 1.29:** `tests/kit/core/manifest.test.ts` expects `FakeHub`'s default slug `mygame` (since 1.32 the harness passes
  the game id itself); it failed in every game that declares `game.id`. `KIT_VERSION` 1.34. **docs 1.38:** this entry.
  **scripts 1.39:** the module versions.

## 1.33 (2026-10-31)

- **haptics 1.1:** menu buttons give a light buzz. `menuTaps(root, buzz)` listens for clicks on the `#ui` layer; a
  `button`, `[role=button]` or `[data-nav]` press (tap, Enter or gamepad; not disabled) ticks through `ctx.haptic`, so
  it follows the Vibration setting and the throttle. Gameplay controls in `#ui` opt out with `data-no-haptic`.
  **boot 1.17:** `defineGame` turns it on. **core 1.28:** `KIT_VERSION` 1.33. **docs 1.37:** haptics.md, this entry.
  **scripts 1.38:** the module versions.

## 1.32 (2026-10-30)

- **testing 1.16:** `FakeHub` no longer imports `core/manifest.ts` (package.json), so it loads under plain Node again: the
  hub suite `tests/hub/kit/fake-parity.test.ts` failed to start since 1.28 (`ERR_IMPORT_ATTRIBUTE_MISSING`). Its
  slug defaults to `mygame`; **hub-events 1.15:** the harness passes `MANIFEST.id` (a renamed game's id) itself.
  **core 1.27:** `KIT_VERSION` 1.32. **docs 1.36:** this entry. **scripts 1.37:** the module versions.

## 1.31 (2026-10-30)

- **hub-events 1.14:** "a back while playing pauses instead of leaving the page" waits on the actual conditions (every
  history move already asked for has landed; the game reached the pause screen) instead of two fixed 30 ms waits,
  which failed under a loaded machine. **docs 1.35:** review.md § "Previews and labs": phone links serve a built
  bundle (Vite's dev client reloads a backgrounded phone's page), labs are live pages, heavy generation runs in a
  Web Worker with a cache and prebuilt files. **core 1.26:** `KIT_VERSION` 1.31. **scripts 1.36:** the module versions.

## 1.30 (2026-10-30)

- **ui 1.12:** the back guard holds against Android's Back. Chrome's Back skips history entries added without a tap
  in between, and the guard (and the hub's) put theirs back untapped, so a second edge swipe left the game. Now
  each tap or key in play opens a `CloseWatcher` and adds a cushion history entry (up to `CUSHIONS`); a Back caught
  by either does nothing (no pause) and is kept from the hub's guard. `?navlog=1` shows what happened on a phone.
  `GuardWindow` now needs `history.go` and passes popstate listeners an event (`PopEvent`).
  **boot 1.16:** the `backGuard` option's doc. **core 1.25:** `KIT_VERSION` 1.30. **docs 1.34:** ui.md, this entry.
  **scripts 1.35:** the module versions.
- A game that built its own Back cushion (Flow Lab's `src/game/back-cushion.ts`) drops it.

## 1.29 (2026-10-29)

- **boot 1.15:** the online chooser (Play now / With friends / a code) closes when the player reaches a room another
  way, such as accepting an invite while it is open. It stayed up over the lobby. **hub-events 1.13:** a test for it.
- **ui 1.11:** a screen drawn again (a lobby, on every change in the room) keeps where it was scrolled to; it
  jumped back to its autofocus button. On a touch screen a new screen opens at its top: its autofocus control is
  focused without scrolling to it, so a tall lobby shows its top, not Play.
  **core 1.24:** `KIT_VERSION` 1.29. **docs 1.33:** this entry. **scripts 1.34:** the module versions.

## 1.28 (2026-10-29)

- **core 1.23:** `MANIFEST.id` is package.json's `game.id` (a renamed game's old name, its permanent key). `KIT_VERSION` 1.28.
- **boot 1.14:** `defineGame` keys everything it stores on the game's id: `game.slug` if set, else `MANIFEST.id`, else
  `hub.slug` (the id the host injects), else the address. A renamed game served at its new slug keeps its settings,
  profile and saves, even where the host injected nothing (`npm run dev`).
- **testing 1.15:** `FakeHub`'s slug defaults to `MANIFEST.id`, else `mygame`, so a renamed game's kit tests
  (quick-chat keys `g:<slug>:<i>`) see the id the host injects. **docs 1.31:** core.md "The manifest", this entry.
  **daily 1.3, hub-events 1.12:** their tests take the daily seed from the fake hub's id, not `mygame`, so they
  pass in a game with `game.id`. **scripts 1.32:** the module versions.
- A game that sets `game.id` / `game.slug` needs `@diffenderfer-games/hub` 2.0.0-next.18 or later (its `hub-doctor` accepts
  `game.id`, `game.slug` and `game.formerSlugs`; next.17 rejects them).

### Moving a game over

- A renamed game sets `game.id` (its old folder name) and `game.slug` (the new public slug) in package.json, runs
  `npm run kit:sync`, and drops any `slug: '<id>'` it pinned in `defineGame`.

## 1.27 (2026-10-24)

- **avatar 1.6:** `face(hub, { userId })` with no `look` shows the player's own avatar. It drew the hub's stand-in
  for that id (`hub.avatar.from({ userId })`), so a HUD or result card showing "You" by user id drew a stranger.
  Now it fetches the avatar (`mine()` for you, `of(id)` for others; your cached one at once) and follows their
  changes while on the page. `face` also takes `hub.userId` (optional, so `Pick<HubLike, 'avatar'>` still works).
- **testing 1.14:** the fake `hub.avatar.from({ userId })` gives the stand-in (`AV1stand-in-<id>`), as the hub does,
  so a test of a face by user id sees the bug. **docs 1.30:** avatar.md, this entry. **core 1.22:** `KIT_VERSION`
  1.27. **scripts 1.31:** the module versions.

### Moving a game over

- Nothing breaks. A game that worked round it (its own "my face" helper) can go back to
  `face(ctx.hub, { userId: ctx.hub.userId() ?? undefined, name: 'You' })`.

## 1.26 (2026-10-22)

- **resume 1.3:** a save the hub refuses (no game slug in the address, a state over 512 KB) warns once and is
  skipped; it no longer throws into the session's loop, which stopped the game drawing at the first autosave.
- **docs 1.29:** review.md: test links are `http://<LAN IP>:<port>/<slug>/` and the game is served under its slug;
  getting-started.md says `npm run dev` serves `/<slug>/`. **core 1.21:** `KIT_VERSION` 1.26. **scripts 1.30:** the module
  versions.
- Not in the kit: the template's `vite.config.ts` now serves `npm run dev` and `vite preview` under `/<slug>/`
  (the package name); the build keeps `base: './'`. CLAUDE.md's base rule says so.

### Moving a game over

- Nothing breaks. Copy the template's `vite.config.ts` (a game file) so `npm run dev` serves under `/<slug>/`, and
  give phone links with the `/<slug>/` path. Update the base rule in the game's CLAUDE.md by hand.

## 1.25 (2026-10-22)

- **docs 1.28:** [devices.md](devices.md), how a game handles keyboard, gamepad, touch and mouse like a console game:
  the last input wins (touch controls only while touch is the last input, never on a touch laptop played with keys),
  what to show for each device, button mapping, linear screens, focus, pause per device, testing and a checklist.
  Linked from CLAUDE.md, polish.md and the README's map. **input 1.6:** input.md links it.
- **docs 1.28:** [trailer.md](trailer.md): making a promo trailer (filming the game frame by frame, the owner's clip
  picks in a gallery, cards, music and the cut, the review gates), with Rift Racers' `scripts/film/` as the reference.
- **core 1.20:** `KIT_VERSION` 1.25. **scripts 1.29:** the module versions, devices.md and trailer.md in the docs module.

### Moving a game over

- Nothing breaks. A game with touch controls checks devices.md § 4: on a touch laptop played with keys they should
  not show. Add the CLAUDE.md line by hand (CLAUDE.md is the game's).

## 1.24 (2026-10-21)

- **input 1.5:** button prompts (`kit/input/glyphs.ts`, `prompts.ts`): controls bound to actions (`confirm`, `back`,
  `alt`, `alt2`, `prev`/`next`, `page-prev`/`page-next`, the d-pad) show their key as a keycap, or the pad's button
  (Xbox, or PlayStation from the pad's id) when a pad is in use, and nothing on touch, swapping live
  (`html[data-prompts]`, `html[data-pad-style]`); pressing the key or pad button presses the control in the top modal
  or the screen, outside active play, leaving the hub's menu, act and back buttons to the hub. Back (B, Esc) presses
  the `back` control when there is one. Enter presses `confirm` when nothing has focus; arrows move focus as the
  d-pad does; `axisControl` steppers step on left and right, and a focused slider moves. The kit's own controls are bound by test id
  (`KIT_ACTIONS`). `bindAction`, `glyph`, `axisControl`, `installPrompts`, `setPromptBindings`, `pressAction`,
  `navScope`; `navTargets` puts the `confirm` control first and leaves out what's beside a focused stepper.
- **ui 1.10:** `button(..., { action })`, `ModalButton.action`; the chips' CSS (`--kit-glyph-*`). **boot 1.13:**
  `GameDefinition.prompts` (`bindings`, `padStyle`, `arrows`, or `false`); `defineGame` installs the prompts.
- **testing 1.13:** `FakePad`'s `id` (`padHarness({ id })`: a PlayStation pad). **hub-events 1.11:** the prompts
  through a booted game. **core 1.19:** `KIT_VERSION` 1.24. **docs 1.27:** this entry. **scripts 1.28:** the module
  versions.

### Moving a game over

- Nothing breaks: the kit's screens get their chips. To make a game's own screens console-like, bind each screen's
  primary to `confirm`, its way back to `back`, its main choice to `prev`/`next` (a stepper: `axisControl`) and its
  extras to `alt`/`alt2` ([input.md](input.md#button-prompts)), and lay it out in reading order.
- A game whose own keydown listener uses Q, E, F, R, Z, C or Enter on a menu screen: `preventDefault()` it there (the
  kit then leaves the key alone), or rebind the action (`prompts.bindings`).

## 1.23 (2026-10-21)

- **boot 1.12:** Back in the online lobby (the phone's, the browser's, the pad's B, Esc but not while typing in the chat)
  leaves the room, like Leave, instead of leaving the page with the seat still held (which made the hub offer a Rejoin);
  on a live match's loading screen Back asks "Leave match?" first. `Session.guardOnline()`, `Session.leaveOnline()`;
  `OnlineFlowHost.guard()`. The live loading screen has a Leave button (`loading-leave`).
- **live 1.3:** never an endless loading screen: a join the live server refuses with `no_match` (the match ended, everyone
  left, the server restarted) takes the player back at once with "That match has ended." (`version`: reload); a room
  that ends before this page got into its match says so instead of showing a result; a match not on screen within
  `LOAD_LIMIT_MS` (90 s) takes the player back. `refusalCode`.
- **ui 1.9:** the back guard's docs (the lobby and the loading screen); `.kit-loading-leave`. **online 1.6:** docs
  (Leaving). **docs 1.26:** this entry. **scripts 1.27:** the module versions.
- **core 1.18:** strings `liveOver`, `liveNoJoin`, `liveUpdated`; `KIT_VERSION` 1.23. **hub-events 1.10:** Back, B, Esc
  and Leave in the lobby leave the room. **hub-suites 1.13:** a lobby rejoined from the hub is usable (nothing covers
  it); Back in the lobby leaves the room and the hub offers no Rejoin.

### Moving a game over

- A game with its own page loading screen (an overlay in index.html) lifts it for every kit screen but the first
  loading card (a lobby or a race reached straight from the hub), not only on the title.
- Reword the new strings for your game if "match" isn't its word (`liveOver: 'That race has ended.'`).

## 1.22 (2026-10-21)

Needs `@diffenderfer-games/hub` 2.0.0-next.17 or later (`padButtons`, `autoNavigate`'s `ring`, button lists).

- **input 1.4:** the kit's pad navigation is off during active play when the `play` group reads the pad's act or back
  button (A, B), so A never clicks a HUD button and B is the game's; `GameDefinition.nav.active(ctx, state)`
  overrides it (`state.byDefault`). `installMenuNav` takes `active()` and `ring` (default false). The pause screen
  resumes on the `pause` input's keys and pad button (Start): the `kit:resume` group, `sync({ paused })`.
  `ControlsHandle.usesPadButton`, `padButtonsOf`. Docs: the gamepad (button and axis lists, dead zones, the hub's
  buttons, the secure context), Menus.
- **ui 1.8:** the back guard (`kit/ui/back-guard.ts`, from Rift Racers): in play an edge swipe or the phone's Back
  pauses instead of leaving (a race or a match asks to leave). Focus is the kit's own look, themed with
  `--kit-focus-color`, `-inner`, `-width`, `-gap`, `-shadow`, `-outline`, `-filter` (they default to the hub's
  `--hub-focus-*`), and matches `[data-hub-focus]`; the hub's ring stays off over the kit's menus.
- **boot 1.11:** `GameDefinition.nav` and `backGuard` (default on, off with `resumeOnClose`); the session turns the
  back guard on in play and off at the result and the title, and resumes on Start.
- **testing 1.12:** `padHarness`, `FakePad`, `plugIn`: a fake gamepad through the real hub input system.
  `FakeInput.pressBack()` calls back only while there are menu targets (like the hub); `FakeInput` has
  `padButtons`, `setPadButtons` and records `autoNavigate`'s `ring`.
- **core 1.17:** `KIT_VERSION` 1.22; `InputLike` gains `padButtons`, `setPadButtons`. **pause 1.3**, **docs 1.25**
  (look, hooks), **hub-events 1.9** (row 10 turns pad navigation on in play, so it holds for every game), **scripts 1.26:** this entry's docs, tests and module versions.

### Moving a game over

- Delete game-side workarounds: reading the stick yourself to dodge the old 0.35 dead zone (set `deadzone: 0` on the
  mapping if you shape the stick yourself), taking `data-nav` off HUD buttons, turning `--hub-focus-*` transparent,
  your own back/edge-swipe guard. Put d-pad and stick on one input with a button list.
- A game that navigates its play screen with the pad while A or B are game actions sets `nav.active`.

## 1.21 (2026-10-21)

- **scripts 1.25:** `kit:check` warns about a label it doesn't know instead of failing, so a label the
  hub just learned can ship before the game's next hub package.
- **docs 1.24, world 1.7:** twelve more genre labels: `adventure`, `strategy`, `party`, `trivia`, `learning`, `music`, `creative`, `idle`, `simulation`, `shooter`, `fighting`, `mystery`. The
  world docs say where they go; the synced hub.md lists them.
- **core 1.16:** `KIT_VERSION` 1.21.

## 1.20 (2026-10-21)

- **docs 1.23:** the genre labels gain `horror` (scary games; the catalog's Genre filter and picked
  games can show or hide them, and Adventure Mode puts them in the arcade's cabinets). The synced
  hub.md lists it.
- **world 1.6:** docs: horror games get arcade cabinets.
- **core 1.15:** `KIT_VERSION` 1.20. **scripts 1.24:** this entry's module versions.

## 1.19 (2026-10-20)

- **live 1.2:** docs: the computer never drives a player's seat. Until a player arrives, and while
  they're dropped, their seat's input is `null` (the sim keeps that ship hands-off); the match waits
  up to 90 s for everyone. Show who it's waiting for while the race loads (a `seat` message per seat
  arrives right after the welcome).
- **core 1.14:** `KIT_VERSION` 1.19. **docs 1.22, scripts 1.23:** this entry; module versions.

## 1.18 (2026-10-20)

- **ui 1.7:** `Screens.show` of the screen already showing (a live room's lobby, drawn again on
  every change in the room) marks the new one `data-redraw="true"`, which skips `.kit-in` and
  the game's own entrances that check it; focus on a part the new screen reuses (the lobby's chat
  box) stays put, so a player typing keeps the keyboard.
- **turns 1.9:** the seats are patched, not rebuilt: whose turn it is flips `data-due` on the same
  rows, and only a seat that changed gets a new row, so a `.kit-seat` entrance plays once.
- **core 1.13:** `KIT_VERSION` 1.18. **docs 1.21, scripts 1.22:** this entry; module versions;
  look.md: entrances play once.

## 1.17 (2026-10-20)

- **core 1.12:** `isLocalNetwork()`: test drivers are installed on a private network address too (a
  local hub on the Wi-Fi, which phones test on). `KIT_VERSION` 1.17.
- **docs 1.20, scripts 1.21:** this entry; module versions.

## 1.16 (2026-10-20)

Live games play through a hub room: the lobby, the loading screen, joining the live match and the result.

- **live 1.1:** `GameDefinition.live` (`LiveRoomGame`): `sim`, the host's `options()`, my `seat()`,
  `describe(options, { isHost, update })` for the lobby (the host's controls and my choices; `update()`
  shares them), `prepare(start, progress)`, `play(match, start)`, `frame(dt)`,
  `render()`, `hud(el)`, `stop()`, `result(el, places, start)`; `start.seats[i].data` is each seat's choices. `LiveRoomMatch` runs it: my choices in my seat,
  the host's options in the room's state (everyone's lobby shows them) and in `room.start({ options })`,
  which places the match on the hub's live server; when the room plays, every page builds the match
  behind a loading screen, joins it (`live.join`, again after a drop) and plays; the hub's end
  (`{ places, winnerId }`) shows the result. Exports `joinLiveRoom`, `live`.
- **boot 1.10:** `OnlineFlow` takes `{ online }` or `{ live }`; the lobby, invites, chat and
  reconnects are shared. In a room's match the pause button (and the `pause` input) asks "Leave the
  game?" instead of pausing: the others play on. `session.showPlay()` returns the HUD element. The
  lobby keeps one chat panel for the room's life (it was made again on every change in the room,
  dropping the lines shown and the draft). A seat held after a reload is asked for as the page starts,
  in parallel with `mount` (a short reconnect grace mustn't run out while a big game mounts). A reclaimed seat enters online mode when its room shows. The title's online
  button shows for a live game too.
- **online 1.5:** `lobbyScreen({ extra })`: the game's own part of the lobby; `reclaim(early)`.
- **core 1.11:** strings `liveGettingReady`, `liveJoining`, `leaveMatch`, `leaveMatchBody`. `KIT_VERSION` 1.16.
- **testing 1.11:** `FakeRoom.start(options)` records the options.
- **ui 1.6:** `.kit-progress`.
- **hub-suites 1.12:** online.test.ts waits up to 60 s for a match to be on screen (a live game
  builds its world first). Scenario 9 comes back inside the grace (8 s; it waited exactly the old 4 s
  grace, after which the hub frees the seat for good, so no game could pass it).
- **config 1.3:** lint skips `dist-live/` (the sim bundle).
- **scripts 1.20, docs 1.19:** module versions; this entry.
- Needs hub client **2.0.0-next.16** (`room.start({ options })`, `room.liveTicket()`, `live.join`).

## 1.15 (2026-10-19)

Joining others is as easy as hosting: the online buttons find a game that is waiting first.

- **boot 1.9:** Play online's **Anyone** joins a game waiting for a player (`hub.turns.openLobbies()`,
  same mode, skipping one taken meanwhile) and only then makes one anyone can join (`public`,
  `autoStart`), behind "Looking for a game…". The chooser lists the games waiting ("Sam is waiting",
  seats, Join), **More games online** (`hub.social.openPlayOnline()`) and **Join with a code**. The
  live-room button (`online`) now asks: **Play now** (join a public room waiting in its lobby,
  `hub.rooms.list()`, else host a public one), **With friends** (a private room, as before) or a code.
  New `joining.ts` (`parseJoinCode`, `joinCodeForm`, `lookingSheet`). Test ids `turns-who`,
  `turns-computer`, `turns-link`, `turns-anyone`, `online` are unchanged; new: `turns-open-<id>`,
  `turns-open-join-<id>`, `turns-more`, `online-who`, `online-play-now`, `online-friends`,
  `join-code`, `join-code-go`, `looking`. A game test that pressed `online` to host now presses
  `online-friends` after it (or calls `__game.online.host()`).
- **online 1.4:** `OnlineMatch.create({ public })`; lobby presence carries `public`.
- **core 1.10:** `TurnsLike.openLobbies`, `RoomsLike.list`, `SocialLike.openPlayOnline` (optional);
  strings for the choosers. `KIT_VERSION` 1.15.
- **testing 1.10:** `FakeTurns.lobbies` / `taken` / `lobbiesError`, `openTurnGame()`; `FakeRooms.open` /
  `full` / `listError` and `list()`; `FakeSocial.openPlayOnline`.
- **ui 1.5:** chooser, waiting-game row, code box and spinner styles.
- **turns 1.8, docs 1.18:** turns.md, online.md, testing.md and playing-together.md § Joining.
- **hub-events 1.8, hub-suites 1.11, scripts 1.19:** the new flows tested; suites and shots that host
  a room press With friends.
- Needs hub client **2.0.0-next.14** (already pinned): `openLobbies`, `rooms.list`, `openPlayOnline`.
  On an older hub Anyone and Play now fall back to making a game.

## 1.14 (2026-10-19)

- **scripts 1.18:** `freeBlock` / `portFree` probe every address on its own (`::`, `0.0.0.0`,
  `127.0.0.1`, `::1`). On Windows a dual-stack probe succeeded while another process held the
  port on IPv4 only, so parallel `shots` runs or a dev server on `--host` got "port already in use".
- **docs 1.17:** screenshots.md § Ports says so.
- **core 1.9:** `KIT_VERSION` 1.14.

## 1.13 (2026-10-18)

Live (realtime) games: racing first, shooters later (the hub's docs/plans/live.md).

- **live 1.0:** new module. A game writes a pure fixed-step sim (`src/game/live/sim.ts`,
  an empty stub until it does) and declares `game.live`; the hub's live server runs it
  and the page runs the same sim to predict (`joinLive`). `dmath` (bfme's deterministic
  sin/cos/atan2) and `checkLiveSimRuns` for tests. [live.md](live.md).
- **scripts 1.17:** `npm run build:live` (part of `npm run build` once `game.live` is declared).
- **config 1.2:** lint keeps `Math.random` and `Date` out of `src/game/live/`.
- **docs 1.16:** the kit map lists live.
- **core 1.8:** `KIT_VERSION` 1.13.
- Needs hub client **2.0.0-next.14** (`./live-sim`, `./live`).

## 1.12 (2026-10-18)

The owner's recurring review feedback, written down. Docs only: no code changes.

- **docs 1.15:** new docs. [polish.md](polish.md) is the owner's checklist for every screen:
  every modal and page juicy, even padding (horizontal at least vertical), aligned buttons,
  text that fits, phones first, no focus outline on touch, loading states, no flashes,
  game feel. [covers.md](covers.md) covers the two cover layouts and when to remake one.
  [card-games.md](card-games.md) covers select then confirm, the hand's order, card faces
  and the mini daily. [playing-together.md](playing-together.md) covers the lobby, invite
  links, computer seats online and everyone seeing what happened. [review.md](review.md)
  covers screenshots and a phone link before pushing, the notify tool, scope, `author`,
  and improving the template. look.md links them and now says the kit's CSS goes first
  (`theme.css` wins with plain selectors). screenshots.md and getting-started.md link
  them too.
- **agents 1.0 (new module):** `.claude/agents/game-review.md`, a read-only Claude Code agent that
  shoots the game, checks it against look, polish, covers, card-games and playing-together, and
  reports findings with the doc rule each breaks. CLAUDE.md says to run it before a hand-over.
- **turns 1.7, online 1.3, race 1.2:** each doc links playing-together.md.
- **daily-puzzle 1.1:** the doc says when a daily should be a mini challenge.
- **scripts 1.16:** the docs module lists the new docs.
- **core 1.7:** `KIT_VERSION` 1.12.
- **CLAUDE.md, README.md (GAME, new games only):** "What the owner expects" reading list;
  rules for `author`, invite links and computer seats; DRY, small files, no `any`; scope;
  lessons go back into the template.

## 1.11 (2026-10-17)

The cover is the hub's card size.

- **scripts 1.15:** `npm run cover` shoots at the new `cover` size (800 × 420, 40:21, the shape the
  hub shows whole) instead of `desk` (1280 × 800, which the card cropped). `kit:sync` replaces
  the game's `scripts/kit/` copy; re-run `npm run cover` to remake `cover.png`. `ui-check` skips
  the `cover` size. `npm run create` (and so `tools/New-Game.ps1`) first runs `git pull --ff-only` in
  dg-template, so a new game starts on the latest template; a failure only warns, `--no-pull` skips it.
- **core 1.6:** `KIT_VERSION` 1.11.
- **docs 1.14:** screenshots.md lists the `cover` size; getting-started.md says `create` pulls first.

## 1.10 (2026-10-17)

Game ages (hub client and contract **2.0.0-next.13**): say who the game is for.

- **package.json:** `game.ages`, `{ "min": 6 }` (6 and up) or `{ "min": 2, "max": 9 }`; `min` is
  2 or more and `max`, when given, at least `min` (hub.md "Labels, ages and the home page").
  The home page shows it on the game's sheet (_Ages 6+_) and its age filter leaves out a game
  that doesn't give it. A game that moves to kit 1.10 adds it (`src/game/config.ts`'s TODO).
- **scripts 1.13:** `kit:check` fails a bad `game.ages` (`checkAges`) and warns when it is
  missing; hub-doctor next.13 does the same.
- **core 1.5:** `KIT_VERSION` 1.10.
- **docs 1.12:** getting-started's game block step lists `ages`.

## 1.9 (2026-10-17)

Online games: invite friends from the lobby, and the creator takes a player out.

- **turns 1.6, boot 1.8:** the lobby's **Invite friends** (`turns-invite`) lists the
  player's friends not seated yet, each with Invite (`game.invite`). The creator's
  **Remove** on another player's seat (`turns-remove-<seat>`, after a confirm) takes them
  out with `game.kick(seat)`: a lobby seat opens up again; in play the computer takes the
  seat. `TurnBoard.remove(seat)` does the same for a board that draws its own seats. Remove needs hub client next.12 (`kick`); it hides on older clients.
- **turns 1.6, boot 1.8:** the chat panel follows the hub's `chatMode`: when it changes (a friend
  sits down and free text opens, a guest joins and it closes) the panel is rebuilt with the
  earlier lines (`TurnScreen.setChat`). It used to keep the mode the screen opened with.
- **core 1.4:** `TurnGameLike` has `invite` and an optional `kick`; `SocialLike` has
  `friends`. New strings: `turnsInvite*`, `turnsNoFriends`, `turnsNoSeats`, `turnsRemove*`.
- **testing 1.9:** `FakeSocial.friendList` / `friends()`; `FakeTurnGame.invite()` and `kick()`.
- **hub-events 1.7, docs 1.11, scripts 1.11:** tests and turns.md for the above.
- **ui 1.4:** `shareLink` (kit/ui/share.ts): the share sheet, else the clipboard, else a dialog
  to copy the link by hand, as the hub's share buttons do. The lobby's link button is now **Share
  the invite link** and the raw link line is hidden (its text stays in `turn-link` for tests). Also
  the seat's Remove button and the friend list's rows.

## 1.8 (2026-10-16)

The world (hub client **2.0.0-next.11**, `@diffenderfer-games/world` too): games play in a
box over Adventure Mode (`game.embed`), the hub's rooms play the catalog's games by their
labels, and a game's own room has a door.

- **boot 1.7, input 1.3:** Esc is the kit's back on a keyboard too (a modal, the pause
  card back to play, the result or an online game back to the title), and it calls
  `preventDefault()` only when it went somewhere, or in play when an enabled group reads
  Esc (`ControlsHandle.usesKey`). In the world's box an unhandled Esc closes the box, so
  on the title it now leaves; before, Esc in play left the box instead of pausing.
  `installMenuNav`'s `back()` returns whether it went anywhere, and it returns its
  unsubscribe. The session reads `pause` once per step (it was per frame: a frame with no
  step missed the press, one with two saw it twice), and pausing again while "Leave race?"
  asks answers Stay.
- **core 1.3:** `inFrame()`, `isEmbedded()` (in the world's box: `?hub_embed=1`), and
  `KIT_VERSION` in `version.ts`, which kit.json and the test hook both read (the hook said 1.4).
- **layout 1.3:** `goFullscreen()` and `lockPointer()`, which do nothing inside a frame.
- **ui 1.3:** `html[data-embed]` (the kit sets it in the box) drops the room kept for the
  hub menu button; the title's font follows the height as well as the width.
- **testing 1.8:** the FakeHub's `input.tap(name)` holds for 3 frames, like a finger.
- **hub-suites 1.9:** `tests/hub/kit/embed.test.ts` opens the game in the world's box on a
  real hub (no menu button, Esc on the title leaves, Esc in play pauses and stays, hub UI
  over the box pauses); skipped without `game.embed.supported`. `inWorld` and
  `AdventureHandle` move into `_kit.ts`. **hub-events 1.6:** when Esc is handled; Stay on a
  second pause in a race.
- **world 1.5, pause 1.2, docs 1.10, scripts 1.10:** world.md's
  [Playing over the world](world.md#playing-over-the-world) (what the kit does, the short
  overlay checklist), [A frame of your own](world.md#a-frame-of-your-own) and
  [Rooms and labels](world.md#rooms-and-labels); input, pause, layout, core, testing,
  getting-started and the README say so. The template's package.json has
  `game.embed: { supported: true, size: [960, 640] }`, and `src/game/config.ts` lists the
  labels and what they decide (`TODO(game)`).

To move a game over:

1. `npm run kit:sync`, then pin `@diffenderfer-games/hub` and `@diffenderfer-games/world` at
   `2.0.0-next.11` and `npm install`.
2. Add `"embed": { "supported": true, "size": [w, h] }` to the `game` block (the size it
   likes, CSS px), or `"supported": false` if it can't play in a box; `npm run hub-doctor`.
3. A call to `installMenuNav` of your own: its `back()` returns a boolean. A `keydown`
   listener of yours that uses Esc calls `preventDefault()`, only when it used it; replace
   `requestFullscreen` / `requestPointerLock` with `goFullscreen` / `lockPointer`.
4. `npm run test:hub -- tests/hub/kit/embed.test.ts`.

## 1.7 (2026-10-16)

After Chain Reaction (a game show: a player may move several times in a row):

- **hub-suites 1.8:** the online games suite asks the game instead of assuming
  that every move passes the turn: each player moves until the turn passes
  (`moveWhileMine`), and a long game has time to finish (up to 400 moves,
  10 minutes). It still expects the creator's seat to move first.
- **scripts 1.9:** `build:rules` fails on Node and browser globals
  (`structuredClone`, `queueMicrotask`, `TextEncoder`, `TextDecoder`, `Buffer`):
  the hub runs the rules in plain JavaScript (`vm.createContext({})`), where they
  throw on the server (a 500 on the move).
- **turns 1.5, testing 1.7, docs 1.9:** turns.md and testing.md say so.

To move a game over: `npm run kit:sync`. A rules module that used `structuredClone`
copies its state by hand.

## 1.6 (2026-10-16)

- **avatar 1.5, boot 1.6:** no avatar on the title by default: players edit theirs
  from the hub's menu, and look.md no longer asks for a bust on the title.
  `avatar.titleDemo: true` is the opt-in (the kit adds the bust and Edit avatar
  under the title's buttons, and the bust tests run: hub-events 1.5, hub-suites 1.7,
  scripts 1.8). Without it the bust tests skip on their own.
- **docs 1.8, testing 1.6:** look.md, avatar.md, testing.md, screenshots.md,
  getting-started.md and the kit README say so.

To move a game over: `npm run kit:sync`, then drop any `titleDemo(ctx.hub, el)` call
from `screens/title.ts`, any `titleDemo` line from `src/game/avatar.ts`, and any bust
tests from `tests/kit-skips.json`.

## 1.5 (2026-10-16)

After Lingo:

- **avatar 1.4, boot 1.5:** `avatar.titleDemo` is the switch for the title's bust.
  The kit adds the bust and Edit avatar under the title's buttons itself;
  `titleDemo: false` hides them, and the bust tests skip (hub-events 1.4: `HAS.titleBust`;
  hub-suites 1.6). Before, the flag did nothing: the bust came from a `titleDemo()`
  call in `screens/title.ts`, and turning the flag off failed a kit test.
- **scripts 1.7:** the kit's title, pause and result screenshots wait 1.4 s, so they
  show the screens settled (no own `*-settled` scenarios needed).
- **docs 1.7, testing 1.5:** look.md §9, avatar.md and testing.md say so.

To move a game over: `npm run kit:sync`. A title hook that calls `titleDemo(ctx.hub, el)`
can drop the call (the kit adds it; leaving it in is harmless). A game that hid the
bust by not calling it sets `titleDemo: false` in `src/game/avatar.ts` and removes
the bust tests from `tests/kit-skips.json`.

## 1.4 (2026-10-16)

After Wordle, the first real game (kit-retros.md): **the kit's
tests now pass in any game**, not only the template's example. They ask the
game for its shapes and need only a short test contract; suites for features a
game doesn't declare skip on their own; and a kit test that still doesn't fit
is listed with its reason in `tests/kit-skips.json` instead of being deleted.
New games start from a skeleton of `TODO(game)` comments (no Coin Dash to
delete), and making one, and its first deploy,
are one command each.

To move a game over:

1. `npm run kit:sync` (it now brings `vitest.config.ts` and `.gitattributes` too: the
   `config` module).
2. Give the definition the test contract
   ([testing.md](testing.md#what-the-kits-tests-need-from-your-game)): `addScore: (run, n) =>
void (run.score += n)` beside `snap` (whose `score` the suites read), and, with
   `game.turns`, `turns.testMove(board)` (a legal move, or null). Drop an
   `extra.addCoins`-style driver the kit's tests used to need.
3. Put back the kit tests you deleted or moved (`kit:sync` restores them; delete the
   `tests/game/kit-*` copies), then `npm run check`. List any kit test that still
   doesn't fit in `tests/kit-skips.json` with the reason, and in `docs/game.md` "Known
   issues".
4. Drop CSS workarounds: the kit's CSS now comes first in `<head>`, so `html:root` /
   `html .kit-…` can be plain `:root` / `.kit-…` in theme.css.
5. A song of your own can live in `src/game/music-core.ts` again: the audio test no
   longer snapshots it.

- **boot** 1.4: `GameDefinition.addScore(run, n)` (the test contract) and
  `TurnsHooks.testMove(board)`; `window.__game.addScore(n)` and `turnsMove()`.
  `KIT_VERSION` 1.4.
- **test-hook** 1.2: `addScore` and `turnsMove` in `GameHookDrivers`.
- **ui** 1.2: the kit's CSS is inserted first in `<head>` (`head.prepend`), so the
  game's theme.css wins every tie; ui.md documents every kit screen's markup and test ids.
- **hub-events** 1.3: the suites ask the game: saved games, days in progress and
  profiles come from playing it (`savedGame`, `savedDay`, `profileAfter`), the race
  param from `game.race.params[0]`, boards from the game's `result`; numbers, not
  words; `HAS` / `describeIf` skip the daily, race, resume, online and turns suites
  for a game without them; the online and turns suites use kit-owned toys
  (`_support/toys.ts`); the conflict test checks the cloud slot ends merged.
- **hub-suites** 1.4: `unlessDeclared(key)` skips the progress (Continue, daily),
  saved, race, online and lobby suites for a game without the feature, and the
  avatar title tests without `src/game/avatar.ts`; `game.addScore` / `game.loseNow`;
  the best score is matched as a number; the turns suite plays with
  `__game.turnsMove()`; `e2e()` honours `tests/kit-skips.json`.
- **audio** 1.1: the MusicCore snapshot uses a kit-owned `tests/kit/audio/toy-core.ts`.
- **scripts** 1.5: `npm run create` (a new game's folder from the template's HEAD,
  no questions), `npm run first-deploy` (the private repo, its secrets, the push,
  the run watched), `npm run test:hub` is `scripts/kit/test-hub.ts` (one file:
  `npm run test:hub -- <file>`; skips listed files); `tests/kit-skips.json`
  (`lib/kit-skips.ts`, `vitest-skips.ts`), checked by `kit:check`; `new-game` names
  the game (package.json `name`, `description`, `author`, index.html's `<title>`, a
  README, blank `docs/game.md`), strips the avatar line from `screens/title.ts`,
  removes every template plan and runs `npm install` (`--no-install`); a template
  test makes a game with every `--no-*` flag and runs its typecheck and unit tests;
  the kit's screenshot scenarios skip features the game doesn't have and wait for
  screens to settle.
- **config** 1.1: `vitest.config.ts` and `.gitattributes` (LF everywhere) join the
  kit; lint no longer applies the violent-words rule to `src/game/data/**`
  (generated word lists).
- **testing**, **input**, **daily**, **race**, **turns**, **layout**, **loop**,
  **online**, **pause**, **resume**, **save**, **saved**, **scores**, **avatar**,
  **world** (docs): the test contract and kit skips (testing.md), sim `maxSteps`,
  `test:hub` timing; `hub.input` facts and typing games (input.md); a lost day
  restarts from its seed (daily.md); race param keys are never shown (race.md);
  `testMove` (turns.md); examples use `score` everywhere.
- **docs** 1.5: getting-started and repo-setup use `npm run create` and
  `npm run first-deploy` (and say `DG_HOST` isn't set in CI: the hub suites are
  skipped there); hooks.md: the game finishes the frame `outcome` is non-null;
  screenshots.md: the cover pattern, run `shots` last.
- Same day, after the first 1.4 push: **input** 1.2, **hub-suites** 1.5, **docs** 1.6, **scripts** 1.6 (these versions):
  the starter is a skeleton (getting-started.md); the online resilience suite checks the
  match goes on and the player comes back (not that the game's own computer player
  changes the view: a game may not have one yet).
- **The template** (not synced): Coin Dash is gone; `src/game/` is a skeleton of
  hooks with `TODO(game)` comments and only what the kit needs to run (a score,
  `addScore`, `solve`, a pass-the-turn placeholder for online games); the starters
  show the score and a `TODO(game)` for the scene; the Pixi starter has `stage.layout()` (screen pixels from the
  play region) beside `stage.fit(arena)`; `pause` is Escape and Start (no P);
  `tools/New-Game.ps1` calls `npm run create` and takes `-Name`, `-Renderer`,
  `-No*`, `-NoShortcut`, `-NoLaunch`.

## 1.3 (2026-10-16)

The hub client is pinned at **2.0.0-next.10** (what diffenderfer.games runs),
with `@diffenderfer-games/world` 2.0.0-next.10 next to it: **Adventure Mode**,
the way players reach the world. No game code changes are needed; a game's own
room (`game.world`) is in it as it is.

To move a game over: `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.10`
and `npm install --save-exact --save-dev @diffenderfer-games/world@2.0.0-next.10`,
`npm run kit:sync`, `npm run sync-docs`, `npm run hub-doctor`, `npm run check`.

- **world** 1.3: [world.md](world.md) "Adventure Mode": `/world` (the glowing
  card on the home page and in the hub menu; the menu inside; Library Mode
  back), how a game's own room appears in it (`/world/game.<slug>`, its doors
  lead out, the Hall's doors don't lead in, don't name a game `world`), walk to
  a friend (the fewest-doors route), and `world.say`: quick-chat and emotes to
  everyone who sees you, typed text moderated and only to mutual friends (the
  world uses the hub's phrases, not a game's `quickChat`). New page-safe
  `roomPath(slug)` (`/world/game.<slug>`, for a link); `worldKey` moves to
  `kit/world/index.ts` (room.ts re-exports both, so imports keep working).
- **testing** 1.3: `HUB_PHASES.adventure` (shipped, next.10).
- **hub-suites** 1.3: `tests/hub/kit/world.test.ts` adds two Adventure Mode
  tests: `roomPath` opens the game's room; a typed bubble reaches a friend and
  never a stranger, quick chat reaches the stranger; "Walk to" goes out through
  the room's door to a friend in the Hall.
- **turns** 1.3 (docs): the client's quiet refresh runs in a lobby too (next.10),
  so a lobby waiting for seats or a start never gets stuck; the kit never polled
  a lobby, so nothing to remove.
- **boot** 1.3: `KIT_VERSION` 1.3 (`window.__game`'s `kit`).
- **scripts** 1.4: `KIT_VERSION` 1.3 and the module versions above.
- **docs** 1.4: the kit map and "Hub phases" (README) name next.10 and
  Adventure Mode; this entry.
- **Wording** (kit 1.2, unchanged): players never see "over days"; an online
  game is just "an online game", and **Play online** is the default.
- **docs** 1.3: [look.md](look.md), the standard for every game's UI and
  motion: tokens, components, motion timings, gameplay feedback, layout, the
  kit's markup and test ids for dressing its screens, how to check it, and
  reference code and screenshots (`docs/kit/look/`). Linked from CLAUDE.md,
  getting-started step 7 and the kit map.
- **scripts** 1.3: `docs/kit/look.md` and `docs/kit/look/` in the docs module
  list. No game code changes: `npm run kit:sync` brings both in.

## 1.2 (2026-10-16)

**Wording (the owner):** players never see "over days". An online game the hub
runs may finish in minutes or take days, which isn't known in advance, so it is
just "an online game" and the default way to play online: the title's button is
**Play online** ("With friends, a link or anyone"), and a live room beside it is
**Play now** (`core` strings `turnsNew`, `turnsNewSub`, `playNow`).

The hub client is pinned at **2.0.0-next.9** (what diffenderfer.games runs),
with `@diffenderfer-games/world` 2.0.0-next.9 next to it. Online games
get the kit's own screen on next.8's online games on the server; the
world and a game's own room (next.9) are on; game tables in the world (W2)
and in-game presence (W3) stay off (coming).

- **turns** 1.2: the rules types and RNG come from the zod-free
  `@diffenderfer-games/hub/turns-rules` (`kit/turns/rules.ts`, what a rules
  module imports; `checkTurnRules` stays in the index for tests). The kit's
  screen for online games (`kit/turns/screen.ts`,
  `kit/turns/status.ts`): the status line ("Your turn"; "Ann is playing", or
  "Waiting for Ann…" only when her seat's `connected` is `false`), seats with
  faces, Start, Copy the link, Remind them, **Let the computer play for Ann**
  (only while `canLetComputerPlay()`; asked again on every `turn` event and
  when `handOverAt` comes, no polling), Rematch, Leave, Back, and chat with
  the game's own `game.turns.quickChat` phrases. A move out of turn
  (`mayActNow`) is offered as `board.canMove`.
- **boot** 1.2: a definition's `turns` hook (`draw(ctx, el, board)`,
  `create`) with `game.turns` declared turns it on: the title's **Play
  online** (the computer, a link, anyone; first among the online buttons, and a
  live room beside it is **Play now**), Your games and the title's Continue
  rows open online games on the kit's screen (`openTurns`), an invite link
  (`?hub_turn_link=`) takes the seat at boot (`TurnsFlow`,
  `kit/boot/turns-flow.ts`). Without it nothing changes.
- **core** 1.2: `TurnGameLike` adds `outcome`, `chat`, `chatMode`, `link`,
  `mayActNow`, `start`, `say`, `canLetComputerPlay`, `letComputerPlay`,
  `rematch`; `kit/core/manifest.ts` reads `game.turns` and the quick-chat
  phrases from package.json at build time; new strings for the screen
  (`isPlaying`, `letComputerPlay`, `turns*`, `yourTurn`, `back`).
- **online** 1.1: one chat panel for rooms and online games (`ChatPort`,
  `roomChat`, `gamePhrases`); rooms offer the game's own
  `game.multiplayer.quickChat` phrases after the hub's.
- **ui** 1.1: the turns screen's styles; the due seat outlined.
- **world** 1.2: a game's own room is live: `game.world` (`map` and/or
  `generate`), `kit/world/room.ts` (`parseGameWorld`, `generateRoom`,
  `roomProblems`, `worldKey`) with the hub's schema and
  `@diffenderfer-games/world`. `npm run world:check`, `world:generate`,
  `world:tiled`, `world:build` run the hub's `dg-world` CLI (the `dg-room`
  plan is gone). Tables, Quick match and `setRoster` stay off (W2/W3).
- **testing** 1.2: `FakeTurnGame` has the new members, `seatConnected`,
  `chatFrom` and the client's `canLetComputerPlay` rule; `HUB_PHASES` adds
  `world0` and flips `worldW4` (shipped); W2 and W3 say "coming".
- **hub-events, hub-suites** 1.2: `tests/hub-events/turns.test.ts`; new
  suites `tests/hub/kit/turns.test.ts` (two browsers: a link game, live moves,
  quick-chat, "Waiting for…", the hand-over, the end, Your games) and
  `world.test.ts` (the hub serves the game's room and a Tiled-made one);
  `planned` keeps only world tables and the canvas adapters; the online suite picks
  "Play now" in the Invite to play picker (a game with `game.turns` starts on its
  online game, the default way to play online).
- **scripts** 1.2: `build:rules` skips a game without rules (`npm run build`
  runs it after vite); `new-game --no-turns` (also drops `game.turns` and
  the template's `turns` shot) and `--no-world`, and `--title` names the
  generated room; `checkWorld` uses the hub's `GameWorld` schema.
- **server** 1.2 (docs): `game.data` passes `hub-doctor` since next.8; the
  next.7 gap note is gone. A test checks the contract accepts it.
- **test-hook** 1.1 (docs): the `turns` screen.
- **docs, saved, avatar** 1.2: README, testing (the `checkTurnRules` options,
  `revealed` and `shuffleHidden` among them), the walker figure, Your games.

### Moving a game over

1. `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.9` and
   `npm install --save-exact --save-dev @diffenderfer-games/world@2.0.0-next.9`,
   then `npm run kit:sync`.
2. Online rules: import the types from `../../kit/turns/rules.ts`. In
   package.json set `"build": "vite build && node scripts/kit/build-rules.ts"`
   (and `game.build` back to `npm run build`).
3. To use the kit's screen for online games: add a `turns` hook
   (copy the template's `src/game/turns/board.ts`) to the definition. A game
   with its own screen keeps it and gives no hook. Drop any refresh timer of
   your own: the client catches up by itself.
4. `game.world`: replace any `tables` block with `map` and/or `generate`
   (docs/kit/world.md); the `dg-room` scripts are now `world:*`.
5. An own-server game that kept `game.data` out of package.json: add it now.
6. Tests that called `chatPanel(room, …)` pass `roomChat(room)`.

## 1.1 (2026-10-15)

The hub client is pinned at **2.0.0-next.7** (what diffenderfer.games runs).
Saved games, online games and avatars are live and switched on;
the world stays off (coming in next.9).

- **core** 1.1: `HubLike` takes `hub.saved`, `hub.turns`, `hub.avatar` and
  `hub.userId()` from the client's own types (required, no shims);
  `DailyLike` has `save`, `resume`, `discard`, `inProgress`;
  `planned.ts` keeps only the world. New window events
  `hub:daily-resumed`, `hub:daily-paused`, `hub:daily-discarded`.
- **saved** 1.1: the title's Continue rows come from `hub.saved` (the line
  under Continue is the progress label alone, not "Continue: …" again) (the saved
  game and days in progress, in the hub's wording); `onOpen` takes only the
  kinds the game can open; `discard`, `dailiesInProgress`. `available` is gone.
- **daily, resume, boot** 1.1: a day the player leaves is paused (it stays in
  progress, saved to the day) and comes back with `challenge.saved`; a lost
  day starts over from its seed; a normal game is never saved into a day the
  hub just started; a title still loading never covers a game that started,
  and Your games `change` redraws the title only when its rows changed;
  an opened day plays after the router has mounted it.
- **avatar** 1.1: `avatarRenderer(hub)` loads the hub's renderer
  (`hub.avatar.load()` + `defineAvatarElement()`) before any face draws (the
  title demo drew nothing before); `showFeel` plays the feeling on the
  element's animator (the `feel` attribute did nothing); lobby faces use the
  seat's `look`; the title bust follows your own `change` by
  `hub.userId()`, says "Edit avatar" and sits under the title's buttons
  (a fixed corner covered them on a phone); no initial-letter fallback.
  The starters' `avatar-pixi.ts` / `avatar-three.ts` use the hub's typed adapters.
- **turns** 1.1: the rules contract and `checkTurnRules` are the hub's own
  (`@diffenderfer-games/hub/turns`, re-exported); the adapter is plain
  `hub.turns`. Coming in next.8: the `turns-rules` entry, presence,
  `mayAct`, buzz.
- **testing** 1.1: `FakeHub` always has `saved`, `turns`, `avatar` and
  `userId()` (`planned` takes only `world`); `FakeDaily` keeps days in
  progress (`inProgressDay`); `FakeResume` saves to the day during a daily;
  `HUB_PHASES` marks saved games and avatars shipped.
- **hub-events, hub-suites** 1.1: rows 28, 56, 57 and 62 run; new suites
  `tests/hub/kit/saved.test.ts` and `avatar.test.ts`; `_kit.ts` adds `api(p)`
  and `today(offset)`.
- **scripts** 1.1: the `avatar`, `avatar-designer` and `your-games` shots run.
- **docs, layout, server, world** 1.1 (docs only): the hub menu button's 64px
  corner and `setInsets({ top })` ([layout.md](layout.md#the-hub-menu-button));
  `game.data` for own-server games ([server.md](server.md#backups-gamedata),
  with the next.7 `hub-doctor` gap); the world marked "coming in next.9".

### Moving a game over

1. `npm install --save-exact @diffenderfer-games/hub@2.0.0-next.7`, then `npm run kit:sync`.
2. Online rules (`src/game/turns/rules.ts`): the RNG is the hub's `TurnRng`
   (`rng.int(6)`, not `Math.floor(rng() * 6)`); add `export default rules`.
   `checkTurnRules` throws instead of returning problems: `checkTurnRules(rules, { seats: [2, 3] })`.
3. Tests that built a FakeHub with `planned: { savedGames, turns, avatars }`:
   drop those flags (the APIs are always there). `fake.daily.savedFor.set(day, { saved })`
   is now `fake.daily.inProgressDay(day, saved)`.
4. Code that checked `hub.saved`, `hub.avatar` or `createTurns(hub).available`: they are always there.

## 1.0 (2026-10-15)

The first kit. Every module at 1.0:

- **core, rng, testing**: JSON types, the activity model, strings, the seeded
  RNG, FakeHub and the fakes, the planned-phase list, the balance sim.
- **save, resume, daily, pause, scores, test-hook**: the profile, Continue,
  the daily challenge, pause on hub UI, boards and stats, `window.__game`.
- **boot, input, layout, loop, ui, settings-ui**: `defineGame`, the router and
  screens, controls, the safe region, the fixed-step loop, screens, modals,
  toasts, the settings sheet.
- **race, online, audio, haptics, server**: races, hub rooms (lobby, match,
  chat, reconnect, computer players for away seats), music in a worker,
  vibration, the own-server helper.
- **saved, turns, avatar, world**: written against the planned hub APIs;
  feature-checked, tests skipped until the hub phase ships.
- **hub-events, hub-suites**: a unit test per hub event; browser suites on a
  real hub (pause, saves, daily, race, online, FakeHub parity).
- **scripts**: `check`, `kit:sync/check/hash`, `new-game`, `todo`, `shots`,
  `shots:hub`, `shots:sheet`, `cover`, `local`, `probe`, `ui:check`,
  `clean:procs`, `build:rules`, `world:build/check`, `sync-docs`,
  `sync-hub-server`.
- **ci**: the deploy is gated on `npm run check` and the hub suites.
