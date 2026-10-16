/**
 * kit/testing: the hub phases that kit features wait on, and which the pinned client has.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Planned hub tests"
 *
 * Every test of a planned hub API is written now and skipped with one of
 * these reasons. When the hub publishes a phase, the kit's next minor version
 * flips its entry to `true` and the tests run (docs/kit/CHANGELOG.md).
 * Saved games, online games the hub runs and avatars shipped in client
 * 2.0.0-next.6 (avatar fixes in next.7; online games on the server, presence,
 * moves out of turn and the buzz in next.8). The world shipped in next.9: the
 * live world (W0) and a game's own room (`game.world`, the W4 map files);
 * game tables in the world (W2) and in-game presence (W3) are still coming.
 */

/** A hub phase, the plan that defines it, and whether the pinned client has it. */
export const HUB_PHASES = {
  savedGames01: { label: 'saved-games phases 0–1 (hub.saved, dailies in progress; next.6)', shipped: true },
  savedGames3: { label: 'saved-games phase 3 (hub.turns, turn rules in the hub; next.6)', shipped: true },
  savedGames4: { label: 'saved-games phase 4 ("your turn" alerts; next.6)', shipped: true },
  avatars0: { label: 'avatars phase 0 (hub.avatar data + API; next.6)', shipped: true },
  avatars2: { label: 'avatars phase 2 (the designer; next.6)', shipped: true },
  avatars4: { label: 'avatars phase 4 (the Pixi and three.js adapters; next.6)', shipped: true },
  world0: {
    label: 'world W0 (the live world: walking, presence, /_hub/world.js, the walker figure; next.9)',
    shipped: true,
  },
  worldW2: { label: 'world W2 (game tables in the world, launch.table, quickMatch; coming)', shipped: false },
  worldW3: { label: 'world W3 (People panel, reactions, setRoster; coming)', shipped: false },
  worldW4: {
    label: "world W4 (a game's own room: game.world map files or generate, dg-world, hub-doctor; next.9)",
    shipped: true,
  },
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
