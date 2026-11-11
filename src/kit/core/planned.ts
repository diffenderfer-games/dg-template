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

/**
 * Challenges (hub client 2.0.0-next.21, docs/hub.md "Challenges"): a short seeded goal this game plays for
 * another (Diffenopoly's Game mode). The kit reads `hub.challenges` only when the client has it, so these
 * shims hold until the pinned client does; the real `Challenge` is a superset of {@link KitChallenge}.
 */
export type KitChallengeLevel = 'easy' | 'medium' | 'hard';

/** A challenge as the kit reads it (`hub.challenges.active`). */
export type KitChallenge = {
  readonly id: string;
  /** The game it is played in (this one). */
  readonly game: string;
  /** The game it is for, and its title ("Challenge for Diffenopoly"). */
  readonly from: string;
  readonly fromTitle: string;
  readonly level: KitChallengeLevel;
  /** An unsigned 32-bit seed: the same challenge for the same seed. */
  readonly seed: number;
  readonly status: 'open' | 'won' | 'lost' | 'expired';
  /** Where the player goes back to. */
  readonly returnTo: string;
  readonly expiresAt: number;
};

/** A finished challenge (`hub.challenges.complete`). */
export type KitChallengeCompletion = {
  readonly status: 'won' | 'lost';
  /** Where to send the player now. */
  readonly returnTo: string;
  readonly token: string | null;
  readonly move: 'sent' | 'refused' | null;
};

/** `hub.challenges`, the part the kit uses. */
export type ChallengesLike = {
  /** The challenge id this page was opened for (`?hub_challenge=`), or null. Synchronous. */
  readonly requested: string | null;
  /** The challenge, from the hub (null: none, not the player's, or unreadable). */
  readonly active: Promise<KitChallenge | null>;
  complete(id: string, result: { readonly won: boolean }): Promise<KitChallengeCompletion>;
  /** `location.assign(to.returnTo)`. */
  goBack(to: { readonly returnTo: string }): void;
};

/**
 * Local seats (hub client 2.0.0-next.22, docs/hub.md "Local seats"): 2–4 players on one screen, each on
 * their own gamepad (or one on the keyboard). The kit reads `hub.input.seats` only when the client has it
 * (kit/local); the client's own `LocalSeats` is a superset of {@link KitLocalSeats}.
 */
export type KitSeatsOptions = {
  max?: number;
  keyboard?: boolean;
  joinButtons?: readonly number[];
  joinKeys?: readonly string[];
};

/** The device a seat plays on. */
export type KitSeatDevice =
  { readonly kind: 'pad'; readonly pad: number; readonly id: string } | { readonly kind: 'keyboard' };

/** One local player's seat. */
export type KitSeat = { readonly index: number; readonly device: KitSeatDevice; readonly connected: boolean };

/** One seat's inputs, from its own device only. */
export type KitSeatInput = {
  value(name: string): number;
  down(name: string): boolean;
  up(name: string): boolean;
  pressed(name: string): boolean;
  axis(name: string, positive?: string): number;
  vector(name: string): { x: number; y: number; mag: number };
  padDown(button: number): boolean;
};

/** What `seats.on` delivers. */
export type KitSeatEvents = {
  join: KitSeat;
  leave: KitSeat;
  lost: KitSeat;
  found: KitSeat;
  change: readonly KitSeat[];
};

/** `hub.input.seats()`, the part the kit uses. */
export type KitLocalSeats = {
  readonly list: readonly KitSeat[];
  readonly count: number;
  readonly max: number;
  readonly isJoining: boolean;
  joining(isOn: boolean): void;
  seat(index: number): KitSeatInput;
  remove(index: number): void;
  rumble(index: number, effect?: { strength?: number; weak?: number; ms?: number }): void;
  on<Name extends keyof KitSeatEvents>(event: Name, listener: (payload: KitSeatEvents[Name]) => void): () => void;
  close(): void;
};

/** What `hub.input` gains for local play (absent on older clients: the kit then offers none). */
export type PlannedSeatsExtras = {
  seats?: (options?: KitSeatsOptions) => KitLocalSeats;
};
