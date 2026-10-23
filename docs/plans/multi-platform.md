# Plan: one game, many places (portal builds)

Status: **draft, planning only (2026-10-22). Nothing here is built yet.** The
open questions are in §11 "Decisions"; the user's answers will go there and
override anything above them.

> **The ask (the user, trimmed):** *"I don't want any ads in diffenderfer-games
> games but I'm open to other sites not just Facebook. Do the web research and
> come up with a plan … so I can have the right flags and calls in code to do
> all this stuff where I make one game and can deploy it in multiple places."*

**Reading of the ask:** the diffenderfer.games build stays ad-free, with no ad
SDK code in it at all. Portal builds (Facebook, CrazyGames, Poki, …) may show
ads, because that is how those sites pay. (§11 D1 confirms this.)

**Sources.**
- Portal documentation read on 2026-10-22, listed in §12.
- A survey of the hub surface the kit uses: `src/kit/core/hub-like.ts`,
  `src/kit/core/env.ts`, `src/main.ts`, `vite.config.ts`, and the hub client
  (`diffenderfer-games/packages/public/hub/src/`).

---

## 1. Where a game can go, and what each place allows

| Target | How you get paid | Hosting | Network to our servers | Accounts and saves | Key rules |
|---|---|---|---|---|---|
| **diffenderfer.games** (`dg`) | Not at all. No ads, ever. | Our host | Yes, the full hub | Hub accounts and saves | Everything we have today |
| **Facebook Instant Games** (`facebook`) | Audience Network ads: interstitial, rewarded, rewarded interstitial. In-app purchases on facebook.com and Android only, after review. | Upload a zip to Meta: `index.html` and `fbapp-config.json` at the root; up to 400 MB, under 5 MB recommended for the first load | Allowed only for hosts listed in the app's Content Security Policy (`connect-src` covers WebSockets) | FB player ID, name and photo; FBInstant player data | SDK `fbinstant.8.0.js`; call `initializeAsync`, then `setLoadingProgress`, then `startGameAsync`. Needs business verification and Audience Network approval (even for in-app purchases). |
| **CrazyGames** (`crazygames`) | Ad revenue share. Ads only after "Full Launch"; none in "Basic Launch". In-game purchases are invite-only. | Upload. Up to 250 MB and 1,500 files. First load ≤ 50 MB (≤ 20 MB for the mobile homepage). Relative paths only. | Not restricted in the docs we read. Multiplayer is supported. | User module (username, avatar, token); Data module saves (1 MB) | `SDK.init()`, `loadingStart/Stop`, `gameplayStart/Stop`. Multiplayer must report the room through the SDK, support invite links and "instant multiplayer", and show CG usernames. Chat needs moderation. |
| **Poki** (`poki`) | Ad revenue: 100% of traffic you bring, 50/50 of traffic Poki brings. The standard deal is **web-exclusive**; non-exclusive is a flat license fee. | They host it after review; submission is a closed beta with a form | **Blocked by default** (there is an exceptions policy) | Saves left to us (localStorage wrapped in try/catch) | `gameplayStart` on the first input, `gameplayStop` on every interruption, never twice in a row. `commercialBreak` only when returning from a pause; `rewardedBreak` buttons show 🎬, are not green, and sit beside an equal-size "continue". No in-game purchases or secondary currencies. Outgoing links only through `openExternalLink`. 16:9, mobile, tablet. |
| **GameDistribution** (`gamedistribution`) | About a 33% share, syndicated to 4,000+ sites | Upload | Not covered | None, so local only | `GD_OPTIONS{gameId,onEvent}`, `gdsdk.showAd()`. Pause and mute on `SDK_GAME_PAUSE`, resume on `SDK_GAME_START`. |
| **YouTube Playables** (`youtube`) | YouTube ads: pre-roll is automatic; interstitial and rewarded through the SDK. Partner-managed, so apply and work through a Partner Manager. | Upload. First load < 30 MiB, total < 250 MiB, each file < 30 MiB, ≤ 8,000 files, names `[A-Za-z0-9_.-]` | **None.** No external calls and no login screens; usernames count as personal data. | Must use `saveData`/`loadData` and no other save mechanism (≤ 3 MiB) | Load the SDK first. `firstFrameReady` while loading, `gameReady` at an interactive screen. Pause on `onPause`, never Page Visibility. Follow YouTube mute (`isAudioEnabled`) and show no master mute button. Must be a single-page app. |
| **itch.io** (`itch`) | Sales, pay-what-you-want or donations; you set itch's cut (default 10%). No ads. | Zip with `index.html`, shown in an iframe; size and file-count limits apply | Open | Ours (localStorage) | The easiest target, and a good first one to exercise the pipeline |
| **Discord Activities** (`discord`), later | In-app purchases and subscriptions (Discord SKUs) | Our server, behind Discord's proxy with URL mappings | Through Discord's proxy | Discord OAuth, which needs a small backend token exchange | A natural fit for online group play; comes last (§9 phase 6) |

