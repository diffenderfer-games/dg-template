/**
 * kit/turns: online games played over days (hub.turns), the rules module and its conformance check.
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md
 *
 * multiplayer.md §16. The game writes a PURE rules module
 * (src/game/turns/rules.ts, its default export, bundled by `npm run
 * build:rules` into a self-contained dist-rules/rules.mjs) and declares it in
 * `game.turns`; the hub runs it on its server with its own RNG. The rules
 * contract, `defineTurnRules`, the seeded RNG and `checkTurnRules` are the
 * hub's own (`@diffenderfer-games/hub/turns`), re-exported here. The rules
 * module imports their types only (`import type`), so its bundle has no
 * imports. The page side is `hub.turns` (`createTurns`).
 */
import type { HubLike, TurnGameLike } from '../core/hub-like.ts';

export { checkTurnRules, createTurnRng, defineTurnRules, turnRngStateFromSeed } from '@diffenderfer-games/hub/turns';
export type {
  TurnApplyResult,
  TurnOutcome,
  TurnProgress,
  TurnRng,
  TurnRules,
  TurnRulesCheckOptions,
  TurnRulesReport,
  TurnSetupContext,
} from '@diffenderfer-games/hub/turns';

/** The adapter over `hub.turns`: open a game from Your games or an invite link, or make one. */
export type TurnsHandle = {
  /** The invite link key this page was opened with (`?hub_turn_link=`), or null. */
  readonly link: string | null;
  open(id: string): Promise<TurnGameLike>;
  join(idOrLinkKey: string): Promise<TurnGameLike>;
  create: HubLike['turns']['create'];
};

/** Create the adapter. */
export function createTurns(hub: Pick<HubLike, 'turns'>): TurnsHandle {
  const turns = hub.turns;
  return {
    get link() {
      return turns.link;
    },
    open: (id) => turns.open(id),
    join: (idOrLinkKey) => turns.join(idOrLinkKey),
    create: (opts) => turns.create(opts),
  };
}

/**
 * "Remind them" (TurnGame.nudge), rate-limited in the UI to once per game per
 * day (the hub enforces it too); the alert's words come from the hub only.
 */
export function nudger(game: Pick<TurnGameLike, 'nudge' | 'id'>, now: () => number): () => boolean {
  let last = -Infinity;
  return () => {
    if (now() - last < 24 * 3600 * 1000) return false;
    last = now();
    void game.nudge();
    return true;
  };
}
