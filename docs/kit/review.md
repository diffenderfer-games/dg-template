# Handing a game to the owner

KIT doc. How the owner reviews games and what they expect from an agent
along the way. Before asking for a review, check the game against
[polish.md](polish.md), and [covers.md](covers.md) for the cover: the
`game-review` agent (`.claude/agents/game-review.md`) does that check from
the screenshots and the code. Run it, fix what it reports, then hand over.

## Show, then push

- **Show before you push** any visual change, unless the owner asked you to
  deploy it ("notify me when it's live"): screenshots of the phone and
  desktop views (look at them with Read first, then show them), or a preview
  page for a choice between options. Pushing deploys
  ([repo-setup.md](../repo-setup.md)), so a push is a release.
- **A test link for the owner's phone.** Run the game on a free port
  (`npm run local`, or `npm run dev -- --host`) and give two URLs: the
  machine's LAN address (`http://192.168.x.x:<port>/…`) and its Tailscale
  name (`http://gandalf.tail9e7055.ts.net:<port>/…`). A server bound to
  `127.0.0.1` can't be reached from the phone: bind to all addresses or put a
  forwarder in front. Stop the server when the owner is done
  (`npm run clean:procs`).
- **Tell the owner when it's ready** with the notify tool: when screenshots
  are ready for review, when a test link is up, when a deploy is live. Say
  what to look at.
- When a fix is asked for, check it on the screen where it was seen (a phone
  shot for a phone bug) before saying it's done.

## Scope

- Do what was asked, and nothing that wasn't. A button, a feature or a
  screen nobody asked for is something the owner has to find and remove.
- Ask when a choice is the owner's (a rule variant, a default, a name).
  Otherwise pick the sensible option and say which one you picked.
- Keep the game's rules exactly like the original game when it copies one
  (Wordle, Lingo, Chain Reaction): check the rules against the original and
  say what differs.

## The package.json

- `author` is the maker's first name only: `Phil`, `Nicole`, `Ian`,
  `Mackenzie` or `Mason`. Never a username or a full name.
- `name` and `game.title` are the final name. Avoid words already used by
  many games ("pop").
- `game.changes` gets a line for each change a player would notice
  ([whats-new.md](whats-new.md)).

## Making the next game easier

When something in the template or its docs slowed you down, fix it in
`dg-template` (the template first, then `npm run kit:sync` in games):

- Write **general guidance**, not a history: no "Wordle did X", no story of
  how a problem came up. Point to reference code or images where they help.
- Put each fact in the doc it belongs to and link to it from the docs that
  need it, so no doc grows too long ([README.md](README.md)).
- Add a dated entry to `docs/plans/kit-retros.md` (template only).