**Not researched, but could reuse the `standalone` adapter:** Y8 (50% ad
share), GamePix, GameMonetize, Newgrounds, and app stores (Capacitor or TWA
wrappers) or Steam (Electron).

**What this means for design:**
1. **Online play can't be assumed.** Poki blocks it by default, YouTube forbids
   it, and GameDistribution, Poki and YouTube give us no accounts. Every game
   must run fully single-player and offline-capable on a portal. Online is a
   capability that lights up only where a target allows it (§7).
2. **Saves must go through a swappable store.** That store is YouTube's
   `saveData`, CrazyGames' Data module, FBInstant player data, or
   localStorage.
3. **Lifecycle events are the common shape across every portal SDK:**
   loading, ready, gameplay start/stop, pause/resume, an ad break, a rewarded
   break, and audio-enabled. The kit owns all of them, so a game never calls an
   SDK.
4. **Links, menus and identity UI are hub-only.** The hub menu, catalog links,
   login, friends, chat, kids mode and `/parents` stay on `dg`.

---

## 2. The seam we already have

Only `src/main.ts` imports the hub client (`defineGame(hub, game)`). Every
kit module takes a structural `HubLike` (`src/kit/core/hub-like.ts`), and
`FakeHub` (`src/kit/testing/fake-hub.ts`) already proves the kit runs without
the real hub. The build is static with `base: './'`, so its paths are already
relative.

So the plan **does not touch game code paths.** It adds:
- a `Platform` (lifecycle, ads, saves, identity, capabilities),
- a `PortalHub`, a real `HubLike` backed by a `Platform` instead of `/_api`,
- a build-time **target** that picks which of these `main.ts` wires up.

---

## 3. The target flag (build time)

- **Setting it:** `DG_TARGET=<id>` at build time (`dg` when unset). It becomes
  a compile-time constant through Vite `define`:
  `__DG_TARGET__: JSON.stringify(target)`.
- **Values:** `dg | facebook | crazygames | poki | gamedistribution | youtube |
  itch | standalone` (`discord` later). `standalone` is the plain, no-SDK
  portal build that itch and the long tail use.
- **Why compile time, not runtime detection:**
  1. Dead-code elimination. The `dg` bundle contains **zero** portal SDK and
     ad code (D1).
  2. Portal bundles must not import `@diffenderfer-games/hub`, whose singleton
     talks to `/_api` and `/_hub/*`.
  3. Each portal reviews a specific bundle anyway.
- **Wiring:** `src/kit/platform/select.ts` holds an `if (__DG_TARGET__ === 'x')`
  chain over dynamic `import()`s. Vite drops the unused branches, and each
  adapter becomes its own chunk.
- **Runtime sanity check:** each adapter also checks it really is on its host,
  e.g. `CrazyGames.SDK.environment !== 'disabled'`, `window.FBInstant`
  present, `ytgame` present. If not, it warns and degrades to `standalone`,
  so a misplaced zip still plays.
- **Rule for game code:** branch on **capabilities**, never on the target name
  (`ctx.platform.caps.online`, not `target === 'poki'`). Only adapters know
  target names.

---

## 4. The `Platform` interface (`src/kit/platform/`)

One file per adapter, with a mock of each for tests:

