/**
 * kit/core: type shims for hub APIs that are planned but not published yet.
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md § "Planned hub APIs"
 *
 * Shapes come from the hub's plans: saved-games.md §3 (hub.saved, hub.daily
 * additions, hub.turns), avatars.md §6 (hub.avatar) and world.md §3
 * (launch.table, quickMatch, setRoster, reactions). The kit uses each one only
 * behind a feature check (`hub.saved !== undefined`), and its tests are skipped
 * with the hub phase that unblocks them (kit/testing/phases.ts). When the hub
 * publishes the real types, this file is replaced by `import type`s and the
 * contract test shows any drift.
 */
import type { GamePayload, Json, Launch } from '@diffenderfer-games/hub';

/** saved-games.md §2: the kinds of saved instance. */
export type SavedKind = 'daily' | 'run' | 'turns';

/** saved-games.md §2: one saved instance ("Your games" row). */
export type SavedGame = {
  id: string;
  game: string;
  kind: SavedKind;
  status: 'active' | 'finished' | 'discarded' | 'left';
  title: string | null;
  progress: { label: string; fraction: number | null };
  createdAt: number;
  updatedAt: number;
  daily?: { day: string; seed: number };
  turns?: TurnSummary;
};

/** saved-games.md §3.1: `hub.saved`. */
export type PlannedSavedApi = {
  list(opts?: { kinds?: SavedKind[] }): Promise<SavedGame[]>;
  readonly opened: { id: string; kind: SavedKind } | null;
  onOpen(handler: (instance: SavedGame) => void | Promise<void>): () => void;
  open(id: string): Promise<void>;
  discard(id: string): Promise<void>;
  on(event: 'change', cb: (games: SavedGame[]) => void): () => void;
};

/** saved-games.md §3.2: what `hub.daily` gains (every member optional until it ships). */
export type PlannedDailyExtras = {
  save?(run: { state: GamePayload; progress: { label: string; fraction?: number | null }; version?: number }): boolean;
  resume?(instanceId: string): Promise<void>;
  discard?(): void;
};

/** saved-games.md §3.2: the fields a daily challenge gains. */
export type PlannedChallengeExtras = { instanceId?: string; saved?: Json | null; savedVersion?: number };

/** saved-games.md §3.4: a turn game's summary. */
export type TurnSummary = {
  mode: string | null;
  phase: 'lobby' | 'playing' | 'ended';
  seats: {
    seat: number;
    userId: number | null;
    name: string;
    status: 'invited' | 'joined' | 'left' | 'bot';
    isMe: boolean;
  }[];
  toAct: number[];
  isMyTurn: boolean;
  seq: number;
  unseen: number;
};

/** saved-games.md §3.4: one move as it reaches the other players. */
export type TurnMoveEvent = { seq: number; seat: number; view: Json; events: Json[] };

/** saved-games.md §3.4: an open turn game. */
export type PlannedTurnGame = {
  readonly id: string;
  readonly summary: TurnSummary;
  readonly view: Json;
  readonly mySeat: number | null;
  move(move: Json): Promise<{ seq: number; view: Json; events: Json[] }>;
  history(sinceSeq: number): Promise<{ seq: number; seat: number; events: Json[] }[]>;
  leave(): Promise<void>;
  nudge(): Promise<void>;
  setNotify(mode: 'on' | 'off'): Promise<void>;
  close(): void;
  on<K extends keyof TurnGameEvents>(event: K, cb: (payload: TurnGameEvents[K]) => void): () => void;
};

/** saved-games.md §3.4: a turn game's live events. */
export type TurnGameEvents = { move: TurnMoveEvent; turn: TurnSummary; ended: { outcome: Json; view: Json } };

/** saved-games.md §3.4: `hub.turns`. */
export type PlannedTurnsApi = {
  create(opts: {
    mode?: string;
    options?: Json;
    invite?: number[];
    link?: boolean;
    bots?: number;
  }): Promise<PlannedTurnGame>;
  join(idOrLinkKey: string): Promise<PlannedTurnGame>;
  open(id: string): Promise<PlannedTurnGame>;
};

/** avatars.md §6: a player's look. The kit only passes it through to the hub's renderer. */
export type AvatarRef = { code: string; isDefault: boolean; hidden: boolean };

/** avatars.md §6: `hub.avatar`. */
export type PlannedAvatarApi = {
  mine(): Promise<AvatarRef>;
  of(userId: number): Promise<AvatarRef>;
  from(x: { look?: string; avatar?: string; userId?: number; id?: number }): AvatarRef;
  bot(seed: string): AvatarRef;
  on(event: 'change', fn: (e: { userId: number; ref: AvatarRef }) => void): () => void;
  openDesigner(opts?: { reason?: string }): Promise<{ saved: boolean }>;
};

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
