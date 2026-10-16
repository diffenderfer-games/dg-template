/**
 * kit/core: the game's own `game` block from package.json, read at build time (page code only).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md § "The manifest"
 *
 * package.json is the one place a game declares its quick-chat phrases
 * (`game.multiplayer.quickChat`, `game.turns.quickChat`) and whether it plays
 * online games over days (`game.turns`). Vite inlines only the `game` key
 * (a named JSON import), and the block is read as untrusted JSON, so a game
 * without one of these keys still typechecks. Not re-exported from the core
 * index: Node scripts can't import JSON without an import attribute.
 */
import { game } from '../../../package.json';
import { field } from './json.ts';

/** The phrases of a `quickChat` list (strings only). */
function phrases(block: unknown): string[] {
  const list = field(block, 'quickChat');
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
}

/** What the kit reads from a `game` block. */
export type ManifestFacts = {
  /** `game.turns` is declared: the hub runs this game's rules (online games over days). */
  turns: boolean;
  /** `game.turns.quickChat`: the game's own phrases in its online games over days. */
  turnsQuickChat: string[];
  /** `game.multiplayer.quickChat`: the game's own phrases in its rooms. */
  roomQuickChat: string[];
};

/** Read a `game` block (pure; tests pass their own). */
export function manifestFacts(block: unknown): ManifestFacts {
  const turns = field(block, 'turns');
  return {
    turns: typeof turns === 'object' && turns !== null,
    turnsQuickChat: phrases(turns),
    roomQuickChat: phrases(field(block, 'multiplayer')),
  };
}

/** This game's facts, from its package.json. */
export const MANIFEST: ManifestFacts = manifestFacts(game);
