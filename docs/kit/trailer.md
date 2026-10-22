# Trailers

KIT doc. How to make a promo trailer for a game when the owner asks for one: film the real game frame by frame,
let the owner pick the clips, then cut them to the game's own music with title cards in the game's look. The
pipeline exists today in **Rift Racers** (`../rift-racers`: `scripts/film/`, `src/game/film/`,
`docs/plans/promo-video.md`); it is the reference for every step below. Read that plan before you start.

The finished Rift Racers trailer: a 74.5 s main cut and a 21.6 s short in 16:9 and 9:16, each a 4K60 master with a
1080p copy, from 28 clips the owner picked out of 131 candidates.

## The shape of the work

| # | Step | Who | Output |
|---|---|---|---|
| 0 | [Proof of concept](#0-proof-of-concept): film the real game, frame by frame, into an mp4 | agent | a 15 s test video, a contact sheet |
| 1 | [Plan and on-screen words](#1-the-plan-and-the-words) | agent, then **owner** | `docs/plans/promo-video.md`, the owner's decisions |
| 2 | [Film driver and cameras](#2-the-film-driver-and-cameras) in the game (dev only) | agent | `__game.extra.film(plan)`, a test strip per camera |
| 3 | [Find moments, render proxies](#3-moments-and-proxies) | agent (machine time) | `candidates.json`, ~100+ small clips |
| A | [**Review A: the owner picks the clips**](#review-a-the-owner-picks-the-clips) in a gallery | **owner** | `picks.json` |
| 4 | [Cards](#4-cards) in the game's look; **Review B** from stills | agent, **owner** | `cards/<id>.webm` |
| 5 | [Final masters](#5-the-final-masters): the picks again at 4K, slow-motion takes, 9:16 | machine time | `final4k/*.mp4` |
| 6 | [Sound](#6-sound): the game's song from a bar, each clip's own effects | agent | in the cut |
| 7 | [The cut](#7-the-cut): main, short, vertical short, 1080p copies | agent | `cut/*.mp4` |
| C | [**Review C: the finished videos**](#review-c-the-finished-videos) | **owner** | approval or fixes |
| 8 | [Thumbnail, title, description, clean-up](#8-after-review-c) | agent | `thumbnail.jpg`, text to paste |

### The owner's gates

Stop and wait at each one; tell the owner with the notify tool what's ready and what to look at.

| Gate | Send | The owner gives back |
|---|---|---|
| Proof of concept | The test video, a contact sheet, what the full job would take | Go / no go |
| Plan | The plan file: formats, shot list, the numbered on-screen transcript, numbered questions | Answers by number; edits to the words |
| **A: clips** | The gallery's LAN link and folder, the per-world camera strips | `picks.json` (Download) and notes per shot |
| B: cards | Card stills over draft footage (`-over.jpg`), a 9:16 example | Changes to words or looks (often none) |
| Before the finals | The picks read back (count, seconds), 1080p vs 4K with the render time of each | The size |
| **C: finals** | < 30 MB copies of every cut, where the masters are, contact sheets, what didn't come out right | Fixes, or approval |

Every step is an `npm run film:*` script, so a re-run is one command. Outputs go **outside the repo** (`--out=`, or
`FILM_OUT`; the session's scratchpad is fine): they run to gigabytes.

## What a game needs before it can be filmed

The pipeline films the game itself (its renderer, effects and HUD), never a screen recording. That works only if
the same inputs give the same pictures, frame for frame:

- **A deterministic sim on a fixed step.** Rules or a live sim that are pure and seeded ([rng.md](rng.md),
  [live.md](live.md)), and a scene the computer can play on its own (autopilot on every seat, a bot, a scripted
  solve). A query string then decides everything: render it twice and you get the same video.
- **Nothing on wall time.** The film replaces `performance.now`, `Date.now` and `requestAnimationFrame` before the
  page loads and steps them 1/60 s per frame. Particles, weather, shaders and UI animations must read those (CSS
  animations are held at the film's time by the clock too). Anything on `setTimeout` runs on real time and will
  drift: keep it off the picture.
- **A loop with slack.** A fixed-step loop that steps when its sum reaches a step must allow a hair of float error
  (`acc >= STEP - 1e-9`); the film clock also adds a billionth to each frame (below).
- **A dev-only film driver** on the test hook ([test-hook.md](test-hook.md)): drivers exist only in dev, on
  localhost and under `__HUB_TEST__`, so nothing reaches players.
- **A headless twin** of the filmed scene in Node (the sim stepped with the same inputs and hooks as the page), so
  the moment finder can play hundreds of games in seconds and know the page will show the same ones.
- **Music and sound you can render offline** (optional but worth it): a music core that runs in Node
  ([audio.md](audio.md): music in a worker means its core has no Web Audio inside) and a one-shot synth.

A game with none of this can still get a trailer, but only from screen recordings: say so to the owner and plan it
differently.

## 0. Proof of concept

Before planning anything, prove the risky part in an hour or two: film one real scene frame by frame and encode it.

- Puppeteer (`puppeteer-core` with the kit's Chrome, `scripts/kit/lib/paths.ts`) on the game's Vite dev server,
  headless with the GPU (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --mute-audio`).
- The fixed clock (`fixedClock` in `scripts/film/lib.ts`): `evaluateOnNewDocument` before the page's scripts;
  `__filmStep(rate)` moves the clock one frame (`rate` < 1 is slow motion), runs the frame callbacks, and holds every
  CSS animation at the film's time since it was first seen.
- Capture with CDP `Page.captureScreenshot` (PNG for finals, JPEG q92 for proxies; JPEG is ~1.6× faster; canvas
  `toBlob` is no faster and raw `readPixels` is the slowest). Pipe each frame into ffmpeg (`image2pipe`, libx264,
  yuv420p, `+faststart`). ffmpeg is the `ffmpeg-static` dev dependency (`scripts/film/ffmpeg.ts`, or `FFMPEG=`).
- Check: two renders of a clip match pixel for pixel; the sim ticks fall evenly (Rift Racers: a 30 Hz sim, exactly
  two frames a tick); the motion per frame is even.
- Show the owner the test video and a contact sheet (`film:strip`) and say what the full plan would take.

## 1. The plan and the words

Draft the plan **and every word that will be on screen** before building or rendering anything, and wait for the
owner. Write it to a file the owner can read (the scratchpad), then copy it into the game as
`docs/plans/promo-video.md` and keep it current (status table, findings, how to re-run each step).

What the plan holds:

1. **Formats.** The main cut (60–90 s, 16:9), a short (15–25 s) in 16:9 and **9:16 rendered upright**, not cropped
   (a game that widens its view on tall screens films tall natively). Where it will be posted decides the safe
   areas: on 9:16 keep text in the middle third (the apps' buttons cover the bottom ~20% and right ~15%).
2. **A shot list timed to the music**: one row per shot with its time, length in bars, the world or level, the
   camera, slow motion, what happens, the text over it, the transition out and the song's section. Pick the song
   first and time everything in its bars (Rift Racers: Neon at 128 bpm, a bar 1.875 s, a beat 28.125 frames).
3. **The on-screen transcript**, numbered card by card, with alternatives where you're unsure.
4. **Music and sound effects**: which song, from which bar, at which intensity; effects or none.
5. **The capture plan**: which seeds, levels and weather to search, the hooks you need (start before a feature,
   hand out a power-up on cue), the cameras.
6. **Steps, effort and the review gates** (A, B, C below), and a render-time budget.
7. **Numbered open questions** for the owner.

**Number everything** so the owner can answer by number ("3–17: no subtext, just the uppercase words"). Record the
answers in the plan as an "Owner decisions" section that **overrides everything above it**, and keep the words in
a data file (`scripts/film/transcript.json`), never in code.

What the owner decided last time, as a starting point (ask again; don't assume):

| Question | Answer |
|---|---|
| Voice-over? | Text only, with the game's music |
| Music | One of the game's own songs throughout, cut on its beats |
| Sound effects | Yes, quiet: well under the music |
| Fewer words | World or mode names only, uppercase, no subtext lines; keep a line only where it says something new ("A new track every day") |
| Counts ("8 worlds, 12 power-ups") | Never: they change. No dated "launch" cut |
| Tagline | The cover's subtitle ([covers.md](covers.md)) |
| End card | The wordmark, **Play free at diffenderfer.games**, **any device** (no keyboard/gamepad/touch icons) |
| Where | YouTube, 1080p60 planned; at the final render the owner chose **4K masters** ("YouTube can produce lower quality") |
| Length | ~60–75 s main; ~20 s short |
| Variety | A ship (character, skin) that suits each world in that world's shots, no per-item segment |
| Look | The game's look, but soften what over-blooms at 2× (`bloom=0.55`) |
| Online shot | A computer game with made-up names in the tags is fine |

On-screen words follow the game's rules: no violent words ("zap", not "shoot"), never "run" or "turn game".

## 2. The film driver and cameras

In the game, behind the test hook, all dev only (Rift Racers: `src/game/film/`, `src/game/race/film-camera.ts`,
`src/game/test-hook.ts`):

- **A film plan is a query string** (`film/plan.ts`, pure, read by the page and by Node): the scene
  (`theme seed length laps bots level ship weather`, or `trial=<id>`), hooks that steer it the same way every time,
  and the shot. Rift Racers' keys:

  | Key | Does |
  |---|---|
  | `at=<feature>&nth=<k>&lead=<m>` | Start the grid `lead` m before the k-th loop / corkscrew / jump / tunnel / split / water / ground / spiral |
  | `item=<seat>:<id>@<s>` | Hand a ship a power-up at sim time `s` |
  | `use=<seat>@<s>` | Your ship presses use then |
  | `fork=<seat>:branch\|main` | Which side of every split |
  | `late=<s>`, `trial=<id>&ghost=<pace>&slip=<s>` | A time trial against a ghost of the computer's line that eases off, so the split goes from pink to green |
  | `focus=<seat>` | The ship the camera follows |
  | `cam=` | `chase side orbit lead drone cockpit lock ghost gantry finish` |
  | `tags=1`, `hud=1`, `bloom=<k>` | Name tags with made-up names, the HUD on, the bloom's strength |
  | `from=<s>` | When filming starts (trackside cameras are placed from then) |

- **`__game.extra.film(plan)`** puts the plan where the game reads it (`film/active.ts`: `filming()` is null for
  every player) and starts a new game. The game's `filming()` checks: autopilot on every seat, the hooks each tick,
  the film camera, name tags all game, **no results screen** over the finish. With no plan, nothing changes.
- **`__game.extra.filmProbe()`** returns `{ tick, phase, ships }` (null until the scene is up): the render steps
  frames until `tick` reaches `from`, and logs each frame's tick to check the pacing.
- **`document.body.dataset.ready = '1'`** once the game has booted.
- **The headless twin** (`film/race.ts`, `FilmRace`): the same state, inputs and hooks, stepped in Node. The page's
  per-seat computer input moved into a shared function so both use the very same code. `film:moments -- --verify=<clip.json>`
  checks a rendered clip against it (Rift Racers: 0.0000 m apart).
- **Cameras** (`film-camera.ts`) are placed from the scene's state each frame, so a clip filmed again from another
  camera is the same moment. Trackside and high cameras cast rays to where the subject will pass, against the
  solid meshes (land, cave walls, props), and try farther, higher or the other side until they see it; moving ones
  re-check every 6 frames. Distances are per world (`WORLD`: caves and the sea floor fly the drone lower).
- **Test strips**: one `film:strip` sheet per world, one row per camera; look at each before going on (thin props
  and drone shots inside loops were the rough edges).
- The film's dev server has **no live reload** (`hmr: false, watch: null`): an edit while a batch films would reload
  the page mid-clip.

## 3. Moments and proxies

`npm run film:moments` plays every planned shot's games headless and finds the moments each shot wants. It reads
`scripts/film/shots.ts`, the planned shots:

```ts
{ id: '04-canyon', title: 'Canyon: the open canyon, river spray, sand and dust, a ravine jump',
  text: 'AMAZING WORLDS · CANYON', worlds: ['canyon'], kinds: ['ground', 'jump', 'open'],
  avoid: ['tunnel'], cams: ['chase', 'side', 'lead'], keep: 6 }
```

- `kinds` (what the camera's subject is doing: loop, jump, tunnel, split, water, pack, finish …), or `item` (a
  power-up that must be seen to land), or `fixed` (clips planned by hand: the logo's gantry shot), `cams` (1–3 to
  try), `avoid` (kinds the clip must not go into), `keep` (candidates to keep, default 3), `extra` (plan keys for
  every candidate: `tags=1`).
- Per tick per ship it notes what it's on, how many ships are within 50 m and the events (power-up used, hit, swap,
  portal, overtake, finish). Each run of a kind is scored (how rare and showy, the pack near, events near, a little
  extra for the hero seat), and the best few kept: no two of one moment, at most two of a kind from one game, spread
  over the kinds the shot asks for. Power-up shots also hand the hero the item on cue and keep it only when the game
  shows it land. ~25 games in ~20 s.
- Writes `candidates.json` (each a plan + `from` + `secs` + why) and `gallery-clips.json` (each candidate from each
  of its cameras). Clip names are `<shot>__<letter>-<cam>` (`04-canyon__c-chase`).
- `--only=<shot>,…` for some shots; **`--add`** for more candidates beside the existing ones, lettered on after them
  (so rendered clips and picks keep their names), the new ones alone in `gallery-clips-new.json`; `--print`.

Then the proxies:

```bash
npm run film:render -- --batch=<out>/gallery-clips.json --proxy --out=<out>
```

960×540, picture quality Fast, JPEG capture, a quick encode: ~3.5 s of rendering a second of video plus the run-up
and ~5 s to load. Each clip also writes `<name>.jpg` (its middle frame: the gallery's poster) and `<name>.json`
(plan, size, render time, ticks per frame, the last probe). Run **two renders at once** (~1.7× the frames): both
skip clips already done, and part files are per process. Rift Racers: 83 candidates for 30 shots, 131 clips, ~61 min.

## Review A: the owner picks the clips

The step the owner cares most about. `film:gallery` turns the candidates into one page:

```bash
npm run film:gallery -- --out=<out>              # writes <out>/index.html and serves the folder on the LAN
npm run film:gallery -- --out=<out> --no-serve   # the file only
```

**What the owner sees** (`index.html`): a sticky bar ("pick the clips", the count picked, **Save picks**,
**Download picks.json**, when it last saved) and a short intro; then one section per planned shot in plan order,
headed by its number, its title and **the words that will be on screen over it**. Under each, a grid of its
candidate clips (one card per candidate per camera): the poster frame, the video **playing on hover** (a tap on a
phone), what it is (`c · chase`, the world, the start and length, why the finder chose it), and a **Pick** box.
Ticking numbers the picks in the order ticked (the number shows big on the card, which glows); unticking takes it
out. Under each shot a **note box**: "missing a moment, or want something else here?". A clip still rendering shows
"still rendering": the gallery can go out before the last proxies are done, and a refresh fills them in.

**How picks are kept**: every change is saved in the browser (`localStorage`) and, 0.6 s later, POSTed to the
gallery server, which writes `<out>/picks.json` and `<out>/picks-clips.json`. Opened from the file, the
**Download** button saves `picks.json` instead (the owner downloaded it: `Downloads\picks.json`). Reopening the
served page restores the picks from the server.

**The format** (`picks.json`):

```json
{
  "picks": [
    { "order": 1, "name": "01-open__b-chase", "shot": "01-open",
      "plan": "theme=neon&seed=7&length=long&laps=1&bots=7&level=hard&ship=needle&focus=4&cam=chase",
      "from": 15.23, "secs": 5 }
  ],
  "notes": { "04-canyon": "…" }
}
```

Each pick carries its whole recipe (the plan, the moment, the length), so the final render films exactly the
picked game, only better. `picks-clips.json` is the `picks` list sorted by `order`, the list `film:render --picks=`
reads (it ignores the extra keys). When the owner sends a downloaded file, copy it into the gallery folder and
convert it:

```bash
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('picks.json'));fs.writeFileSync('picks-clips.json',JSON.stringify([...j.picks].sort((a,b)=>a.order-b.order),null,1))"
```

(When porting, make this a `film:picks` script, or let `film:render` read `picks.json` as it is.)

**Sending it**: serve it on the LAN and give the owner the LAN link (`http://192.168.x.x:<port>/`, the gallery
prints it) plus the folder path, with the notify tool. Send the per-world camera strips with it. Say what to do:
watch, tick in order, a note under any shot that's missing something, then Download (or just tell you it's saved).

**Iterating on notes** is normal. Rift Racers: the owner said the Canyon candidates were "a dark boring cave" with
none of the open canyon. The fix, in the finder rather than by hand: Canyon searched in clear weather only; shot 04
looks for open ground, jumps and the open road (`kinds: ['ground', 'jump', 'open']`); `avoid: ['tunnel']` (a tunnel
only before the moment, as an exit into daylight, the clip ending before the next); candidates spread over the
kinds; then `film:moments -- --only=04-canyon,14-jumps --add`, render `gallery-clips-new.json`, refresh the gallery,
check the new posters yourself (a contact sheet) and tell the owner which letters are new (04 d–i). About 20 min.
Write each note and what you did about it into the plan.

When the picks come in, read the notes, list the picks back (count, total seconds), and **ask before the final
render**: 1080p or 4K, with a time estimate for each.

## 4. Cards

The words are HTML/CSS cards in the game's own look, filmed through the same fixed clock on a see-through page and
laid over the footage in the cut, so changing a word never re-renders any 3D.

- `scripts/film/card-page/` (`index.html`, `card.ts`, `card.css`) is served by the game's dev server, so it imports
  the game's own CSS, fonts and icons. `?id=<card>` (`&v=1`: the 9:16 layout; `&hold=1`: stop once in, for stills).
  It sets `body.dataset.ready = '1'` when drawn.
- `scripts/film/transcript.json`: one card each, `{ id, template, title?, line?, small?, tagline?, pills?, item?,
  accent?, secs }`. Templates: `logo` (the wordmark slams in, a flash, the tagline rises), `header` (a slab slides
  in, letters stagger), `world` (the name, big, tinted with the world's colour), `stamp` (a chip slammed down),
  `item` (the HUD's power-up card, big), `mode` (a title, a line, pills), `end`. Sizes in units of 1% of the frame's
  short side, so 1080p, 4K and 9:16 all fit.
- `npm run film:cards` renders every card to `<out>/cards/<id>.webm`: **VP9 with alpha** (`libvpx-vp9`,
  `yuva420p`, CRF 14), 2–5 MB each. `--v` for `cards-v/`, `--4k`, `--only=`.
- **Review B** (stills): `npm run film:cards -- --stills [--at=1.8] --bg=<a draft frame>` writes `<id>.png` and
  `<id>-over.jpg` (the card over that frame). Send the owner a dozen `-over.jpg` (logo, a header, a world, a stamp,
  an item, each mode, the end card), a 9:16 example, and offer a 10 s animated sample. It can run at the same time
  as Review A. Last time the owner had no card notes; the end card's "any device" was made a little larger and
  bolder.

## 5. The final masters

```bash
npm run film:render -- --picks=<gallery>/picks-clips.json --4k --supersample --out=<final4k>
```

- **Prove 4K on one clip first** and look at it: a 1:1 crop, and the proxy beside it at the same moment. A plain CDP
  screenshot comes back at the page's CSS size whatever its pixel ratio; `grab` clips the capture at `scale` =
  output width / page width, which gives a true 3840×2160 frame. Check the pacing too (two frames per tick
  throughout).
- **Sizes**: `--4k` alone draws a 1920×1080 page at 2× and captures it at 4K, pixel for pixel. `--supersample` draws
  the page at 3840×2160 at 2× (8K) and scales down: smoother rain and edges. **Clips with HUD or name tags stay
  native 4K** (`hud=1`/`tags=1`): they're sized in CSS px and would come out half size on an 8K page. `--v` swaps to
  2160×3840. `--width --height --fps --dpr --view=WxH` set them outright.
- **Quality**: Best (`q=high`, DPR 2), PNG capture, libx264 `slow` at **CRF 12** (16 at 1080p). The run-up to the
  moment is drawn on a 480 px page and grown back 1.5 s before `from`, so effects that started on the way have
  settled.
- **Handles**: `--picks` adds 1 s each side (`--handle=`), room to trim and slide in the cut. A cut's `in` is
  measured from the clip's start, handle included.
- **Slow motion** is rendered, not stretched: a batch entry's `warp` (`"0:1,30:1,48:0.25"`: from output frame 30
  the clock eases to a quarter speed by frame 48) steps the clock by `rate` × 1/60 s, so particles and weather slow
  too. Write the slow takes as their own batch (`<name>-slow`, the pick's plan, its own `from` and `secs`) and
  render with `--batch=`. Last time: the waterfall at 0.25, the ravine jump and the finish at 0.4.
- **The 9:16 short** is its own renders: for each shot in the short's cut, the pick's plan as `<name>-v`, `from` 1 s
  early and only as long as the short uses (`in + bars × bar + 0.3`), rendered with `--4k --v --supersample
  --batch=`.
- **Two renders at once**: split the list in half and give the second half reversed, so they meet in the middle; each
  skips what the other finished.
- **Safety nets** in `render.ts`: a clip that draws no frame for 150 s gets a fresh browser and one more try; the
  WebGL context is checked every 30 frames (a GPU out of memory blanks the picture **silently**) and the clip tried
  again; it stops before starting a clip with under 3 GB free (`--min-free-gb`); a clip is written as a per-process
  `.part.mp4` and renamed only when whole. Run it again to go on: done clips are skipped (`--force` to redo).
- **Smoke-test the cut on the proxies** while the masters render (copy the picked proxies under the final names): it
  catches cut-file mistakes hours earlier.
- After the batch, check every clip: a `film:strip` sheet, and each clip's brightness (a blank white clip has no
  error).

Times on an RTX 3070 Ti laptop:

| Render | Rendering per second of video |
|---|---|
| Proxy, 960×540 Fast JPEG | ~3.5 s |
| 1080p Best, PNG | ~20 s |
| 4K (native or supersampled), PNG | 13–100 s (a bright, busy frame's PNG is the slow end), ~75 average |
| Two at once | ~1.7× the frames between them |

Rift Racers' finals: 28 picks + 3 slow takes + 16 vertical = 44 clips, 255 s of video, 5.3 h of capture, ~5 h of
wall time.

## 6. Sound

- **Music**: the game's own song rendered straight from its music core in Node (`film:music`, `renderSong` in
  `music.ts`: 16 s in 0.7 s). The song is played from its start and kept from a bar (`fromBar`), so it sounds
  exactly as in the game, cut on a downbeat, faded out at the end. Pick the bar from the song's section list (its
  strongest section, so the logo lands on its first downbeat) and render it alone to check (Rift Racers: bar 34 for
  the main cut, 35 for the short, intensity 2: the final lap's).
  `npm run film:music -- --song=neon --from-bar=34 --bars=41 --fade=2 --out=<file.wav>` to listen to it alone.
- **Effects**: while a clip films, the game's sound calls go to a recorder instead of the speakers
  (`film/sound.ts`: each engine-stream message or one-shot with its volume and pan, stamped with the film clock;
  `window.__filmSound()` drains it each frame). `render.ts` writes `<clip>.sound.json`. `stems.ts` plays it back
  offline through the game's own engine core and one-shot synth into a stereo stem.
- **The mix** (in `film:cut`): each shot's stem from its `in`, laid at its slot with 8 ms edges so cuts never click,
  at `sfx` × (0.3: about **14 dB under the music**), the sum kept under full scale. 48 kHz, AAC 320k in the master.

## 7. The cut

```bash
npm run film:cut -- --cut=scripts/film/cuts/main.json --clips=<final4k> --cards=<out>/cards --out=<cut> --export=1080
npm run film:cut -- --cut=scripts/film/cuts/short.json --clips=<final4k> --cards=<out>/cards --out=<cut> --export=1080
npm run film:cut -- --cut=scripts/film/cuts/short.json --v --clips=<final4k> --cards=<out>/cards-v --out=<cut> --export=1080
```

A cut file is the edit decision list:

```json
{
  "name": "rift-racers-promo",
  "music": { "song": "neon", "intensity": 2, "fromBar": 34, "fade": 2.5 },
  "sfx": 0.3,
  "fadeOut": 1,
  "shots": [
    { "clip": "03-logo__a-gantry", "bars": 2, "in": 1.65, "flash": true, "cards": [{ "id": "logo" }] },
    { "clip": "04-canyon__c-chase", "bars": 2, "in": 1.4,
      "cards": [{ "id": "header-worlds", "bars": 1 }, { "id": "world-canyon", "at": 1 }] },
    { "clip": "30-end__b-drone", "bars": 3, "in": 1, "flash": true, "blur": true, "cards": [{ "id": "end", "hold": true }] }
  ]
}
```

| Key | Means |
|---|---|
| `clip` | A rendered clip (`<clips>/<clip>.mp4`; with `--v`, `<clip>-v.mp4`) |
| `bars` | The shot's length in the song's bars (0.5 = 2 beats). Every boundary is on the nearest frame to its beat (≤ 8 ms off) |
| `in` | Seconds into the clip the shot starts (handles included) |
| `flash` | A white flash into the shot (0.22 s) |
| `blur` | A gaussian blur (the end card's background) |
| `cards` | `id` from the transcript; `at` (bars into the shot), `bars` (how long), `hold` (to the end) |

`cut.ts` builds one ffmpeg filter graph (trim, scale, flash, concat; each card decoded with `libvpx-vp9` to keep
its alpha and overlaid at its time; a fade out) and encodes the master at CRF 12 `slow`, then the 1080p copy (CRF
20, AAC 192k). The size follows the clips. Rift Racers' structure: a cold open (2 one-bar shots), the logo on the
start lights' "go", 2 bars per world with its name, 0.75-bar stamps for track features, half-to-0.75-bar power-ups,
2 bars per mode, the finish in slow motion, 3 bars of end card over a blurred drone shot. The short is 10–12 bars:
cold open, logo, half a bar per world, power-ups, online, end card.

Encode times: 11 min (74.5 s main), 3.5 min (16:9 short), 2.5 min (9:16 short). Then:

- **Contact sheets**: `npm run film:strip -- <cut>/<name>-1080.mp4 --every=90 --cols=6 --rows=…` (a frame every
  1.5 s); look at every one with Read.
- **A copy small enough to send** (< 30 MB) from each 1080p copy:
  `ffmpeg -i <name>-1080.mp4 -c:v libx264 -preset slow -b:v 2700k -maxrate 3500k -bufsize 6000k -c:a aac -b:a 128k -movflags +faststart <name>-1080-send.mp4`.

| File (Rift Racers) | Size |
|---|---|
| Main 4K master, 74.5 s | 1.4 GB (1080p copy 176 MB) |
| Short 4K, 21.6 s, 16:9 / 9:16 | 320 MB / 272 MB (1080p 39 / 34 MB, send copies 22 / 23 MB) |

## Review C: the finished videos

Send the owner the < 30 MB copies (they watch on a phone), the paths of the 4K masters and 1080p copies, the
contact sheets, the 4K proof, and an honest list of what didn't come out right. Last time that list was:

- the online shot's pack was spread out, so one name tag showed, and tags read small at 4K (game-UI size): pick a
  moment with the pack together, or bigger tags for the film;
- in the short, 2-beat shots end while the world cards are still sliding in: give the short's cards a faster
  entrance, or 1-bar slots;
- a waterfall shot kept water on the lens after it;
- the cuts assume the song's bar 1 starts at sample 0, not checked by ear;
- what the owner didn't pick, or the footage can't show (a HUD element that needs the hub's day).

The plan also had a rough cut from the proxies before the finals; it wasn't needed (the picks went straight to 4K
and the owner reviewed the finished cuts). Offer one when the edit is uncertain: the proxy smoke test above is
already that cut.

The masters live in a temp folder: tell the owner to copy them somewhere permanent (they went to the owner's Videos
folder). The owner approved this one as it was.

## 8. After Review C

- **Merge the film work** into the game: the scripts and the dev-only hooks change nothing players see. A push is a
  deploy ([review.md](review.md)), so merge, run the checks, and push only when the owner says so (the commits get
  `[skip ci]` unless a deploy is wanted).
- **Thumbnail** (YouTube: 1920×1080, under 2 MB, JPEG): the logo card over a 4K frame from a bright, colourful
  clip. Grab two or three frames (`ffmpeg -ss 2.6 -i <final4k>/<clip>.mp4 -frames:v 1 bg-<clip>.png`), then
  `npm run film:cards -- --stills --4k --only=logo --bg=bg-<clip>.png --out=<thumb>/<clip>` and scale its
  `logo-over.jpg` to 1920×1080. Offer two; say which reads best small (the bright neon one did).
- **Title and description** to paste, from the owner's decisions: what the game is, the modes, the feel of the
  worlds and features in words (no counts), "Play free" with the game's link, "any device", a few hashtags. Flag any
  claim you can't confirm ("no account needed" for online play). Last time's title: "Rift Racers: Official Trailer |
  Free Anti-Gravity Racing".
- **Clean up**: no frame PNGs are kept (frames go straight into the encoder), so the space is the videos. Keep the
  4K clip masters (`final4k/`, 4.9 GB for 47 clips): with them a re-cut (timing, cards, music) takes ~15 min; without
  them it's ~5 h of re-rendering. Everything else (the gallery's proxies 0.5 GB, the cuts 2.3 GB once copied, cards,
  sheets, tests ~0.3 GB) is one command to make again: delete it when the owner has what they want.
- Update the plan's status table and findings.

## Time budget

| Phase | Wall time last time |
|---|---|
| Proof of concept | ~1 h |
| Plan + transcript draft | ~15 min; the owner's answers came back within the hour |
| Film driver, cameras, moment finder, gallery (with ~1 h of proxy rendering) | ~2 h |
| A note round (re-find, re-render a shot's candidates) | ~20 min |
| Owner's picks | the owner's time |
| 4K proof | ~25 min |
| 4K masters, two at once | ~5 h, unattended |
| Cards, music, cut files (while the masters render) | about an hour of agent time |
| The three cuts' encodes | ~17 min |
| Thumbnail, description | ~15 min |

## Pitfalls

- **Disk.** 4K cards as ProRes 4444 (~200 MB each) and then PNG-in-MOV (~1 GB for the logo) filled the disk mid
  render. Use VP9 with alpha for anything with transparency, check free space before starting, keep outputs off the
  repo, and keep the render's under-3-GB guard.
- **GPU memory.** Two 8K pages plus a card render lost WebGL contexts: two clips came out white with no error and
  one page couldn't make a context. Check the context during the render, retry, and check every clip's brightness
  after. Don't render cards while two 8K pages film.
- **Frame pacing.** A loop that steps when its sum reaches a step can skip a tick on float rounding (one frame with
  no tick, then two: a stutter). The film clock adds `1e-9` of a frame; log each frame's tick and check it.
- **CSS px under supersampling.** The HUD and name tags are sized in CSS px: on an 8K page they come out half size.
  Clips that show them render native 4K.
- **A plain CDP screenshot is CSS-sized.** At DPR 2 it still comes back 1920×1080; clip it at scale 2 for 4K.
- **Live reload.** A Vite page that reloads mid-batch films the title screen. Serve with no HMR and no watcher.
- **Name tags read small at 4K**: they're the game's UI size.
- **Short slots.** At 2 beats a card that slides in is still moving at the cut; time card entrances to the slot.
- **Music alignment.** Bar maths assume bar 1 starts at time zero in the song's render; listen to the cut.
- **One clip hung with no error** while another Chrome rendered: the stall watchdog restarts the browser.
- **Tunnels and dark interiors read as nothing** on a world card: the owner wants the place's open, colourful side.
- **Hub-dependent HUD** (a daily chip that needs the hub's day) can't be filmed solo; show the mode with its card.

## Porting it to another game

The scripts live in Rift Racers' `scripts/film/` (GAME files there). Copy them into the new game's
`scripts/film/` and adapt; once a second game uses them, move the reusable half into the template's `scripts/kit/`
with the game-specific parts behind a small config.

| File | Reusable? | What to change |
|---|---|---|
| `lib.ts` | yes | Nothing game-specific except the slug fallback (`'rift-racers'`): the clock, the studio (dev server + GPU Chrome), `grab`, the encoder |
| `ffmpeg.ts`, `strip.ts` | yes | — |
| `render.ts` | mostly | The prefs it seeds (`localStorage 'rift-racers.prefs'`: picture quality), the selectors it hides (`HIDE_CHROME`, `.rr-tags`), the sim rate in `fromTick = from × 30`, the canvas for the context check (`#app canvas`, `webgl2`), `hud`/`tags` as the CSS-px keys |
| `gallery.ts` | mostly | The title, colours and font; it reads `shots.ts` and `candidates.json` |
| `cut.ts` | mostly | It imports the game's `music.ts`, `stems.ts` and `wav.ts`; the cut-file format is generic |
| `cards.ts` | yes | It reads `transcript.json` and serves `card-page/` |
| `card-page/` | no | The game's look: its CSS, fonts, wordmark, item icons |
| `transcript.json`, `cuts/*.json`, `shots.ts` | no | The game's words, edits and shot list |
| `moments.ts`, `record.ts` | no | The game's headless twin, what counts as a moment, the seeds to search |
| `music.ts`, `stems.ts` | no | The game's music core and sound engine |
| `src/game/film/*`, cameras, `test-hook.ts` drivers | no | The game's film driver: plan, hooks, headless twin, sound recorder, cameras |

The contract the reusable scripts need from a game: `body[data-ready="1"]`; `__game.extra.film(planQuery)`;
`__game.extra.filmProbe()` → `{ tick, phase, ships }` or null; optionally `window.__filmSound()`; everything drawn
from `performance.now`/`requestAnimationFrame`; and the plan query string as the whole recipe for a clip.

For a game that isn't a race, the same pieces map over: the plan is the seed, level and a scripted or bot player;
a "moment" is an event in the headless game (a big combo, a solve, a near miss, a win); cameras may be just the
game's own view at a couple of zooms. Keep the gallery and the review gates exactly as they are.
