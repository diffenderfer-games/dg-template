# Card games

KIT doc. What the owner expects from a card game, beyond [look.md](look.md)
and [polish.md](polish.md). Online card games also follow
[playing-together.md](playing-together.md) and [turns.md](turns.md).

Reference code: card drawing, dealing and motion in `../solitaire`; particles
and a hand of many cards in `../phase10`; the turns screen with a canvas
board in `../pinochle`.

## The hand

- **Select, then confirm.** A tap raises one card (the only raised card); a
  **Play** (or Discard) button confirms it. A misclick never plays a card.
  Tapping the raised card again, or another card, changes the choice.
- **No card stays raised** after a play or for no reason. The raised card is
  the selected one, always.
- The selection highlight goes **around the card** (its outline follows the
  card's shape), not above it or offset from it.
- **Players can reorder their hand** by dragging, and the order **stays**:
  after a draw, a discard or a reload the cards keep the player's order (new
  cards go at the end). Sort buttons are welcome; they never undo a manual
  order without being pressed.
- Drag a card onto a pile to play it, as well as tap then confirm.
- An **auto-arrange** or auto-play helper does the best thing it can: in
  Phase 10, lay down as many cards as possible while keeping one to discard.

## The cards

- Corner indices are the same on every card: the same size, colour, font and
  position, with the number **centred** in its mark. A circle stays a circle
  however wide the number ("10", "11").
- Everything a player needs is readable **on the left edge**, since a hand
  fans to the right: rank and suit in the corner.
- Suits are easy to tell apart at phone size (spades and clubs most of all):
  draw them large enough, with distinct shapes.
- Every card shows its value in the middle too (no blank centres).
- Card faces look as good as the rest of the game. After changing them,
  remake the cover ([covers.md](covers.md#when-to-remake-it)).

## The table

- Turning the phone keeps every card on screen.
- Dealing, playing, drawing and scoring all animate; a won hand or round gets
  particles and a celebration ([look.md §6](look.md#6-gameplay-feedback)).
- Detailed rules and strategy hints are a tap away from the title and from
  the game (in How to play, longer than the title's summary).
- Variants and house rules are options on the **next** screen after Play
  (the table setup), not on the main menu. Default options follow how most
  people play; ask the owner when unsure.
- The computer always moves (in normal play, the daily and online seats it
  plays). Test every mode for a stuck "thinking".

## The daily

A card game's daily is a **mini challenge**: a short scenario from the game
with one or a few ways to win (Phase 10: complete a given phase from a dealt
position), not a full game left to chance. See
[daily-puzzle.md](daily-puzzle.md).
