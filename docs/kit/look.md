# The look: every game's UI and motion

KIT doc. The standard every game's screens, HUD and gameplay feedback must
meet. Read it before drawing anything; check the contact sheet against §9
before calling a game done. Reference code and screenshots are in §10.

## 1. The standard

- **One UI style, each game's own colours.** Every game uses the structure and
  motion in this doc: glass panels, icon buttons with sub-lines, 3D gradient
  headings, things that drop, bob, slide and pop in. The palette is chosen per
  game (§2) and must not copy another game's.
- **Motion is required.** A screen that appears all at once, buttons that sit
  still, or a reward with no feedback is unfinished.
- **Every screen is dressed:** title, HUD, pause, result, how to play,
  settings, toasts. The kit's default look (flat grey buttons on near-black,
  plain white headings, no motion) is a scaffold and never ships.
- **Gameplay answers every action** with motion and sound (§6).
- Screenshots go to the owner with Read (shown inline), phone and desktop.

## 2. Design tokens

Set them once as CSS variables in `src/game/theme.css` and as the same
numbers in the renderer. Two example palettes:

| Token           | Use                                                                      | Purple candy                                                      | Navy neon                                   |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------- |
| `bg`            | page and canvas background, a radial gradient lighter at the top         | `#1b1036`, top `#2e1a5e`                                          | `#0b1020`, top `#141b38`                    |
| `panel`         | glass: a 160° gradient, lighter tint at 55–60 % → darker tint at 72–82 % | `rgba(75,61,153,.6)` → `rgba(27,16,54,.82)`                       | `rgba(30,42,94,.55)` → `rgba(8,12,28,.72)`  |
| `button`        | button face: a 180° gradient, lighter at the top                         | `rgba(111,95,207,.9)` → `rgba(75,61,153,.95)`                     | `rgba(47,64,144,.85)` → `rgba(30,42,94,.9)` |
| `accent`        | primary action, focus glow, success                                      | `#2fd47a`                                                         | `#5cff3b`                                   |
| `accent-dark`   | primary button face                                                      | `#1f8a50` → `#0f4a2a`                                             | `#2f6a1d` → `#173a0d`                       |
| `gold`          | kicker, numbers, rewards, `+N` pops                                      | `#ffb627`                                                         | `#ffd75e`                                   |
| `edge`          | 1 px borders                                                             | `rgba(184,164,255,.25–.35)`                                       | `rgba(143,164,216,.25–.35)`                 |
| `ink` / `muted` | text / secondary text                                                    | `#fff` / `#c9bdf5`                                                | `#eaf0ff` / `#9aa5c9`                       |
| extras          | confetti, sparks                                                         | pink `#ff5fa2`, sky `#36c5f0`, violet `#7c5cff`, orange `#ff7a45` | red `#ff4d5e`, sky `#7fd4ff`                |

- **Type:** display `'Arial Black', 'Helvetica Neue', system-ui, sans-serif`,
  weight 900, for headings, labels and canvas text. Sub-lines, kickers, chips
  and stats in mono (`ui-monospace, 'Cascadia Mono', Menlo, monospace`).
  Long reading text (how to play, toasts) in `system-ui`, weight 500.
- **Shape:** radius 14 px for buttons, 20 px for panels, 999 px for chips.
- **Depth:** raised things have a dark bottom edge (`0 4px 0 rgba(0,0,0,.35)`)
  and an inset top highlight (`inset 0 1px 0 rgba(255,255,255,.08)`); panels
  have a large soft shadow (`0 20px 50px rgba(0,0,0,.55)`). Important things
  glow in their own colour (`0 0 18px <colour at .3–.45>`).
- **Background:** never flat: the radial gradient, a faint scanline over the
  canvas (`repeating-linear-gradient(0deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)`),
  and rising sparks (§4).

## 3. Components

**Glass panel** (title menu, cards, modals): the `panel` gradient, 1 px `edge`
border, radius 20, padding 14–18, the large shadow plus the inset highlight,
`backdrop-filter: blur(4px)`.

**Menu button** (every button on the title, pause and result screens):

