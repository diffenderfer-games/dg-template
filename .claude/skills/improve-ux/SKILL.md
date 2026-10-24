---
name: improve-ux
description: Give a diffenderfer-games game its own themed UI, the way Dome Dash, Crossfire and Rift Racers have one, instead of the shared stock look. Use when asked to "improve the UX/UI", "give <game> a unique look", "theme the menus", or "make it look less generic".
argument-hint: <game slug> [theme direction]
---

# A unique themed UI for a game

Target: $ARGUMENTS (first word is the game's repo/slug under `C:\Users\pdiff\Documents\GitHub`; anything after it is a theme direction, and it always wins).

The goal: the game's menus, modals, HUD and kit screens look like they were made for **this** game's world, not the shared look every older game wears. Dome Dash, Crossfire and Rift Racers are the bar; Tetrablox is the stock look to move away from.

1. **Learn the bar** (subagent, not your own context): send one Explore/general-purpose subagent to study the references and return a brief of 5–8k tokens at most. It should open screenshots or run the games if needed, and read ranges, not whole 2,000-line CSS files.
   - **Dome Dash**, *carnival marquee / toy box*: `dome-dash/docs/plans/dome-dash.md` § Visual style; `src/game/theme.css`, `src/game/screens/style.ts` (icon-tile buttons, glass card, stagger-in), `src/game/screens/dress.ts` (dressing the kit's own modals), `title.ts`, `hud.ts`.
   - **Crossfire**, *The Forge*: `crossfire/docs/plans/crossfire.md` § Visual style; `src/game/theme.css` (its header comment names the look: chamfered iron plates, rivets, molten seams, hazard stripes), `src/game/screens/style.ts`, `title.ts`, `hud.ts`.
   - **Rift Racers**, *cockpit console*: `rift-racers/src/game/theme.css`, `src/game/ui/screens.css`, `ui/console.css` (button prompts, axis rows), `ui/setup-screen.ts`, `ui/garage-screen.ts`, `ui/race-hud.ts`.
   - **Tetrablox**, the stock look (`tetrablox/index.html`, a single-file game) as the contrast: what it does that the others avoid.
   - The rules every theme still obeys: `dg-template/docs/kit/look.md` (esp. §8 "Dressing the kit's screens" and §9 "Checking it"), `docs/kit/ui.md` § Theming, `docs/kit/devices.md`.

   Ask the brief to cover, per reference: the **metaphor** (what real-world thing the UI is made of), shape language, materials and surface tricks (rims, rivets, bulbs, glass, stripes), type, colour roles (lead, numbers, focus), motion (entrances, idle, feedback), signature ornaments, how it dresses the kit's screens (which selectors, which hooks), and how it keeps the hub corners, focus rings, touch targets and pad prompts working. End with a short "what makes a theme feel unique vs stock" list.

2. **Learn the target**: read the target's `docs/plans/<slug>.md` and `docs/game.md` (the visual style, world, characters, colours, audience) and its project memory if one exists. Find its current theme.css / screens / HUD files and screenshot its title, pause, result and one modal for the pitch (step 4 shoots the full **before** set). Old single-file games (like tetrablox) may need their UI pulled into the current kit's structure first; if so, say so and size it before starting.

3. **Pitch three looks**: from the game's own world (never a reskin of a reference), write three distinct concepts. Each one: a name ("The Forge"-style), the metaphor, materials, shape language, type, palette with roles, motion, two or three signature ornaments, and how the HUD fits it. For each, render one quick **style frame**: the title screen mocked as a static HTML page, screenshotted at phone portrait and desktop. Show them with Read, then ask which one (AskUserQuestion, your recommendation first) and send a PushNotification. If the argument already named a direction, pitch three takes on it.

4. **Inventory first**: before styling, list **every** modal, button and control the player can ever see. Grep the game's `src/` and the kit's `src/kit/ui` for what they build (`kit-btn`, `kit-modal`, toggles, sliders, steppers, selects, tabs, segmented pickers, chips, text inputs, checkboxes, close/back buttons, key and pad prompts, toasts, tooltips and popovers, and the game's own HUD buttons and touch controls). Walk the game too: open every modal and every settings page, and every state of each control (default, hover, pressed, focused, selected, disabled, on/off). Screenshot each one as it is now: that's the **before** set. Save the list as a checklist in the plan doc. Nothing on it may keep the stock look.

5. **Build it**, on everything in the inventory, not just the title:
   - A `theme.css` (or the game's equivalent) that opens with a header comment naming the look and its rules, like Crossfire's. Set the kit tokens (`--kit-bg`, `--kit-panel`, `--kit-accent`…) first, then the game's own prefixed classes (`xx-`).
   - Every screen and kit piece: title, setup/who-to-play-with, settings, how to play, confirms, sharing, the online menu, pause, result, toasts, the loading screen, the pause button, and the HUD. Every control type gets a themed version of every state, and every modal gets the themed frame, heading and buttons. Dress the kit's own screens the supported way (look.md §8, a `dress.ts`-style watcher), never by forking kit files.
   - Motion: entrances, staggered buttons, idle life (chasing bulbs, embers, scanlines…), press/focus feedback, score pops. Keep `prefers-reduced-motion` honoured.
   - Keep what the kit guarantees: hub corners (top-right, both bottom) ~72px clear, visible focus for pad and keyboard, touch targets, pad/key prompts, labels and popovers that grow to fit their text (ellipsis only as a last resort), safe areas. Fonts are self-hosted.
   - **The cover follows the new look**: rebuild it with the game's cover script and sizes (`docs/kit/covers.md`), so its title lettering, fonts, palette, frames and ornaments match the new UI. The game's other fonts and wordmarks (the loading screen, share images, the in-game title) change with it. Compare the new cover side by side with a dozen other games' covers so it still stands out, and keep the hub corners clear.

6. **Check it**: run the game's typecheck, lint and tests per its CLAUDE.md. Screenshot every screen and every modal on the inventory at phone portrait, phone landscape, tablet and desktop, plus each control type in each of its states (a pad focus ring included). Tick off the inventory as you go: anything still stock is a failure, not a nice-to-have. Build one contact sheet with **before vs after** side by side and look at it (Read). Fix in batched rounds: edit, check, re-shoot, then look.

7. **Hand off**: update the plan's Visual style section with the UI look (name, metaphor, rules, files), and the project memory. Run it bound to the LAN and give both links: `http://192.168.50.112:<port>` and `http://gandalf.tail9e7055.ts.net:<port>`. Show the contact sheet and the old vs new cover. Commit locally; **don't push or deploy until I approve** (check `origin..HEAD` before any push).

**Notify**: send a PushNotification any time my input is needed (the three pitches, the review, blockers). Ignore its result; don't retry it.

**Work cheaply**: references go through the subagent brief, not your context. Write each file once with Write. Grep or read ranges of big CSS files. Don't re-read screenshots you already checked.