```
src/kit/platform/
  types.ts           Platform, Caps, PlayerInfo, AdResult
  select.ts          compile-time target -> adapter (dynamic import)
  portal-hub.ts      HubLike implemented over a Platform (§5)
  dg.ts              the hub; every ad call is a no-op that resolves at once
  standalone.ts      localStorage, no ads, no identity (itch and fallback)
  crazygames.ts  poki.ts  gamedistribution.ts  facebook.ts  youtube.ts
  mocks/             a scripted fake of each SDK, used by tests and portal:dev
```

**The interface,** written as prose (the real code is TypeScript):

- `id`: the target.
- `caps`: what this target supports (the capability flags below).
- **Lifecycle:**
  - `init(): Promise<void>`: load or init the SDK; on YouTube the SDK loads
    before any game code.
  - `loadingProgress(pct)`: FB `setLoadingProgress`.
  - `firstFrame()`: YouTube `firstFrameReady`, CrazyGames `loadingStart`.
  - `ready()`: FB `startGameAsync`, YouTube `gameReady`, CrazyGames
    `loadingStop`, Poki `gameLoadingFinished`.
  - `gameplayStart()` / `gameplayStop()`: guarded so they never fire twice in a
    row (Poki rule).
  - `happyTime()`: CrazyGames; a no-op elsewhere.
- **Pause and audio pushed by the host:**
  - `onPause(cb)` / `onResume(cb)`: YouTube and GameDistribution events; on
    other targets, Page Visibility.
  - `audioEnabled()` / `onAudioChange(cb)`: YouTube mute; otherwise always on.
- **Ads (all resolve; never throw, never block play):**
  - `ads.break(where)` resolves to `void`. `where` is `'between-rounds' |
    'resume-from-pause'`.
  - `ads.rewarded(placement)` resolves to `AdResult` (`'granted' | 'skipped'
    | 'unavailable'`).
  - `ads.banner(slot, show)`: optional, CrazyGames and GameDistribution only.
- **Identity and data:**
  - `player()` resolves to `PlayerInfo | null`: FB, CrazyGames, later Discord.
  - `store.load()` resolves to the saved blob or `null`; `store.save(blob)`.
    These are backed by YouTube `saveData`, CrazyGames `data`, FB player data,
    or localStorage.
- **Social:**
  - `submitScore(board, value)`: YouTube `sendScore`, FB, otherwise local.
  - `share(payload)`: FB `shareAsync`, else `navigator.share` if
    `caps.externalLinks`.
  - `openExternal(url)`: Poki `openExternalLink`; blocked where links aren't
    allowed.
  - `invite` / room helpers: FB context and CrazyGames invite links (§7).

**Capability flags in `Caps`:**

| Flag | Meaning |
|---|---|
| `ads.interstitial`, `ads.rewarded`, `ads.banner` | Which ad types exist (all false on `dg`, `itch`, `standalone`) |
| `iap` | In-app purchases possible (false everywhere in v1; D5) |
| `accounts` | The host has a logged-in identity |
| `cloudSave` | Saves follow the player across devices |
| `leaderboards` | Real leaderboards (otherwise "your best" only) |
| `friends`, `chat` | `dg` only in v1 |
| `online` | Realtime rooms (`dg`; later FB, CrazyGames, Discord) |
| `turns` | Async turn games (`dg`; later FB contexts) |
| `externalLinks` | Links out allowed (`dg`, `itch`; Poki through `openExternal`) |
| `hubMenu` | The hub's injected menu and Select button behavior (`dg` only) |
| `muteButton` | Show our master mute (false on YouTube) |
| `pauseFromHost` | The host drives pause (YouTube, GameDistribution); the kit must not use visibility |

---

## 5. `PortalHub`: the kit runs unchanged

`PortalHub implements HubLike` (the same contract test as the real `Hub`,
`tests/kit/testing/contract.test.ts`) on top of a `Platform`:

- **Saves, resume, saved games, profile, daily state:** one JSON document in
  `platform.store`. Writes are debounced, with a flush at milestones and on
  `onPause`. Old versions migrate through a `version` field (a YouTube MUST).
  The document has a size budget per target (CrazyGames 1 MB, YouTube 3 MiB,
  with headroom), checked in tests.
- **Scores and stats:** kept locally, plus forwarded to
  `platform.submitScore` where `caps.leaderboards` is true.
