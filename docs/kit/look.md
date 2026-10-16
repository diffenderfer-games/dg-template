# The look: what every game's UI must be

KIT doc. What the owner expects from every game's screens and motion, in
enough detail to build it without having seen the earlier games. Read it
before you draw anything; check your contact sheet against §9 before you
call the game done.

Reference games on this machine: **Weston** (`../weston`, `src/ui/ui.css`,
`src/ui/screens.ts`): the UI style everything follows; **Wordle** (`../wordle`):
the same style applied to the kit's screens, in its own colours (the files are
listed in §8, copy them). Bubble Pop (`../bubblepop`) is the bar for gameplay
juice.

## 1. What the owner wants (and has said no to)

- **Every game looks and moves like Weston's UI.** The structure and the
  motion are fixed: glass panels, icon buttons with sub-lines, 3D gradient
  headings, things that drop, bob, slide and pop in. "It's not just visuals,
  it's the animation": a screen that appears all at once, or buttons that
  sit still, is not done.
- **Each game keeps its own colours.** Weston's navy and neon green are
  Weston's. Wordle is purple candy (deep purple night, candy green, gold,
  pink, sky blue) and the owner liked it: "We don't want its colours". Pick a
  palette that fits the game and apply it through the tokens in §2.
- **The kit's default look is not acceptable to ship**: flat grey buttons on
  near-black, plain white headings, no motion. It is a scaffold.