- Layout: an **icon tile** (36 px square, radius 10, dark inset background,
  `inset 0 -3px 0 rgba(0,0,0,.35)`, one glyph such as ▶ ★ ⚑ ◎ ⚙ ? ↻ ⌂), then a
  column with the **label** (display 900, ~1 rem) and a **sub-line** (mono,
  0.7 rem, `muted`, one line, ellipsis). Every button has a sub-line saying
  what it does in plain words ("Today's puzzle is waiting", "Your game is saved").
- Hover, focus and gamepad focus (`.hub-nav-focus`): border `accent`, glow
  `0 0 0 3px <accent .18>, 0 0 22px <accent .3>`, the icon tile fills with
  `accent` and tilts (`scale(1.12) rotate(-6deg)`), a ◀ pointer appears at the
  right and bounces (0.6 s, alternate), the button lifts 2 px; pressed, it
  drops 2 px.
- **Primary** (Play, Resume, Play again): `accent-dark` face, `accent` border
  and glow, a 42 px icon tile filled `accent`, a larger label, and a **sheen**:
  a skewed band of `rgba(255,255,255,.28)` sweeping across every 3.6 s.

**Chip:** a pill with a dark inset background and 1 px `edge`: a small mono,
uppercase, letter-spaced label, then a `gold` value (`PLAYED 4`, `BEST 12`).

**Kicker:** above the game's name: mono 0.72 rem, letter-spacing 0.42 em,
uppercase, `gold` with a soft gold glow; three short words separated by `·`
that sum up the game.

**Wordmark:** the game's name, `clamp(2.2rem, 11vw, 3.8rem)`, as 3D lettering
(a vertical light-to-dark gradient clipped to the text, a 3 px dark drop
shadow, a coloured glow) or built from the game's own pieces (tiles, cards,
blocks). Never on top of busy canvas art.

**Taglines:** four short lines under the name, rotating in place.

**Card** (pause, result): one glass panel holding the heading, a mono sub-line
(where the player is), stat chips, the body and the menu. Headings use the 3D
gradient lettering in `accent`; a loss uses `gold`, not red.

**Modals** (how to play, settings): the same glass panel and heading.

**HUD:** chips at the top centre, clear of the hub menu's corner: the score
chip with a small animated icon, and one chip for the second number (level,
streak, tries). No loose text.

**Tiles, keys and pieces in the canvas:** two-tone faces (light top over
55–62 % of the height, deep bottom), a dark offset shadow below, a white
highlight band near the top, a soft glow in their own colour for good states.
Empty slots are dark glass with a 1–2 px border. Each play area sits on its
own glass panel.

## 4. Motion

Easings: bouncy `cubic-bezier(.2, 1.6, .4, 1)`, settle `cubic-bezier(.2, .9, .3, 1.1)`.

