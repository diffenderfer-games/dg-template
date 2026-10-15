/**
 * kit/testing: the hub phases that planned kit features wait on.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Planned hub tests"
 *
 * Every test of a planned hub API is written now and skipped with one of
 * these reasons. When the hub publishes a phase, the kit's next minor version
 * flips its entry to `true` and the tests run (docs/kit/CHANGELOG.md).
 */

/** A hub phase, the plan that defines it, and whether the pinned client has it. */
export const HUB_PHASES = {
  savedGames01: { label: 'saved-games phases 0–1 (hub.saved, dailies in progress)', shipped: false },
  savedGames3: { label: 'saved-games phase 3 (hub.turns, turn rules in the hub)', shipped: false },
  savedGames4: { label: 'saved-games phase 4 ("your turn" alerts)', shipped: false },
  avatars0: { label: 'avatars phase 0 (hub.avatar data + API)', shipped: false },
  avatars2: { label: 'avatars phase 2 (the designer)', shipped: false },
  avatars4: { label: 'avatars phase 4 (the Pixi and three.js adapters)', shipped: false },
  worldW2: { label: 'world W2 (game.world tables, launch.table, quickMatch)', shipped: false },
  worldW3: { label: 'world W3 (People panel, reactions, setRoster)', shipped: false },
  worldW4: { label: 'world W4 (dg-room@1 room files, the converter)', shipped: false },
} as const;

/** A planned hub phase key. */
export type HubPhase = keyof typeof HUB_PHASES;

/** The skip reason for a test waiting on `phase`. */
export function waitsOn(...phases: HubPhase[]): string {
  return `waits on ${phases.map((p) => HUB_PHASES[p].label).join(' + ')}`;
}

/** Has the pinned hub shipped every one of `phases`? */
export function shipped(...phases: HubPhase[]): boolean {
  return phases.every((p) => HUB_PHASES[p].shipped);
}
