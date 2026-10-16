/**
 * kit/turns: the rules contract for a game's rules module, from the hub's zod-free entry.
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The rules module"
 *
 * `@diffenderfer-games/hub/turns-rules` is `defineTurnRules`, the rules types
 * and the seeded RNG and nothing else (multiplayer.md §16.2), so a rules
 * module that imports it stays a few KB once bundled. `src/game/turns/rules.ts`
 * imports from here; the conformance kit (`checkTurnRules`) is in the index,
 * for tests.
 */
export { createTurnRng, defineTurnRules, turnRngStateFromSeed } from '@diffenderfer-games/hub/turns-rules';
export type {
  TurnApplyResult,
  TurnOutcome,
  TurnProgress,
  TurnRng,
  TurnRngState,
  TurnRules,
  TurnSetupContext,
} from '@diffenderfer-games/hub/turns-rules';