| What           | Animation                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark       | each letter drops in with squash (`translateY(-120%) scale(.6,1.4)` → `scale(1.15,.85)` → rest), 0.7 s bouncy, 0.07–0.08 s apart; then bobs forever (2.8 s, up 6–7 px, ±3°), offsets 0.14 s |
| Kicker         | fades up 0.6 s, after 0.55 s                                                                                                                                                                |
| Taglines       | one every 3.5 s (a 14 s cycle of four), fading up in and up out                                                                                                                             |
| Title panel    | slides up and scales from 0.97, 0.55 s settle, after 0.25 s                                                                                                                                 |
| Buttons        | slide up 14 px and fade in, 0.42 s settle, **60 ms apart**, in order                                                                                                                        |
| Cards, modals  | pop from scale 0.92 and 10 px down, 0.32 s; the heading bounces in with squash, 0.6 s; sub-line and chips fade up 0.12 s / 0.18 s later; buttons stagger as above                           |
| HUD chips      | slide in 80 ms apart when play starts                                                                                                                                                       |
| Reward         | the score chip hops (scale 1.25) and glows `gold` as the reward lands; a mono `+N` floats up 46 px and fades over 0.9 s                                                                     |
| Primary button | the sheen, every 3.6 s                                                                                                                                                                      |
| Background     | 15–45 small glowing squares (the palette's bright colours) rising, swaying ±18 px, twinkling; they rush upward for a moment on a big success                                                |
| Title backdrop | **attract mode:** the game plays itself behind the title (a bot or a scripted demo), blurred with `filter: blur(3px) brightness(.75) saturate(1.2)` under a vignette                        |

Rules:

- A screen that must answer at once (pause) starts animating within ~0.1 s and
  finishes its entrance in under 0.7 s.
- Honour `prefers-reduced-motion`: no loops (bob, sparks, sheen, icon spin)
  and no entrances.
- Use `animation-fill-mode: both` only with short delays, so a slow device or a
  screenshot never shows an empty screen.

## 5. Every screen

| Screen                | Must have                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                 | kicker, wordmark, taglines, glass panel of icon buttons with sub-lines, primary with sheen, footer chips (played, best), sparks, attract mode behind; Continue rows dressed the same; the avatar bust below |
| Play                  | HUD chips at the top centre; the play area on its glass panel; the hub menu's 64 px corner empty; the pause button themed                                                                                   |
| Pause                 | the card: heading, where the player is, stat chips, Resume (primary), Start over, Settings, Back to the title, each with an icon and a sub-line                                                             |
| Result                | the card: heading (won in `accent`, lost in `gold`), the score counting up, what happened in this game, the best, Play again (primary), Back to the title                                                   |
| How to play, Settings | glass panel, gradient heading, rows fading in one after another                                                                                                                                             |
| Toasts                | glass, a `gold` left edge, system font                                                                                                                                                                      |

## 6. Gameplay feedback

Every player action is answered within a frame, with motion and a sound:

- **Input:** the thing pressed pops (scale 1 → 1.18 → 1 over 0.16 s); on-screen
  keys and buttons dip when pressed (0.14 s).
- **Refusal:** a shake (±14 % of the piece size, fading over 0.5 s), a short low
  buzz, and a `gold` pill message that pops in and fades after ~1.4 s.
- **Reveals:** one piece at a time with a stagger (about 0.25 s apart, 0.35–0.4 s
  each), each with a pop sound whose pitch rises; good results brighter and higher.
- **Success:** the winning pieces bounce in a wave (~0.09 s apart); confetti
  bursts from the spot and from both bottom corners; the reward flies along an
  arc to the HUD and the HUD reacts (§4); the sparks rush; a card pops in
  saying what happened and what was earned.
- **Miss or loss:** a softer falling two-note sound, and the answer shown kindly.
- **Timing belongs to the rules** whenever the outcome waits for it: the kit
  ends the game the frame `outcome()` returns non-null, so count reveals and
  celebrations in fixed steps (`phase`, `phaseT` in the saved state); they then
  pause and replay with the game.

## 7. Layout

- Phone first, 390 × 844. When the game has on-screen controls (a keyboard, a
  pad), lay out in screen pixels from `ctx.region()` rather than letterboxing a
  fixed arena: controls fill the phone's width; the board takes the space above.
- Touch targets at least 44 × 44. Nothing in the hub menu's 64 px corner
  (`game.menuPosition`).
- Desktop 1280 × 800: the play column centred; the background fills the sides.
- Check `phone-land` and `tablet` once: `npm run shots -- --size phone-land,tablet`.

## 8. Dressing the kit's screens

The kit builds its screens; the game dresses them from its screen hooks
(`screens.title`, `hud`, `pause`, `result`) and `theme.css`. Helpers worth
writing once in `src/game/screens/`:

```ts
iconButton(btn, '▶', 'Back to the board'); // icon tile + label + sub-line
iconButtons(root, { resume: ['▶', '…'], quit: ['⌂', '…'] }); // by data-testid
staggerIn(menu, startIndex); // sets --i on each button + a class for the 60 ms stagger
card(screenEl, subLine); // heading, sub-line, body and menu into one glass card
statRow([
  ['Score', '12'],
  ['Level', '3'],
]); // chips
popFrom(hudChip, '+3'); // the floating reward
```

The kit's markup and test ids:

- Title: `div.kit-title-screen.kit-dim` > `h1.kit-title` (`game-title`),
  `p.kit-tagline`, `div.kit-continue`, `div.kit-menu` > `button.kit-btn` with
  test ids `continue` / `continue-<id>`, `play`, `daily`, `race`,
  `race-browse`, `online`, `turns-new`, `settings`, `howto`. The first button
  is `.kit-primary`; a kit sub-line is `span.kit-btn-sub`.
- Play: `div.kit-corner` > `button.kit-pause-btn` (`pause`), `div.kit-hud` (`hud`).
- Pause: `div.kit-dim` > `h2.kit-title`, `div.kit-menu` > `resume`, `restart`, `settings`, `quit`.
- Result: `div.kit-dim` > `h2.kit-title` (`result-title`), `div.kit-result-body`, `div.kit-menu` > `play-again`, `quit`.
- Modals: `div.kit-modal` > `div.kit-modal-sheet` > `.kit-modal-title`,
  `.kit-modal-body` (`.kit-row` per setting), `.kit-modal-buttons`.

Rules:

- Wrap and move the kit's elements and replace a button's contents freely;
  keep the button element, its `data-testid`, its `data-nav` and its label text
  (menu navigation and the kit's tests rely on them).
- Text the kit's tests read stays readable as text when styled: `title-best`
  and `result-best` hold `Best N` (`<span>Best </span><strong>N</strong>`).
- The kit's CSS is injected after `theme.css`, so a selector of equal weight
  loses: write `html:root { --kit-bg: … }` and `html .kit-btn { … }`.
- Set the kit's variables (`--kit-bg`, `--kit-panel`, `--kit-fg`,
  `--kit-muted`, `--kit-accent`, `--kit-accent-fg`, `--kit-accent-2`,
  `--kit-font`) to the palette too, so anything not restyled still matches.
- Attract mode: toggle a class on `<html>` from the `render` hook when
  `run === null && ctx.session.screen === 'title'`, and blur the canvas with it.

## 9. Checking it

1. `npm run shots`, Read `shots/sheet.png`, then Read the phone shots at full
   size (title, play, pause, result, how to play, settings).
2. The kit's scenarios shoot screens mid-entrance. Add a scenario per card that
   waits ~1 s (`await c.wait(1000)`) to see it settled.
3. For each shot: the palette is applied (no kit grey, no flat background);
   every button has an icon and a sub-line; headings are 3D lettering; panels
   are glass; the menu corner is empty; text fits a 390 px phone; the play
   area has its panel; sparks are visible.
4. Play once in a browser (or a scenario): press, get refused, reveal, win,
   lose, pause, open settings. Each one moves and sounds.

## 10. References

Code:

- UI style and motion: `../weston/src/ui/ui.css` (title, menu panel, buttons,
  cards, keyframes), `../weston/src/ui/screens.ts` (title and pause builders).
- The style applied to the kit's screens: `../wordle/src/game/theme.css`,
  `../wordle/src/game/screens/style.ts`, `title.ts`, `pause.ts`, `result.ts`,
  `hud.ts`; canvas pieces, sparks, confetti, flying rewards and attract mode in
  `../wordle/src/game/render/scene.ts`.

Screenshots (`docs/kit/look/`, phone 390 × 844 unless noted):

| File                                            | Shows                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [title.png](look/title.png)                     | kicker, wordmark, taglines, glass menu panel, icon buttons, chips, attract mode behind |
| [title-desk.png](look/title-desk.png)           | the same at 1280 × 800                                                                 |
| [play.png](look/play.png)                       | HUD chips, the play area on its panel, coloured pieces and keys                        |
| [success.png](look/success.png)                 | a success: bouncing pieces, confetti, reward flying to the HUD, the result card        |
| [pause.png](look/pause.png)                     | the pause card settled                                                                 |
| [result.png](look/result.png)                   | the result card                                                                        |
| [cover.png](look/cover.png)                     | a catalog cover taken mid-celebration (1280 × 800)                                     |
| [reference-title.png](look/reference-title.png) | the original style in a different palette (1280 × 800)                                 |