- **`userId()` / `me()`:** `platform.player()`, or a stable local guest ID.
- **Hub-only parts** (`social`, `mp`, `rooms`, `turns`, `race`, `presence`,
  `notify`, `avatar` cloud, `menu`): these become inert stubs that report
  "unavailable". The kit's screens already hide online entry points when
  realtime isn't ready; they will read `caps` instead.
- **Daily puzzles:** seeds are deterministic, so dailies work everywhere from
  local state. Daily *share links* follow `caps.externalLinks`.
- **Input:** `hub.input` comes from the hub client. Either import the input
  system on its own (to verify: that it has no host dependency) or move a copy
  into the kit. Without `caps.hubMenu`, Select and Esc open the **game's**
  pause screen.

**Then `main.ts` becomes:**

```ts
const platform = await selectPlatform();                  // compile-time target
const hubLike = platform.id === 'dg' ? (await import('@diffenderfer-games/hub')).hub
                                     : new PortalHub(platform);
defineGame(hubLike, game, { platform });
```

---

## 6. Ads: the kit owns the break points, games just declare rewards

Ads only run when `caps.ads.*` is true, so on `dg` none of this exists in
the bundle.

**Interstitials.** The kit calls `platform.ads.break('between-rounds')` in
exactly two places:
- the result screen's "next" or "play again",
- leaving the pause screen back into play (`'resume-from-pause'`, Poki's only
  allowed spot for `commercialBreak`).

Never during gameplay, and never on first launch. The portals pace the ads
themselves, so the kit adds **no frequency timers** (a Poki rule).

**Rewarded.** A game declares optional rewards in its hooks:

```ts
rewards: [{ id: 'continue', label: 'Keep going', grant: (ctx) => … }]
```

The kit renders them with one `RewardButton` that carries every portal's UI
rules:
- the 🎬 icon, and not green;
- an equal or larger plain "No thanks" or "Continue" beside it;
- a guard against double grants;
- no grant when an ad blocker is detected.

Rewards must never gate core progress. Each game's `docs/game.md` lists its
rewards (examples: a Sudoku or Jigsaw hint, a Fish Flap continue, a Tetrablox
undo).

**During any ad:** the kit pauses the loop, mutes `kit/audio`, and sends no
gameplay events. It restores everything when the ad promise settles.

---

## 7. Online play off the hub (a later phase)

Goal: a portal player can join the same hub rooms and turn games, but only
where the target allows network and gives a real identity.

1. **Hub endpoint `POST /_api/portal/session`.** It exchanges a signed portal
   identity for a hub session, scoped to the game and marked
   `source: facebook|crazygames|discord`:
   - FB `getSignedPlayerInfoAsync`, verified with the app secret
     **server-side only**;
   - a CrazyGames user token (a JWT checked against their public key);
   - a Discord OAuth code.
2. **Cross-origin support on the hub.** CORS and WebSocket origin allow-lists
   for portal origins; add the hub host to FB's CSP `connect-src`.
3. **Realtime without the host page runtime.** Today `social`, `mp` and
   `rooms` forward to the host runtime on `window.__DG__.rt`. Portal builds
   need a direct client to `/_ws`, packaged as an optional kit module. This is
   the largest hub change in the plan.
4. **Portal-specific joining:**
   - CrazyGames: `updateRoom{isJoinable, inviteParams}`, invite links,
     `isInstantMultiplayer` launching straight into a private room, and CG
     usernames shown in game.
   - FB: contexts (`chooseAsync`, `updateAsync`) for invites and async turns.
5. **Chat stays off on portals** (CrazyGames requires moderation, and FB is
   13+). Kids and parents features stay `dg`-only.
6. **Discord Activity:** the same session exchange plus Discord's URL-mapping
   proxy.

The online-play rule in memory (computer takes a seat only after quit/discard)
applies unchanged.

---

## 8. The build and release pipeline (npm scripts, not command lists)

Per game, everything is driven by `package.json`:

```jsonc
"game": {
  …,
  "platforms": {
    "crazygames": { "orientation": "landscape", "progressSave": true },
    "poki": {},
    "facebook": { "appId": "…", "placements": { "interstitial": "…", "rewarded": "…" },
                  "navigationMenu": "NAV_FLOATING", "orientation": "PORTRAIT" },
    "youtube": {},
    "itch": {}
  }
}
```

