---
name: new-game
description: Create a new diffenderfer-games game from dg-template given a game idea. Use when asked to "make a game", "copy/clone dg-template", or given a game idea to build.
argument-hint: <game idea>
---

# New game from dg-template

Game idea: $ARGUMENTS

Treat the idea as the brief. Fill in anything it leaves out with these defaults; the idea always wins.

1. **Ask first**: before any other work, check whether the idea answers each of these. Ask everything it leaves open in one AskUserQuestion call (send a PushNotification too), offering your recommended answer first in each:
   - **Online play**: how should it work? Live/realtime, turn-based in a room, race to completion, co-op, or none (see the mode list in step 6).
   - **Visual reference**: which existing game(s) should I study for the look, and for what? For example the UI and menus, character drawing, animations, particles. Suggest the closest matches you know of; different games can cover different aspects.
   - **Daily challenge**: how should the daily work? Offer 2–3 concrete designs that fit the idea (a seeded puzzle, a short timed run, a fixed starting position…), or none if the game doesn't suit one.

   Skip anything the idea already answers, and skip the call entirely if it answers all three. Use the answers as part of the brief in every later step. Start setup (step 2) while you wait.
2. **Setup**: pull latest dg-template from origin and create the game with its `npm run create` (short kebab-case slug). Every dg-template doc (CLAUDE.md, HANDOFF.md, README.md, docs/*) applies and must be followed, including repo setup, but **don't read them into your own context**: send a subagent to read them all and return a brief of 10–15k tokens at most, covering:
   - the hard rules;
   - the hooks and APIs this kind of game uses, with file paths;
   - what look.md, polish.md, devices.md and covers.md demand;
   - the commands to run;
   - the closest existing game to copy patterns from, and which of its files to open;
   - for each visual reference game from step 1, the files that hold the chosen aspects (UI, character drawing, animation, particles…).

   Tell it which features the game has, so it skips docs for features it doesn't (for example the live and online docs for a solo game). Afterwards, open only the specific files you need, and grep or read ranges rather than whole files. When a command's output spills to a file, grep that file; never Read all of it.
3. **Plan**: write `docs/plans/<slug>.md` covering rules, modes, difficulty, online design, procedural systems, daily challenge, controls per device, visual style (naming the reference games and what each one is the reference for), age range, and cover concept. Then build it. Beyond step 1, don't stop to ask unless the idea is truly ambiguous.
   - **Risky idea?** (new tech, unproven fun, heavy 3D/realtime, big content needs) Plan a series of POCs, each validated with me before building on it.
   - **Remakes of a classic** (Space Invaders, Tetris…): keep the rules, but never copy the original's look (no pixel-grid sprites). Everything is drawn: procedurally generated vector art, animated part by part.
   - **Style frame first**: before writing the full renderer, render one close-up of the main characters and pieces in the planned style. Send it with a PushNotification. Keep building the rules while you wait, but don't build the whole renderer on an unseen look.
4. **Fun first**: wildly fun and over the top, especially for simple games. Juicy, bright, well-animated visuals, particles, satisfying feedback. Menus, modals, and buttons as stylish as the best existing games (e.g. lingo), or the visual reference games from step 1.
5. **Every device**: gamepad, touch (phones and tablets), and desktop (mouse and keyboard) must all be supported wherever possible, following devices.md. Design the controls for all three from the start, not as an afterthought, and test each one. If a device truly can't work for this game, say why in the plan.
6. **Procedural everything**: push hard on procedural generation for whatever applies: levels, puzzles, art, characters, animation, music, sound. Everything comes from a seed. That's what powers daily challenges and replay value.
7. **Modes** (defaults when step 1 left them open):
   - Solo vs computer with multiple difficulty levels.
   - Daily challenge: a seeded run that's the same for everyone and takes just a few minutes. If playing a game to completion takes over 10 minutes, design a quicker daily version (like the shortened dailies of the longer card games). If it takes over an hour of play, the game may not suit dailies; say so in the plan.
   - Online play when it suits the game. Pick one or more:
     - **Race**: everyone solves the same puzzle, first to finish wins (a native diffenderfer-games mode, not car racing).
     - **Co-op**: less common, use when the game naturally fits.
     - **Room-based**: shared game in a room (turn-based, 2–4 players or whatever fits).
     - **Realtime**: live simulation (actual racing, FPS, etc.).
   - **Avatars**: work the players' hub avatars into the game wherever they fit (player pieces, characters, opponents, scoreboards, celebrations).
8. **Bulk work goes through a pipeline**: when lots of similar things need making (e.g. tons of 3D models), build an agent-based pipeline. Run it on a small batch, refine it over a few passes, and report the time, cost and quality. Only then do the full run.
9. **Audience**: set the age range in package.json. If the idea names an age (e.g. a 4-year-old), design controls, text, and difficulty for it.
10. **Cover**: a really good cover using the template's cover script and sizes.
11. **Review**: run it bound to the LAN and give both playtest links:
    - `http://192.168.50.112:<port>` (local Wi-Fi)
    - `http://100.100.4.74:<port>` (Tailscale IP; never the ts.net name, which Vite blocks)

    Include in-game screenshots and the cover. Save a project memory pointing to the plan doc.
12. **Work cheaply** (every turn re-reads the whole context, so context size is the main cost):
    - Write each file once, completely, with Write. Don't heredoc several files in one shell command: quotes and backticks break it.
    - Batch each fix round into one step: edit, check and screenshot together, then look. Avoid look-one-line-then-fix turns.
    - Inspect art close up with a zoom driver and look at the contact sheet; don't re-read single shots you already checked.
    - Hand side work (a review, a cost or log analysis, long waits) to background subagents.
    - Once the game is built and verified (checks pass, shots look right), bring `docs/game.md` and the plan up to date as the handoff. Then send a PushNotification asking me to run `/compact` before review fixes, deploy and the trailer.
13. **Notify**: ANY time my input is needed, send a PushNotification. Never just wait silently. Ignore its result: it sometimes reports failure when the notification actually went through, so don't retry or report it as failed. This includes:
    - the up-front questions from step 1,
    - the game and cover are ready for review (also after each POC or pipeline pass),
    - there are questions, decisions or blocking issues,
    - it's approved and deployed,
    - asking about the trailer.

    Don't push or deploy until I approve.
14. **Trailer**: once it's deployed, ask whether to make a trailer. If yes, follow rift-racers `docs/plans/promo-video.md`: film the real game, build a clip gallery for review, make cards in the game's look, add music, then cut a main promo and 16:9/9:16 shorts.