- **Every screen gets the treatment**, not just the title: pause, results,
  how to play, settings, toasts and the HUD all match ("Paused modal should
  get same styling").
- **Gameplay is fun and animated** like the arcade games here (Bubble Pop):
  every action answers with motion and sound (§6).
- The owner reviews screenshots. Show them with Read (not as file
  attachments), phone and desktop.

## 2. Design tokens

Set these once (CSS variables in `src/game/theme.css`, the same numbers as
constants in the renderer). Values in brackets are Wordle's.

| Token           | Use                                                                                 | Wordle                                                            | Weston                                      |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `bg`            | page and canvas background (radial gradient lighter at the top)                     | `#1b1036` → top `#2e1a5e`                                         | `#0b1020` → `#141b38`                       |
| `panel`         | glass panels: a 160° gradient of a lighter tint at 55–60% → a darker tint at 72–82% | `rgba(75,61,153,.6)` → `rgba(27,16,54,.82)`                       | `rgba(30,42,94,.55)` → `rgba(8,12,28,.72)`  |
| `button`        | button face: 180° gradient, lighter top                                             | `rgba(111,95,207,.9)` → `rgba(75,61,153,.95)`                     | `rgba(47,64,144,.85)` → `rgba(30,42,94,.9)` |
| `accent`        | primary action, focus glow, "good"                                                  | `#2fd47a`                                                         | `#5cff3b`                                   |
| `gold`          | kicker, numbers, coins, "+N" pops                                                   | `#ffb627`                                                         | `#ffd75e`                                   |
| `edge`          | 1 px borders                                                                        | `rgba(184,164,255,.25–.35)`                                       | `rgba(143,164,216,.25–.35)`                 |
| `ink` / `muted` | text / secondary text                                                               | `#fff` / `#c9bdf5`                                                | `#eaf0ff` / `#9aa5c9`                       |
| extra           | confetti, sparks                                                                    | pink `#ff5fa2`, sky `#36c5f0`, violet `#7c5cff`, orange `#ff7a45` | red `#ff4d5e`, sky `#7fd4ff`                |

- **Type:** display `'Arial Black', 'Helvetica Neue', system-ui, sans-serif`,
  weight 900, for headings, labels and the canvas. Sub-lines, kickers, chips
  and stats in mono (`ui-monospace, 'Cascadia Mono', Menlo, monospace`).
  Long reading text (how to play, toasts) in `system-ui` 500.
- **Shape:** radius 14 px for buttons, 20 px for panels, 999 px for chips.
- **Depth:** every raised thing has a dark bottom edge (`0 4px 0 rgba(0,0,0,.35)`),
  an inset top highlight (`inset 0 1px 0 rgba(255,255,255,.08–.1)`), and
  panels a big soft shadow (`0 20px 50px rgba(0,0,0,.55)`). Important things
  glow in their own colour (`0 0 18–22px <colour at .3–.45>`).
- **Background:** never flat. A radial gradient, a faint scanline
  (`repeating-linear-gradient(0deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)`
  over the canvas), and rising glowing sparks (§4).

## 3. Components

All of these exist in Wordle's `src/game/theme.css` and `src/game/screens/style.ts`.

**Glass panel** (the title menu, every card and modal): the `panel` gradient,
1 px `edge` border, radius 20, padding 14–18, the big shadow + inset
highlight, `backdrop-filter: blur(4px)`.

**Menu button** (every button on title, pause, result):

- A row: an **icon tile** (36 px square, radius 10, dark inset
  `rgba(<bg>,.55)`, `inset 0 -3px 0 rgba(0,0,0,.35)`, a single glyph: ▶ ★ ⚑ ◎ ⚙ ? ↻ ⌂),
  then a column with the **label** (display 900, ~1.02 rem) and a **sub-line**
  (mono, 0.7 rem, `muted`, one line, ellipsis). Every button has a sub-line
  that says what it does in plain words ("Words in a row until you miss one",
  "Today's word is waiting", "Your game is saved").
- Hover / focus / gamepad focus (`.hub-nav-focus`): border turns `accent`,
  `0 0 0 3px <accent .18>, 0 0 22px <accent .3>` glow, the icon tile turns
  `accent` and tilts (`scale(1.12) rotate(-6deg)`), a ◀ pointer appears at
  the right and bounces (0.6 s alternate), the button lifts 2 px. Pressed:
  drops 2 px.
- **Primary** (Play, Resume, Play again): an `accent`-dark gradient
  (Wordle `#1f8a50` → `#0f4a2a`), `accent` border and glow, a larger icon
  tile filled `accent`, a bigger label, and a **sheen**: a skewed white band
  (`rgba(255,255,255,.28)`) sweeping across every 3.6 s.

**Chip:** pill, dark inset background, 1 px `edge`, a small mono uppercase
letter-spaced label then a `gold` number: `PLAYED 0`, `BEST 12`, `COINS 3`.

**Kicker:** above the name, mono 0.72 rem, letter-spacing 0.42 em, uppercase,
`gold` with a soft gold glow, three short words: `GUESS · FLIP · SOLVE`,
`RUN · JUMP · STOMP`.

**Wordmark:** the game's name, big (`clamp(2.2rem, 11vw, 3.8rem)`), as
3D lettering (a vertical light-to-dark gradient clipped to the text, a 3 px
dark drop shadow and a coloured glow) or as tiles/objects from the game
itself (Wordle: letter tiles in the game's colours). It never sits on top of
canvas art.

**Taglines:** under the name, four short lines that rotate in place, one
every 3.5 s, fading up in and up out.

**Card** (pause, result): one glass panel holding the heading, a mono
sub-line (where you are: "Word 3 · guess 2 of 6"), stat chips, the body,
and the menu. Headings are the 3D gradient lettering in `accent`
(a loss or a miss in `gold`, never red-for-failure in a kids' game).

**Modals** (how to play, settings): the same glass panel and heading.

**HUD:** chips at the top centre (never under the hub menu's corner): the
score chip with a spinning coin/icon, a second chip for streak / guess /
level. Dark gradient pill, 1 px border, shadow; no free-floating text.

## 4. Motion (the part most often missing)

Timings and easings to use (Weston's numbers). The bouncy easing is
`cubic-bezier(.2, 1.6, .4, 1)`, the settle easing `cubic-bezier(.2, .9, .3, 1.1)`.

| What                   | Animation                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark letters/tiles | drop in from above with squash (`translateY(-120%) scale(.6,1.4)` → overshoot `scale(1.15,.85)` → rest), 0.7 s bouncy, 0.07–0.08 s apart; then bob forever (2.8 s: up 6–7 px, rotate ±3°), each offset 0.14 s; tiles also flip now and then |
| Kicker                 | fade up 0.6 s after 0.55 s                                                                                                                                                                                                                  |
| Taglines               | rotate every 3.5 s (14 s cycle of 4)                                                                                                                                                                                                        |
| Title panel            | slide up + scale from 0.97, 0.55 s settle easing, after 0.25 s                                                                                                                                                                              |
| Buttons                | slide up 14 px + fade, 0.42 s settle easing, **60 ms apart**, in order                                                                                                                                                                      |
| Cards and modals       | pop: scale 0.92 + 10 px down → rest, 0.32 s; heading bounces in (squash) 0.6 s; sub-line and chips fade up 0.12 s / 0.18 s later; buttons stagger as above                                                                                  |
| HUD chips              | slide in, 80 ms apart, when play starts                                                                                                                                                                                                     |
| Score gained           | the score chip hops (scale 1.25) and glows in `gold` as the reward lands; a mono `+N` floats up 46 px and fades (0.9 s)                                                                                                                     |
| Primary button         | sheen every 3.6 s                                                                                                                                                                                                                           |
| Background             | 15–45 glowing square sparks (gold, accent, sky, pink) rising, swaying ±18 px, twinkling; they rush upward for a moment on a big win                                                                                                         |
| Title backdrop         | **attract mode**: the game plays itself behind the title (a bot), blurred (`filter: blur(3px) brightness(.75) saturate(1.2)`), under a vignette                                                                                             |

Rules:

- Screens that must answer at once (pause) may animate their contents, but
  nothing waits more than ~0.1 s to start, and the whole entrance is done in
  under 0.7 s.
- Honour `prefers-reduced-motion`: turn the loops (bob, sparks, sheen, coin
  spin) and entrances off.
- Use `animation-fill-mode: both` only with short delays: a screenshot or a
  slow device must never show an empty screen for long.

## 5. Every screen, checked

| Screen                | Must have                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                 | kicker, wordmark, taglines, glass panel with icon buttons (+ sub-lines), primary with sheen, footer chips (played, best), sparks, attract-mode game behind; Continue rows dressed the same; the avatar bust below |
| Play                  | HUD chips top centre; the play area on its own glass panel; the hub menu's 64 px corner empty; the pause button themed                                                                                            |
| Pause                 | the card: heading, where you are, stat chips, Resume (primary) / Start over / Settings / Back to the title, each with icon + sub-line                                                                             |
| Result                | the card: heading (won/accent, lost/gold), the score counting up, what happened (Wordle: the words with their meanings), best, Play again (primary) / Back to the title                                           |
| How to play, Settings | glass panel, gradient heading, rows fading in                                                                                                                                                                     |
| Toasts                | glass, `gold` left edge, system font                                                                                                                                                                              |

## 6. Gameplay juice (in the canvas)

Every player action gets an answer within a frame, with motion and a sound:

- **Input:** what you press pops (scale 1 → 1.18 → 1 in 0.16 s); keys on an
  on-screen keyboard dip when pressed (0.14 s).
- **Refusal:** shake (±0.14 × size, decaying over 0.5 s) + a short low buzz +
  a gold pill message that pops in and fades after ~1.4 s.
- **Reveals:** one thing at a time with a stagger (Wordle: tiles flip 0.26 s
  apart, 0.38 s each), each with a pop whose pitch rises; good results
  brighter and higher.
- **Success:** the winning things bounce in a wave (0.09 s apart), a confetti
  burst from the spot plus two from the bottom corners, the reward (coins)
  flies along an arc to the HUD and the HUD reacts (§4), the sparks rush, a
  card pops in saying what happened ("GREAT!", the word, its meaning, "+3 coins").
- **Miss / loss:** a softer two-note fall, the answer shown kindly ("The word was…").
- **Tiles and keys:** two-tone gradient faces (light top 55–62 %, deep bottom),
  a dark offset shadow below, a white highlight band at the top, a soft glow
  in the tile's own colour for good states. Empty slots are dark glass with a
  1–2 px border.
- **Background:** the sparks (§4) and a glass panel behind each play area.
- **Timing lives in the rules** when the game's outcome waits for it (the kit
  ends the game the frame `outcome()` returns non-null), so the celebration
  is counted in fixed steps (`phase`, `phaseT`) and pauses with the game.

## 7. Layout

- Phone first: 390 × 844. Lay out in screen pixels from `ctx.region()`, not a
  fixed letterboxed arena, when the game has controls on screen (a keyboard
  fills the phone's width; the board takes the space above it).
- Touch targets ≥ 44 × 44. Nothing under the hub menu's 64 px corner
  (`menuPosition`, top-right in the template).
- Desktop 1280 × 800: the play column centred; the background (sparks,
  gradient) fills the sides.
- Check `phone-land` and `tablet` once (`npm run shots -- --size phone-land,tablet`).

## 8. Building it on the kit (how Wordle did it)

The kit draws its screens; the game dresses them from its screen hooks and
`theme.css`. Copy these files from `../wordle` and change the colours,
icons and words:

| File                                                     | What it gives you                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/theme.css`                                     | the tokens, every component in §3, every animation in §4, the kit overrides                                                               |
| `src/game/screens/style.ts`                              | `iconButton`, `iconButtons(root, { testid: [icon, sub] })`, `staggerIn(menu, start)`, `card(screen, sub)`, `statRow`, `popFrom(el, '+3')` |
| `src/game/screens/title.ts`                              | kicker, tile wordmark, taglines, panel + chips, sparks                                                                                    |
| `src/game/screens/pause.ts`, `result.ts`, `hud.ts`       | the cards and the HUD chips                                                                                                               |
| `src/game/strings.ts` `TITLE`, `PAUSE`, `RESULT_BUTTONS` | the icons and sub-lines per button test id                                                                                                |
| `src/game/render/scene.ts`                               | canvas tiles/keys with glow, sparks, confetti, flying coins, the word card, the attract-mode demo                                         |
| `src/game/hooks.ts` `render`                             | toggles `html.wl-attract` on the title (blurs the canvas)                                                                                 |

What the kit gives you to dress (markup and test ids):

- Title: `div.kit-title-screen.kit-dim` > `h1.kit-title` (`game-title`),
  `p.kit-tagline`, `div.kit-continue`, `div.kit-menu` > `button.kit-btn` with
  test ids `continue` / `continue-<id>`, `play`, `daily`, `race`,
  `race-browse`, `online`, `turns-new`, `settings`, `howto`; the first is
  `.kit-primary`; a kit sub-line is `span.kit-btn-sub`.
- Play: `div.kit-corner` > `button.kit-pause-btn` (`pause`), `div.kit-hud` (`hud`).
- Pause: `div.kit-dim` > `h2.kit-title`, `div.kit-menu` > `resume`, `restart`, `settings`, `quit`.
- Result: `div.kit-dim` > `h2.kit-title` (`result-title`), `div.kit-result-body`, `div.kit-menu` > `play-again`, `quit`.
- Modals: `div.kit-modal` > `div.kit-modal-sheet` > `.kit-modal-title`, `.kit-modal-body` (`.kit-row`s), `.kit-modal-buttons`.

Rules when dressing:

- You may move elements into your own wrappers and replace a button's
  contents. Keep `data-testid`, `data-nav` and the button element itself
  (menu navigation and the kit's tests find them by those), and keep the
  label text inside the button.
- Keep the kit's test texts readable: `title-best` / `result-best` contain
  "Best N" as text even when styled as a chip (`<span>Best </span><strong>N</strong>`).
- **Specificity:** the kit injects its CSS after `theme.css`, so equal
  selectors lose. Until the kit changes that (see `docs/plans/after-wordle.md`
  §6 in the template), write `html:root { --kit-…: … }` and `html .kit-btn { … }`.
- Use the kit's colour variables too (`--kit-bg`, `--kit-accent`, …) so the
  parts you don't restyle still match.

## 9. Checking it

1. `npm run shots`, then Read `shots/sheet.png`, then Read the phone shots
   full size (title, play, pause, result, how to play, settings).
2. Animated screens are caught mid-entrance by the kit's scenarios. Add a
   scenario that waits ~1 s (Wordle's `paused-card`) to see each card settled.
3. Against each shot: tokens applied (no kit grey, no near-black flat
   background); every button has an icon and a sub-line; headings are 3D
   lettering; panels are glass; nothing under the menu corner; text fits on a
   390 px phone without wrapping awkwardly; the play area has its panel and
   the background its sparks.
4. Play it once yourself in the browser (or a scenario): press, refuse,
   reveal, win, lose, pause, open settings. Every one of them moves.
