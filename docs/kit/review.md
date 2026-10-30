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
  (`npm run local`, or a built bundle: `npm run build` then `vite preview --host`) and give two URLs: the
  machine's LAN address (`http://192.168.x.x:<port>/<slug>/`) and its Tailscale
  IP (`http://100.100.4.74:<port>/<slug>/`; not the ts.net name, which Vite's
  host check blocks). A server bound to
  `127.0.0.1` can't be reached from the phone: bind to all addresses or put a
  forwarder in front. Always serve the game under `/<slug>/` (the template's
  `vite.config.ts` does it for `npm run dev`): the hub client reads the slug
  from the address, and at `/` it has none, so the autosave fails (older kits
  froze the game a few seconds in). Stop the server when the owner is done
  (`npm run clean:procs`).
- **Tell the owner when it's ready** with the notify tool: when screenshots
  are ready for review, when a test link is up, when a deploy is live. Say
  what to look at.
- When a fix is asked for, check it on the screen where it was seen (a phone
  shot for a phone bug) before saying it's done.

## Previews and labs

- **Phone links serve a built bundle, never `npm run dev`.** Vite's dev client reloads the page
  when its socket comes back, and a phone drops the socket whenever the page goes to the
  background, so the player comes back to a reload (and, with no hub, to the title with no
  Continue). It also reloads on every file another agent saves. `npm run local` (a real hub on a
  build) is the default; a plain `vite preview` of `dist/` is next.
- **Labs and preview pages are live.** A page the owner opens to judge a piece (a character, a
  level, a tool) plays it: controls, a restart, the bot driving it. A freeze-frame of one moment
  hides how it moves and feels; take stills from the same page with a query (`&t=<s>&snap=1`).
- **Heavy generation runs in a Web Worker.** Anything that takes more than a frame (a level, a
  puzzle, a long simulation) is built off the main thread, kept per seed (memory and IndexedDB,
  keyed by a fingerprint of the generator so a changed generator never serves an old result),
  and, for the ones players open first, prebuilt into `public/` with a script. Start building
  the next likely one early (today's daily as the game opens, the next level after a clear), and
  show a loading card only when it isn't ready. The rules take the built thing as an argument and
  wait for it, so the saved game holds the seed, never the result.

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
