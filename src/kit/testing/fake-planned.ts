/**
 * kit/testing: fakes for the planned hub APIs (hub.saved, hub.turns, hub.avatar).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Shapes from the hub's plans (saved-games.md §3, avatars.md §6). A FakeHub
 * only has them when built with `planned: { … }`, so the kit's feature checks
 * see the same "absent" as the published client. Their tests are skipped
 * until the hub phase ships (kit/testing/phases.ts).
 */
import type { Json } from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type {
  AvatarRef,
  PlannedAvatarApi,
  PlannedSavedApi,
  PlannedTurnGame,
  PlannedTurnsApi,
  SavedGame,
  SavedKind,
  TurnGameEvents,
  TurnMoveEvent,
  TurnSummary,
} from '../core/planned.ts';
import type { CallLog } from './calls.ts';

/** The fake `hub.saved`. */
export class FakeSaved implements PlannedSavedApi {
  opened: { id: string; kind: SavedKind } | null = null;
  games: SavedGame[] = [];
  private readonly openHandlers = new Set<(g: SavedGame) => void | Promise<void>>();
  private readonly events = new Emitter<{ change: SavedGame[] }>();
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  list(opts?: { kinds?: SavedKind[] }): Promise<SavedGame[]> {
    const kinds = opts?.kinds;
    return Promise.resolve(this.games.filter((g) => kinds === undefined || kinds.includes(g.kind)));
  }

  onOpen(handler: (g: SavedGame) => void | Promise<void>): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  open(id: string): Promise<void> {
    this.log.record('saved.open', id);
    const g = this.games.find((x) => x.id === id);
    if (g) for (const h of this.openHandlers) void h(g);
    return Promise.resolve();
  }

  discard(id: string): Promise<void> {
    this.log.record('saved.discard', id);
    this.games = this.games.filter((g) => g.id !== id);
    this.events.emit('change', this.games);
    return Promise.resolve();
  }

  on(event: 'change', cb: (games: SavedGame[]) => void): () => void {
    return this.events.on(event, cb);
  }

  /** Add a saved instance (and tell listeners). */
  add(g: Partial<SavedGame> & Pick<SavedGame, 'id' | 'kind'>): SavedGame {
    const full: SavedGame = {
      game: 'mygame',
      status: 'active',
      title: null,
      progress: { label: 'Level 1', fraction: null },
      createdAt: 0,
      updatedAt: 0,
      ...g,
    };
    this.games.push(full);
    this.events.emit('change', this.games);
    return full;
  }
}

/** A fake turn game. */
export class FakeTurnGame implements PlannedTurnGame {
  readonly id: string;
  summary: TurnSummary;
  view: Json = {};
  mySeat: number | null = 0;
  readonly moves: Json[] = [];
  private readonly events = new Emitter<TurnGameEvents>();
  private readonly log: CallLog;

  constructor(log: CallLog, id: string) {
    this.log = log;
    this.id = id;
    this.summary = { mode: null, phase: 'playing', seats: [], toAct: [0], isMyTurn: true, seq: 0, unseen: 0 };
  }

  move(move: Json): Promise<{ seq: number; view: Json; events: Json[] }> {
    this.log.record('turns.move', move);
    this.moves.push(move);
    this.summary = { ...this.summary, seq: this.summary.seq + 1 };
    return Promise.resolve({ seq: this.summary.seq, view: this.view, events: [] });
  }

  history(sinceSeq: number): Promise<{ seq: number; seat: number; events: Json[] }[]> {
    this.log.record('turns.history', sinceSeq);
    return Promise.resolve([]);
  }

  leave(): Promise<void> {
    this.log.record('turns.leave');
    return Promise.resolve();
  }

  nudge(): Promise<void> {
    this.log.record('turns.nudge');
    return Promise.resolve();
  }

  setNotify(mode: 'on' | 'off'): Promise<void> {
    this.log.record('turns.setNotify', mode);
    return Promise.resolve();
  }

  close(): void {
    this.log.record('turns.close');
  }

  on<K extends keyof TurnGameEvents>(event: K, cb: (payload: TurnGameEvents[K]) => void): () => void {
    return this.events.on(event, cb);
  }

  /** Another player moved. */
  opponentMoved(m: TurnMoveEvent): void {
    this.events.emit('move', m);
  }

  /** The turn changed. */
  turnChanged(s: Partial<TurnSummary>): void {
    this.summary = { ...this.summary, ...s };
    this.events.emit('turn', this.summary);
  }

  /** The game ended. */
  ended(outcome: Json): void {
    this.events.emit('ended', { outcome, view: this.view });
  }
}

/** The fake `hub.turns`. */
export class FakeTurns implements PlannedTurnsApi {
  readonly games = new Map<string, FakeTurnGame>();
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  private game(id: string): FakeTurnGame {
    const g = this.games.get(id) ?? new FakeTurnGame(this.log, id);
    this.games.set(id, g);
    return g;
  }

  create(opts: { mode?: string; options?: Json }): Promise<PlannedTurnGame> {
    this.log.record('turns.create', opts);
    return Promise.resolve(this.game(`tg-${this.games.size + 1}`));
  }

  join(id: string): Promise<PlannedTurnGame> {
    this.log.record('turns.join', id);
    return Promise.resolve(this.game(id));
  }

  open(id: string): Promise<PlannedTurnGame> {
    this.log.record('turns.open', id);
    return Promise.resolve(this.game(id));
  }
}

/** The fake `hub.avatar`. */
export class FakeAvatar implements PlannedAvatarApi {
  private readonly events = new Emitter<{ change: { userId: number; ref: AvatarRef } }>();
  private readonly log: CallLog;
  private readonly userId: number;

  constructor(log: CallLog, userId: number) {
    this.log = log;
    this.userId = userId;
  }

  private mineCode: string | null = null;

  mine(): Promise<AvatarRef> {
    return Promise.resolve(this.ref(this.mineCode ?? `me-${this.userId}`));
  }

  of(userId: number): Promise<AvatarRef> {
    return Promise.resolve(this.ref(`user-${userId}`));
  }

  from(x: { look?: string; avatar?: string; userId?: number; id?: number }): AvatarRef {
    return this.ref(x.look ?? x.avatar ?? `user-${x.userId ?? x.id ?? 0}`);
  }

  bot(seed: string): AvatarRef {
    return this.ref(`bot-${seed}`);
  }

  on(event: 'change', fn: (e: { userId: number; ref: AvatarRef }) => void): () => void {
    return this.events.on(event, fn);
  }

  openDesigner(opts?: { reason?: string }): Promise<{ saved: boolean }> {
    this.log.record('avatar.openDesigner', opts);
    return Promise.resolve({ saved: true });
  }

  /** A player changed their look. */
  change(userId: number, code: string): void {
    if (userId === this.userId) this.mineCode = code;
    this.events.emit('change', { userId, ref: this.ref(code) });
  }

  private ref(code: string): AvatarRef {
    return { code: `AV1${code}`, isDefault: false, hidden: false };
  }
}
