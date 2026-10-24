# kit/avatar

Source: `src/kit/avatar/` (KIT: copy byte-identical; change it in the template first).

Players' faces beside their names, reactions on those faces, and a
title-screen demo of the player's own bust. The faces are the hub's: every
player has an avatar (a default from their user id until they make one).
Live since hub client 2.0.0-next.6; next.7 added long hair and new glasses
(the renderer is bundled in the pinned package, so a game shows new parts once
it upgrades). next.9 added a world-scale figure: `figure: 'walker'` on the
renderer's full frames, `createAtlas` and the Pixi `createCrowd` draws a small
full-body character that walks, runs, sits, waves and cheers (the hub's world
draws players with it); `blob` stays the default, and heads and busts are
unchanged.

## What the game does

It edits `src/game/avatar.ts`, which exports `avatar: AvatarHooks`:

```ts
import type { AvatarHooks } from '../kit/avatar/index.ts';

export const avatar: AvatarHooks = {
  feelOn: { score: 'bigPlay', win: 'win', lose: 'lose', waiting: 'waiting' },
};
```

`feelOn` maps game events to a feeling (`win`, `lose`, `bigPlay`, `victim`,
`waiting`, `yourTurn`, `idle`: the animator's `feel()`). The title shows
no avatar: players edit theirs from the hub's menu. `titleDemo: true` is the
opt-in for the player's bust and an Edit avatar button under the title's
buttons (the kit adds them after `screens.title`, and the kit's bust tests run:
the hub suite's title bust and Edit avatar, planned row 62). Leave it out:
those tests then skip on their own, with nothing in `tests/kit-skips.json`. `new-game --no-avatar`
deletes the hook.

Faces drawn in the canvas use the hub's typed adapters, which the starters
wrap: `src/game/render/avatar-pixi.ts` (`seatFaces(hub, seats)`, pixi's own
`Sprite`s) or `avatar-three.ts` (`seatSprites(hub, seats)`, three's own
`Sprite`s). Both wait for the renderer first.

Rules for the game:

- Show a player's avatar wherever you show their name.
- Never draw your own faces for real players.
- A hero that is not the player (a dinosaur, a ship) is not an avatar.
- Players see "avatar", "Make your avatar", "Edit avatar", never "look", "code" or "default".

## What the hub does

hub.md [Avatars](../hub.md#avatars), and the designer in `avatar-designer.md` (in the hub repo):

- `hub.avatar`: `mine()`, `mineSync()`, `of(userId)`, `many(ids)`, `from(seat)`
  (any payload with `look`: room seats, racers, players; no request),
  `bot(seed)`, `on('change')`, `openDesigner({ reason })` ("Make your avatar"
  over the game) and `load()` (the renderer with its art).
- `hub.userId()`: your user id, or `null`, synchronously. `change` with your
  user id is your own avatar (also the first one, when a new guest's account appears).
- `@diffenderfer-games/hub/avatar`: `render`, `<dg-avatar>`
  (`defineAvatarElement()`), the `animator` (`feel`, `express`, `lookAt`, …);
  `/avatar/pixi` and `/avatar/three`: the adapters.
- A hidden player's look is `''`: every renderer draws the silhouette.

## What the kit does

- `avatarRenderer(hub)`: loads the renderer once (`hub.avatar.load()`, then
  `defineAvatarElement()`). Every helper below calls it, so a `<dg-avatar>`
  made before the art is ready upgrades when it is.
- `face(hub, who, size, { frame?, animate?, title? })`: a `<dg-avatar>` with
  the player's look (from `who.look`; with only a user id it fetches their avatar,
  `mine()` for you and `of(id)` for others, and follows their changes; never the
  id's stand-in that `hub.avatar.from({ userId })` gives), the silhouette for a
  hidden player (`data-face="silhouette"`). Beside a name it is decorative (no
  `title`). Lobby seats in `online-flow.ts` use it with each seat's `look`.
- `nameAndFace`: a face and a name button that opens the player card.
- `seatBadge`: a live face with a name plate. `lookAtActive(badges, active)`
  turns every face toward the active seat; call it on every turn change.
- `feelOn(map, show)` and `resultFaces(results, show)`: events to feelings,
  and the winner cheers while the others look sad. `showFeel(badge, feel)`
  plays the feeling on the element's own animator (`animator.feel`) and
  animates the face; it returns `false` before the renderer has upgraded it.
- `botLook(hub, seed)`: a stable face for a computer player.
- `titleDemo(hub, screen)`: your bust (frame `bust`, "Your avatar") under
  the title's buttons (in its flow, so it never covers them) at once (`mineSync()`), blinking and looking at the
  pointer, with an **Edit avatar** button (`data-testid="avatar-edit"`) that
  opens the designer. It follows your own `change`s (by `hub.userId()`), cleans
  itself up when its screen is gone, and returns a remover.

## Rules enforced

- Every name opens the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).
- A hidden player shows a silhouette, never their look (`Who.hidden`, `look: ''`): [Where the avatar comes from](../hub.md#where-the-avatar-comes-from).
- Faces are the hub's, so no player-typed or drawn content is sent by the game: [Content safety and the rejection contract](../hub.md#content-safety--the-rejection-contract).
- Avatar words for players: [Accessibility and wording](../hub.md#accessibility-and-wording).

## API

| Name                                                | What it is                                          |
| --------------------------------------------------- | --------------------------------------------------- |
| `AvatarHooks`                                       | `{ feelOn?, titleDemo? }` (`src/game/avatar.ts`)    |
| `Feel`                                              | the seven feelings (the hub's `Feeling`)            |
| `Who`                                               | `{ userId?, name, look?, hidden? }`                 |
| `FaceOptions`                                       | `{ frame?, animate?, title? }`                      |
| `avatarRenderer(hub)`                               | load the renderer and register `<dg-avatar>`, once  |
| `face`, `nameAndFace`, `seatBadge`                  | build the elements                                  |
| `lookAtActive`, `feelOn`, `resultFaces`, `showFeel` | reactions                                           |
| `botLook(hub, seed)`                                | a computer player's avatar                          |
| `titleDemo(hub, screen)`                            | the title bust and Edit avatar; returns the remover |

## Tests

- `tests/kit/avatar/avatar.test.ts` (FakeHub): a face is `<dg-avatar>` with the
  look, the silhouette when hidden, decorative beside a name; the renderer loads
  once; every name opens the player card; feelings; `showFeel` uses the
  animator (never a `feel` attribute); the title demo shows your bust at once,
  opens the designer, follows only your changes and cleans itself up.
- `tests/hub-events/planned.test.ts` row 62: a change re-renders the title bust with no reload.
- `tests/hub/kit/avatar.test.ts` (real hub): the bust is your face, drawn by
  the hub's renderer, and follows a change live; Edit avatar opens the
  designer; every lobby seat shows that player's face.
- Screenshots `avatar` and `avatar-designer` (`npm run shots:hub`).
- Skipped in `tests/hub/kit/planned.test.ts`: the Pixi and three.js adapters
  against `<dg-avatar>` (the template's renderer draws no faces in its canvas).

## Hub API used

`hub.avatar` (`mine`, `mineSync`, `from`, `bot`, `on('change')`,
`openDesigner`, `load`), `hub.userId()`, `hub.social.openPlayer`, and the
types of `@diffenderfer-games/hub/avatar` (the animator's `feel`).