IDs only; no secrets (the FB app secret lives on the hub). A target missing
from this list isn't built.

**Scripts (in `scripts/kit/`, documented in `docs/kit/platform.md`):**

- `npm run build:portal -- --target=<id>|--all`:
  1. Runs `vite build` with `DG_TARGET` into `dist-portal/<id>/`.
  2. Adds the target's SDK `<script>` to `index.html` (first in `<head>` for
     YouTube and FB).
  3. Writes target files (`fbapp-config.json` for FB).
  4. Zips to `release/<slug>-<id>-<version>.zip`.
- `npm run portal:check`, run by `build:portal` and failing the build on:
  - **Size and file budgets per target** (§1 table).
  - **Path and name rules:** relative paths only; YouTube's file-name
    character set.
  - **External calls:** `poki`, `youtube` and `gamedistribution` builds must
    reference no `http(s)://` hosts other than their own SDK's. Fonts and
    assets are bundled.
  - **No hub references** in portal builds (`/_api`, `/_hub`, `__HUB__`).
  - **No ads in `dg`:** the normal `dg` build is grepped for the SDK hosts
    (`connect.facebook.net`, `crazygames`, `poki`, `gamedistribution`,
    `youtube` playables). One hit fails `npm run check`. This is D1's
    guarantee.
- `npm run portal:dev -- --target=<id>` serves that build with its mock SDK
  (`src/kit/platform/mocks/`). The mocks log every call and simulate pause,
  mute and ad completion or skip. CrazyGames' own SDK also runs in local mode
  on localhost.
- **Unit tests** (`tests/kit/platform/`), run against each mock:
  - event ordering: no `gameplayStart` twice in a row; no gameplay events
    during an ad;
  - `ready()` is called exactly once;
  - YouTube: nothing saved before `loadData`; pause stops the loop;
  - the save blob fits its budget;
  - rewarded buttons follow the UI rules.

**Uploading stays manual** at first (each portal has its own dashboard and
review). Automate later where a portal has an API.

**Template rules that need a portal clause** (`CLAUDE.md`, "The hard rules";
change them when phase 1 lands):
- **The 64px hub-menu corner:** only when `caps.hubMenu`.
- **"Online play only through the hub":** this still holds. A portal reaches
  online only through the hub's session exchange (§7).
- **Hub avatars wherever names show:** use the portal's avatar (FB,
  CrazyGames) or none.
- **Invite links through `shareLink`:** route through `platform.share`.
- **New rule:** game code never calls a portal SDK or names a target; it reads
  `caps`.

---

## 9. Phases

| Phase | What | Done when |
|---|---|---|
| **0** | Answer §11 Decisions; the user creates portal accounts (§10) | Decisions recorded |
| **1** | Kit platform layer: `types`, `select`, `dg` (behaviour unchanged), `standalone`, `PortalHub`, the `caps`-driven screens, `build:portal`, `portal:check`, the no-ads guard. Kit version bump and `docs/kit/platform.md`. | A kit game builds `dg` byte-for-byte equivalent in behaviour, and its `itch` zip plays offline |
| **2** | `crazygames`, `poki`, `gamedistribution` adapters, plus the rewarded and break UI | All three mock suites pass; CrazyGames Basic Launch submission of the pilot game |
| **3** | `facebook` adapter: FBInstant 8.0, player data, ads, share, `fbapp-config.json` | Staged for testing in the Meta dashboard |
| **4** | `youtube` adapter: the strict rules (no network, audio, pause, `saveData`) | Passes the Playables test suite |
| **5** | Online off the hub (§7): session exchange, CORS, direct realtime client; FB and CrazyGames online | A portal player joins a `dg` room |
| **6** | `discord` Activity, plus in-app purchases where D5 allows | — |
| **7** | Roll out per game: kit update, `rewards` hooks, `game.platforms`, store art | Per game |

**Pilot game:** a short-session, single-player, already-on-kit game. Fish Flap
fits best (sessions are rounds, and "continue" is a natural reward). Sudoku or
Jigsaw make a good second, puzzle-type case (hint rewards, dailies, saves).

**Games not yet on the kit** must migrate first
([template-kit-migration.md](template-kit-migration.md)). The platform layer
only exists inside the kit.

