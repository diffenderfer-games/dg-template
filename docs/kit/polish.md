# Polish: what the owner checks on every screen

KIT doc. The details the owner sends back most often, as a checklist. Go
through it before you send screenshots or a link for review
([review.md](review.md)); the `game-review` agent
(`.claude/agents/game-review.md`) checks a game against it. The style itself (palette, components, motion) is
[look.md](look.md); covers are [covers.md](covers.md); card games add
[card-games.md](card-games.md); online games add
[playing-together.md](playing-together.md).

## 1. Every screen is juicy, not just the title

- The title is not the only screen that gets the look. **Every** modal, page
  and panel gets it too: pause, result, how to play, settings, the new game or
  options screen, the online and lobby screens, waiting screens, confirms.
  A plain modal next to a dressed title is the most common miss.
- "Juicy" means motion as well as looks: entrances, staggered buttons, hover
  and press animations, the primary button's sheen, particles on success
  ([look.md §4](look.md#4-motion)). A screen that looks right but sits still
  isn't done.
- Buttons are the menu buttons of [look.md §3](look.md#3-components)
  everywhere, in every modal, not only on the title.
- Text styled as a heading (a gradient, 3D lettering) matches the buttons and
  the wordmark in the same game. A gradient that clashes reads as a mistake.
- Gameplay gets particles too: movement trails, pickups, jumps, wins. Bright
  and fun, in the game's palette.
- References: the motion in `../bubblepop` and `../weston`; the buttons and
  modals in `../lingo` and `../weston` (their UI, not their covers).

## 2. Spacing and alignment

- **Horizontal padding is at least the vertical padding** on buttons, labels,
  pills and chips. Lots of vertical padding with no horizontal padding is the
  most common spacing complaint.
- Pills and chips are padded evenly on every side and never wrap. If the text
  would wrap, shorten the sentence ("Waiting for 2 more"), don't let the pill
  grow a second line.
- Buttons in a group share one width and line up at every size. Lay them out
  in one or two columns (a lone button on top, centred) rather than letting
  each one size to its text.
- No dead space. Rows of headers, filters and toolbars above the content are
  compact. A control that isn't used often goes into a menu or a modal
  instead of taking a row.
- Long screens show the main actions first. On a phone the Play buttons are
  never pushed below a long leaderboard or list.

## 3. Text fits

- Popovers, labels and tooltips **grow to fit their text**, up to the
  viewport's width. Use an ellipsis only as a last resort, when the text
  really can't fit.
- Text in profiles, cards and chat wraps. It never makes a panel scroll
  sideways.
- Subtitles and secondary text are readable against the background: check
  the contrast on the phone shot, not only on the desktop shot.

## 4. Phones first

- Check every screen at 390 × 844 first ([look.md §7](look.md#7-layout)).
- Touch play works: on-screen controls show (a joystick, buttons), and
  instructions say "tap" and "drag", never keys, on a touch screen.
- Turning the phone keeps everything on screen. Nothing disappears, and the
  layout redraws (`npm run shots -- --size phone-land`).
- The hub menu button gets its corner on a phone too, with nothing under it
  ([layout.md](layout.md#the-hub-menu-button)).
- **No focus outline on touch.** The browser's default focus ring (often an
  orange outline that doesn't fit the button) never shows. Focus shows only
  for keys and a gamepad, as the hub's focus ring or the button's own
  highlight ([look.md §3](look.md#3-components)): `:focus { outline: none }`
  and `:focus-visible` styles that follow the button's shape.
- Turn games buzz when it's the player's turn ([haptics.md](haptics.md)):
  players often hold the phone and wait.

## 5. Every press answers

- A button that starts something slow (create, join, start, save) shows a
  loading state at once and is disabled until the result comes back, so the
  player knows it worked and can't press it twice.
- No dead buttons. Every button on every screen does something: press each
  one in a shot or a test (Play alone, Start, Tap to play, Invite).
- A tap that jumps somewhere (to the daily, to another screen) says so with a
  toast, so the player isn't left wondering whether it worked.
- The computer's turn never hangs: "Sal is thinking" ends in a move every
  time, the daily included. Test that the computer can move in every mode.

## 6. No flashes or jumps while loading

- Nothing appears unstyled while it loads: buttons look like buttons from the
  first frame (styles load before the screen shows, or the screen waits).
- The game doesn't flash on screen for a moment before an intro or a menu
  covers it.
- Layouts that wait for data keep their size: show the last known values
  (saved in `localStorage`) or a placeholder of the same size, so the page
  doesn't jump when the data arrives.
- Countdowns, banners and popovers keep one position. They never jump
  between centred and off-centre, and a popover never moves while the player
  is trying to press it.

## 7. Game feel

- Brisk. When in doubt make it faster: the owner asks for "faster pace" far
  more often than for slower.
- Fair and honest collisions. Hitting something that should hurt does hurt,
  nothing passes through walls or trees, and the player never gets stuck
  vibrating against an obstacle.
- Hard to fail by accident; easy to try again.
- Controls are responsive: a tap that should move things moves them now (a
  tap on a tile in line with the gap shifts the whole row toward it).
- Progress is never lost. Leaving, a phone call or a reload never resets
  levels or unlocks ([save.md](save.md), [resume.md](resume.md)).
- The daily is a short challenge, not a full game, when a full game would be
  long or left to chance ([daily-puzzle.md](daily-puzzle.md)).

## 8. Words players see

- Plain, short and kind, for kids. No jargon, no raw URLs (an invite is an
  **Invite link** button, not a printed `http://` link).
- Names that aren't overused ("pop" is) and that say what the thing is.
- Don't add buttons or features nobody asked for. If a doc or habit says to
  add one (an Edit avatar button on the title, say), check that the game
  needs it first.
