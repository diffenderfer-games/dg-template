/**
 * kit/core: type shims for hub APIs that are planned but not published yet.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md § "Planned hub APIs"
 *
 * Only the world's tables and in-game presence are left (world.md §3, W2/W3:
 * launch.table, quickMatch, setRoster), still coming: the world itself and a
 * game's own room shipped in hub client next.9 without them. Saved games,
 * online games the hub runs and avatars are live and come from the client's own
 * types (core/hub-like.ts). The kit uses each shim only behind a feature check
 * (`hub.mp.quickMatch !== undefined`), and its tests are skipped with the hub
 * phase that unblocks them (kit/testing/phases.ts). When the hub publishes
 * the real types, this file is replaced by `import type`s and the contract
 * test shows any drift.
 */
import type { Launch } from '@diffenderfer-games/hub';

/** world.md §3.4: the table a launch came from. */
export type TableLaunch = {
  id: string;
  type: string;
  title: string;
  options?: Record<string, string | number | boolean>;
};

/** A launch as the kit reads it: today's `Launch`, plus the planned `table` (world W2). */
export type KitLaunch = Launch & { table?: TableLaunch };

/** world.md §3.6 / §6.2: what `hub.mp` gains. */
export type PlannedMpExtras = {
  quickMatch?: (opts?: { mode?: string }) => Promise<void>;
  setRoster?: (userIds: readonly number[]) => void;
};
