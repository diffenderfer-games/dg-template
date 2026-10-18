# Covers

KIT doc. The cover (`cover.png`, `game.image`) **is** the game's card on the
home page: 800 × 420, shown whole ([HANDOFF.md](../../HANDOFF.md) "Image / tile").
How to shoot one is in [screenshots.md](screenshots.md#cover); this doc is
what a good one looks like. The owner reviews every cover, so get it right
before the game ships ([review.md](review.md)).

## The two layouts

**Title left, game right** (most games: cards, words, puzzles, arcade). The
game's name on the left in large wordmark lettering ([look.md §3](look.md#3-components)),
a short pill under it with a few words when the game isn't well known
("Classic Klondike · Daily Challenge"), and the board on the right, **zoomed
in** and often tilted a little on its own panel. Examples: `../solitaire`,
`../sliderush`, `../uno`, `../bubblepop`.

**Title in front** (immersive games: 3D, a world, a mood). A full-bleed scene
from the game with the name large across it and a one-line subtitle below.
Example: `../dont-look`.

## Rules

- **Zoomed in on the game.** The board or scene fills its side; nothing small
  or far away.
- **Only the game.** No on-screen keyboard, word box, menu, toolbar or HUD
  clutter. Remove them for the shot (a showcase driver) rather than cropping
  around them.
- **A board that shows the game, not a busy one.** A good-looking moment
  mid-game; it doesn't need lots of activity.
- **The name is part of the art**, in decent-sized letters in the game's own
  style (the wordmark, or built from the game's pieces), readable on a phone
  card.
- **The bottom left, bottom right, top right and the middle of the top edge
  stay calm**: the home page puts the play count, the daily icon, the menu
  and the "playing now" pill there.
- Its quality matches the best covers in the catalog. Look at a few before you
  start, and compare yours side by side before calling it done.

## When to remake it

- Whenever the game's look changes (new cards, new pieces, a new palette).
  A cover that shows the old look is a bug.
- When the hub's card size changes: `npm run cover` follows the kit's `cover`
  size.

## Making it

A game's own `cover` scenario in `scripts/shots.config.ts` sets up the board
with a showcase driver and hides what doesn't belong
([screenshots.md](screenshots.md#cover)). Keep the scenario so the cover can
be remade later. Then `npm run cover` and look at `cover.png` with Read.
