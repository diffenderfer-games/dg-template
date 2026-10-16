/**
 * kit/world: the game's own room in the hub's world (`game.world`), made and checked the hub's way.
 * Source: dg-template src/kit/world/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md § "Your room"
 *
 * hub.md "The world": a game declares a committed `dg-world@1` map file
 * (`game.world.map`), a generated one (`game.world.generate`: a hub world
 * type, a seed that defaults to the slug, and its needs), or both (the file
 * wins; `generate` is the fallback). The hub serves it as the world
 * `game.<slug>`. These helpers use the same schema (hub-contract's
 * `GameWorld`) and the same package (`@diffenderfer-games/world`) as the hub,
 * for `npm run world:*`, the unit tests and the hub suite. Node and tests
 * only: the page never generates maps (the hub draws the world itself).
 */
import { GameWorld } from '@diffenderfer-games/hub-contract';
import {
  checkWorldMap,
  createWorldTypeRegistry,
  generateWorld,
  parseWorldMapText,
  type WorldMap,
} from '@diffenderfer-games/world';

/** A game's world block, parsed. */
export type GameWorldBlock = GameWorld;

/** The world key the hub serves a game's room under. */
export function worldKey(slug: string): string {
  return `game.${slug}`;
}

/** Parse a `game.world` block: the block, or the schema's problems (`null` block when there is none). */
export function parseGameWorld(block: unknown): { world: GameWorldBlock | null; problems: string[] } {
  if (block === undefined) return { world: null, problems: [] };
  const r = GameWorld.safeParse(block);
  if (r.success) return { world: r.data, problems: [] };
  return {
    world: null,
    problems: r.error.issues.map((i) => `world${i.path.map((p) => `.${String(p)}`).join('')}: ${i.message}`),
  };
}

/** The generate request the hub makes from a block (seed: the slug unless given), or null. */
export function generateRequest(
  world: GameWorldBlock,
  slug: string,
): { type: string; seed: string; needs: NonNullable<NonNullable<GameWorldBlock['generate']>['needs']> } | null {
  const g = world.generate;
  return g === undefined ? null : { type: g.type, seed: g.seed ?? slug, needs: g.needs ?? {} };
}

/** Generate the room from a block's `generate`, as the hub does (null without one). */
export function generateRoom(world: GameWorldBlock, slug: string): WorldMap | null {
  const req = generateRequest(world, slug);
  return req === null ? null : generateWorld(createWorldTypeRegistry(), req);
}

/** Every error in a map file's text (size, shape, reachability, a `start` spawn); empty when the hub would take it. */
export function roomProblems(text: string): string[] {
  const parsed = parseWorldMapText(text);
  const problems = parsed.ok ? [...parsed.problems, ...checkWorldMap(parsed.map)] : parsed.problems;
  return problems.filter((p) => p.severity === 'error').map((p) => `${p.code}: ${p.message}`);
}
