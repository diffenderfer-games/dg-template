/**
 * kit/live/sim: what a live game's sim module imports (zod-free, bundled into dist-live/sim.mjs).
 * Source: dg-template src/kit/live/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/live.md
 *
 * `defineLiveSim`, the field builders `f`, the deterministic math `dmath`
 * (sin/cos/atan2 that give the same numbers on every browser and the
 * server), the seeded RNG and the types, from the hub's
 * `@diffenderfer-games/hub/live-sim`.
 */
export * from '@diffenderfer-games/hub/live-sim';
