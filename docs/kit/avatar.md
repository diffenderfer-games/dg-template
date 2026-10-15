# kit/avatar

Source: `src/kit/avatar/` (KIT: copy byte-identical; change it in the template first).

Players' faces beside their names, reactions on those faces, and a title-screen demo of the player's own bust.

## What the game does

It edits `src/game/avatar.ts`, which exports `avatar: AvatarHooks`:

```ts
import type { AvatarHooks } from '../kit/avatar/index.ts';

export const avatar: AvatarHooks = {
  feelOn: { coin: 'bigPlay', win: 'win', lose: 'lose', waiting: 'waiting' },
  titleDemo: true,
};
```

`feelOn` maps game events to a feeling (`win`, `lose`, `bigPlay`, `victim`, `waiting`, `yourTurn`, `idle`). `titleDemo` shows the player's bust on the title screen and is on by default. `new-game --no-avatar` deletes the hook and the title lines marked `new-game:avatar`.

Rules for the game:

- Show a player's avatar wherever you show their name.
- Never draw your own faces for real players.
- A hero that is not the player (a dinosaur, a ship) is not an avatar.

## What the hub does

The hub draws every face (avatars plan, phases 0 to 4):

- `hub.avatar` has `mine()`, `of(userId)`, `from({ look, userId })`, `bot(seed)`, `on('change')` and `openDesigner({ reason })`.
- The `<dg-avatar>` element renders a look. It takes `look`, `size`, `animate`, `feel`, `look-x` and `look-y`.
- Phase 2 is the designer. Phase 4 adds the Pixi and three.js adapters (the Pixi starter has `src/starters/pixi/avatar-pixi.ts`).

## What the kit does

- `face(hub, who, size)`: a `<dg-avatar>` with the player's look. Lobby seats in `online-flow.ts` use it.
- `nameAndFace`: a face and a name button that opens the player card.
- `seatBadge`: a face with a name plate. `lookAtActive(badges, active)` turns every face toward the active seat; call it on every turn change.
- `feelOn(map, show)` and `resultFaces(results, show)`: events to feelings, and the winner cheers while the others look sad. `showFeel(badge, feel)` sets the feeling.
- `botLook(hub, seed)`: a stable face for a computer player.
- `titleDemo(hub, screen)`: the bust in the bottom-left corner, blinking and looking at the pointer, with an Edit button (`data-testid="avatar-edit"`) that opens the designer. It re-renders when the look changes and returns a remover.

## Which phase turns it on

`avatars0` (hub.avatar data and API) turns on the faces and the title demo. `avatars2` (the designer) makes the Edit button useful. `avatars4` (the Pixi and three.js adapters) is for in-canvas faces. All are `shipped: false` in `src/kit/testing/phases.ts`.

## What works today

- Without `hub.avatar`, `face` returns a circle with the player's initial (`data-face="initial"`), or an empty silhouette for a hidden player (`data-face="silhouette"`).
- `botLook` returns `null`.
- `titleDemo` does nothing and the demo stays hidden. The hook is on by default, so it appears the moment the hub has avatars.
- `nameAndFace`, `seatBadge`, `lookAtActive`, `feelOn` and `resultFaces` work without the hub.

## Rules enforced

- Every name opens the player card: [Showing other players](../multiplayer.md#11-showing-other-players--notification-etiquette).
- A hidden player shows a silhouette, never their look (`Who.hidden`): [Social and multiplayer](../hub.md#social--multiplayer).
- Faces on a seat are the hub's, so no player-typed or drawn content is sent by the game: [Content safety and the rejection contract](../hub.md#content-safety--the-rejection-contract).

## API

| Name | What it is |
|---|---|
| `AvatarHooks` | `{ feelOn?, titleDemo? }` (`src/game/avatar.ts`) |
| `Feel` | the seven feelings |
| `Who` | `{ userId?, name, look?, hidden? }` |
| `face`, `nameAndFace`, `seatBadge` | build the elements |
| `lookAtActive`, `feelOn`, `resultFaces`, `showFeel` | reactions |
| `botLook(hub, seed)` | a computer player's look, or `null` |
| `titleDemo(hub, screen)` | the title bust and Edit button; returns the remover |

## Tests

`tests/kit/avatar/avatar.test.ts` runs now, against the fake hub's `avatars` flag:

- without `hub.avatar` an initial (a silhouette for a hidden player); with it, `<dg-avatar>` with the look;
- every name opens the player card;
- `feelOn` maps events to feelings and result faces cheer the winner;
- the title demo appears only with hub avatars, and Edit opens the designer.

Skipped:

- `tests/hub-events/planned.test.ts` row 62 (`avatars0`): a look change re-renders the title bust and badges with no reload.
- `tests/hub/kit/planned.test.ts` (`avatars0` + `avatars2`): every human seat shows a face; a design change re-renders live.

## Hub API used

`hub.avatar` (`mine`, `from`, `bot`, `on('change')`, `openDesigner`) behind a feature check, and `hub.social.openPlayer`.
