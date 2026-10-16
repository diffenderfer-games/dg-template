/**
 * kit/testing: online games played over days (`hub.turns`, `TurnGame`).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour from multiplayer.md §16.3 and the client (core/turns): `create`,
 * `join` and `open` give a game; `move` answers `{ seq, view, events }`;
 * another player's move arrives as `move`, a change of turn as `turn`, the
 * end as `ended`. While a game is open `hub.resume.save` is blocked
 * (`blockedBy: 'turns'`) until it is closed.
 */
import type { GamePayload, TurnCreateOptions, TurnGameEvents, TurnOutcome, TurnSummary } from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { TurnGameLike, TurnsLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';

/** A turn game's live events, as an emitter's event map. */
type Events = { [K in keyof TurnGameEvents<GamePayload, GamePayload>]: TurnGameEvents<GamePayload, GamePayload>[K] };

/** A summary: my turn, seat 0, two seats, nothing played yet. */
export function turnSummary(s: Partial<TurnSummary> = {}): TurnSummary {
  return {
    mode: null,
    phase: 'playing',
    seats: [
      { seat: 0, userId: 1, name: 'Player1', avatar: '', look: '', status: 'joined', isMe: true },
      { seat: 1, userId: 2, name: 'Sam', avatar: '', look: '', status: 'joined', isMe: false },
    ],
    toAct: [0],
    isMyTurn: true,
    turnStartedAt: 0,
    deadline: null,
    seq: 0,
    unseen: 0,
    isMine: true,
    isPublic: false,
    isMuted: false,
    ...s,
  };
}

/** A fake turn game. */
export class FakeTurnGame implements TurnGameLike {
  readonly id: string;
  summary: TurnSummary = turnSummary();
  view: GamePayload = {};
  mySeat: number | null = 0;
  closed = false;
  readonly moves: GamePayload[] = [];
  private readonly events = new Emitter<Events>();
  private readonly log: CallLog;

  constructor(log: CallLog, id: string) {
    this.log = log;
    this.id = id;
  }

  move(move: GamePayload): Promise<{ seq: number; view: GamePayload; events: GamePayload[] }> {
    this.log.record('turns.move', move);
    this.moves.push(move);
    this.summary = { ...this.summary, seq: this.summary.seq + 1 };
    return Promise.resolve({ seq: this.summary.seq, view: this.view, events: [] });
  }

  history(sinceSeq: number): Promise<{ seq: number; seat: number; events: GamePayload[] }[]> {
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
    this.closed = true;
  }

  on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): () => void {
    return this.events.on(event, cb);
  }

  // ---- drivers -------------------------------------------------------------

  /** Another player moved. */
  opponentMoved(m: Events['move']): void {
    this.summary = { ...this.summary, seq: m.seq };
    this.view = m.view;
    this.events.emit('move', m);
  }

  /** The turn changed. */
  turnChanged(s: Partial<TurnSummary>): void {
    this.summary = { ...this.summary, ...s };
    this.events.emit('turn', this.summary);
  }

  /** The game ended. */
  ended(outcome: TurnOutcome | null): void {
    this.summary = { ...this.summary, phase: 'ended', toAct: [], isMyTurn: false };
    this.events.emit('ended', { outcome, view: this.view });
  }
}

/** The fake `hub.turns`. */
export class FakeTurns implements TurnsLike {
  /** The invite link key the page was opened with (`?hub_turn_link=`); tests set it. */
  link: string | null = null;
  readonly games = new Map<string, FakeTurnGame>();
  private readonly log: CallLog;

  constructor(log: CallLog) {
    this.log = log;
  }

  /** Is any game open on this page (`hub.resume.blockedBy === 'turns'`)? */
  get anyOpen(): boolean {
    return [...this.games.values()].some((g) => !g.closed);
  }

  private game(id: string): FakeTurnGame {
    const g = this.games.get(id) ?? new FakeTurnGame(this.log, id);
    g.closed = false;
    this.games.set(id, g);
    return g;
  }

  create(options: TurnCreateOptions = {}): Promise<FakeTurnGame> {
    this.log.record('turns.create', options);
    const g = this.game(`tg-${this.games.size + 1}`);
    g.summary = turnSummary({ phase: 'lobby', mode: options.mode ?? null, toAct: [], isMyTurn: false });
    return Promise.resolve(g);
  }

  join(idOrLinkKey: string): Promise<FakeTurnGame> {
    this.log.record('turns.join', idOrLinkKey);
    return Promise.resolve(this.game(idOrLinkKey));
  }

  open(id: string): Promise<FakeTurnGame> {
    this.log.record('turns.open', id);
    return Promise.resolve(this.game(id));
  }
}
