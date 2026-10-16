/**
 * kit/testing: online games played over days (`hub.turns`, `TurnGame`).
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour from multiplayer.md §16.3 and the client (core/turns): `create`,
 * `join` and `open` give a game; `move` answers `{ seq, view, events }`;
 * another player's move arrives as `move`, a change of turn as `turn`, the
 * end as `ended`, a player coming or going as `turn` (the seat's
 * `connected`), chat as `chat`. `canLetComputerPlay` is the client's own
 * rule (a due player past the deadline, or past `handOverAt` and not
 * connected). While a game is open `hub.resume.save` is blocked
 * (`blockedBy: 'turns'`) until it is closed.
 */
import type {
  GamePayload,
  TurnChatLine,
  TurnCreateOptions,
  TurnGameEvents,
  TurnOutcome,
  TurnSummary,
} from '@diffenderfer-games/hub';
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
      { seat: 1, userId: 2, name: 'Sam', avatar: '', look: '', status: 'joined', isMe: false, connected: true },
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
  outcome: TurnOutcome | null = null;
  chat: TurnChatLine[] = [];
  chatMode: 'on' | 'quick' | 'off' = 'quick';
  link: string | null = null;
  closed = false;
  readonly moves: GamePayload[] = [];
  private readonly events = new Emitter<Events>();
  private readonly log: CallLog;
  private readonly next: () => FakeTurnGame;

  /** `next` makes the rematch's game (FakeTurns passes its own maker). */
  constructor(log: CallLog, id: string, next?: () => FakeTurnGame) {
    this.log = log;
    this.id = id;
    this.next = next ?? (() => new FakeTurnGame(log, `${id}-again`));
  }

  get mayActNow(): boolean {
    return (
      this.mySeat !== null && this.summary.phase === 'playing' && (this.summary.mayAct ?? []).includes(this.mySeat)
    );
  }

  start(): Promise<void> {
    this.log.record('turns.start');
    this.summary = { ...this.summary, phase: 'playing', toAct: [0], isMyTurn: this.mySeat === 0 };
    return Promise.resolve();
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

  say(send: { readonly text?: string; readonly quick?: string }): Promise<TurnChatLine> {
    this.log.record('turns.say', send);
    const line: TurnChatLine = {
      from: this.summary.seats.find((s) => s.isMe)?.userId ?? 1,
      at: 0,
      text: send.text ?? send.quick ?? '',
      ...(send.quick === undefined ? {} : { quick: send.quick }),
    };
    this.chatFrom(line);
    return Promise.resolve(line);
  }

  /** The client's rule (core/turns/turn-game.ts): a due player past the deadline, or past handOverAt and not connected. */
  canLetComputerPlay(now = 0): boolean {
    const { summary, mySeat } = this;
    if (summary.phase !== 'playing' || mySeat === null) return false;
    const due = summary.seats.filter(
      (s) => summary.toAct.includes(s.seat) && s.seat !== mySeat && s.status === 'joined',
    );
    if (due.length === 0) return false;
    if (summary.deadline !== null && summary.deadline <= now) return true;
    const at = summary.handOverAt;
    return at !== undefined && at !== null && at <= now && due.some((s) => s.connected !== true);
  }

  /** The computer takes the due seats (it shows as `bot`). */
  letComputerPlay(): Promise<void> {
    this.log.record('turns.letComputerPlay');
    const due = new Set(this.summary.toAct);
    this.turnChanged({
      seats: this.summary.seats.map((s) => (due.has(s.seat) && !s.isMe ? { ...s, status: 'bot' } : s)),
      handOverAt: null,
    });
    return Promise.resolve();
  }

  rematch(): Promise<FakeTurnGame> {
    this.log.record('turns.rematch');
    return Promise.resolve(this.next());
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
    this.outcome = outcome;
    this.events.emit('ended', { outcome, view: this.view });
  }

  /** A seated player came or went (the seat's `connected`). */
  seatConnected(seat: number, connected: boolean): void {
    this.turnChanged({ seats: this.summary.seats.map((s) => (s.seat === seat ? { ...s, connected } : s)) });
  }

  /** A chat line arrived. */
  chatFrom(line: TurnChatLine): void {
    this.chat = [...this.chat, line];
    this.events.emit('chat', line);
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
    const g = this.games.get(id) ?? new FakeTurnGame(this.log, id, () => this.game(`tg-${this.games.size + 1}`));
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