---

## 10. Non-code checklist (the user)

- **Shared pages.** A hosted privacy policy and terms page, e.g.
  `diffenderfer.games/privacy` and `/terms`. Several portals require one, and
  Poki rejects Google Docs. Add a small in-game "Privacy" link where the target
  allows links.
- **Meta:**
  - a developer app per game, set up for Instant Games;
  - a business portfolio and business verification;
  - Audience Network approval and placement IDs;
  - CSP domains (§7);
  - payout and tax details;
  - in-app purchase review (only if D5).
- **CrazyGames:** a developer portal account. Submit as Basic Launch (no ads),
  then they promote good performers to Full Launch (ads on). Tick "Progress
  Save" in the submission.
- **Poki:** apply through the submission form (closed beta). Settle D2,
  exclusivity, before signing.
- **GameDistribution:** a developer account and a `gameId` per game.
- **YouTube Playables:** apply or get invited, then work through a Partner
  Manager.
- **itch.io:** an account, payout setup and the pricing model.
- **Store assets per game:** icon, cover, screenshots and short description
  (reuse dg-share-image and the shot scripts).

---

## 11. Decisions (open)

- **D1, ads scope:** ads only in portal builds, with the `dg` build guaranteed
  ad-free by the `portal:check` guard. Correct?
- **D2, Poki exclusivity:** Poki's revenue-share deal is web-exclusive. That
  likely conflicts with CrazyGames, GameDistribution, itch and possibly
  diffenderfer.games itself; confirm the terms. The alternatives are a
  non-exclusive flat fee or skipping Poki for games we syndicate elsewhere.
  Choose per game, or skip Poki?
- **D3, target order:** proposed itch → CrazyGames → GameDistribution → FB →
  YouTube → Poki (if D2 allows) → Discord.
- **D4, rewards:** okay for each game to offer one or two optional rewarded
  extras (continue, hint, undo) on ad portals only?
- **D5, in-app purchases:** none in v1. Later, maybe cosmetics on FB, Discord
  and CrazyGames (invite-only) using the hub's economy?
- **D6, online on portals (phase 5):** worth the hub work, or keep portal
  builds single-player only?

---

## 12. Sources (read 2026-10-22)

- Meta: [Instant Games docs](https://developers.facebook.com/documentation/games),
  [Build overview](https://developers.facebook.com/documentation/games/build/overview),
  [Quick start](https://developers.facebook.com/documentation/games/build/quick-start),
  [Content Security Policy](https://developers.facebook.com/documentation/games/build/content-security-policy),
  [Monetize](https://developers.facebook.com/documentation/games/monetize/overview.md),
  [IAP help](https://www.facebook.com/business/help/472362043174078),
  [legacy SDK reference](https://developers.facebook.com/docs/games/build/instant-games/reference/instant-games-sdk/)
  (to be deprecated end of June 2026)
- CrazyGames: [Technical requirements](https://docs.crazygames.com/requirements/technical),
  [Multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/),
  [SDK intro](https://docs.crazygames.com/sdk/intro/),
  [Data module](https://docs.crazygames.com/sdk/data/)
- Poki: [Requirements](https://developers.poki.com/guide/requirements-quality),
  [SDK site and revenue](https://sdk.poki.com/), [Deals](https://sdk.poki.com/deals)
- YouTube Playables: [Certification](https://developers.google.com/youtube/gaming/playables/certification/requirements),
  [Integration](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration),
  [Stability](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability),
  [Privacy and data](https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata),
  [Monetization](https://developers.google.com/youtube/gaming/playables/reference/monetization)
- GameDistribution: [SDK implementation](https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation)
- itch.io: [HTML5 uploads](https://itch.io/docs/creators/html5)
- Discord: [IAP for Activities](https://docs.discord.com/developers/monetization/implementing-iap-for-activities.md),
  [announcement](https://discord.com/blog/build-where-the-world-plays)
- **Revenue-share roundups (vendor blogs; verify each with the portal):**
  [portalready.world](https://portalready.world/portals/),
  [cinevva](https://app.cinevva.com/guides/web-game-monetization),
  [bountyboard](https://www.bountyboard.gg/blog/how-to-monetize-an-html5-game)
