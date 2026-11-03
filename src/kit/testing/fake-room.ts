/**
 * kit/testing: hub relay rooms.
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour copied from multiplayer.md §8: seats keyed by user, the host role
 * on `info.hostId`, `seat` away/back/gone, `ended` once to every client,
 * `closed` with a reason, chat that is delivered (maybe softened) or rejected
 * with a hint. Limits: 8 KB per message, 32 KB of state.
 */
import type {
  HubRoom,
  Json,
  RoomCreateOptions,
  RoomEvents,
  RoomInfo,
  RoomListOptions,
  RoomSeat,
  RoomSelf,
  RoomSendOptions,
  RoomStartOptions,
  RoomState,
  RoomStateOptions,
} from '@diffenderfer-games/hub';
import { Emitter } from '../core/emitter.ts';
import type { RoomsLike } from '../core/hub-like.ts';
import type { CallLog } from './calls.ts';
import { rematchOf } from '../online/ready.ts';
import { fakeRoomInfo, fakeSeat } from './fake-room-info.ts';

/** An error shaped like the hub's `HubError` (the kit reads `code`, `status`, `hint`, `retryAfterMs`). */
export function fakeHubError(
  code: string,
  extra: { status?: number; hint?: string; retryAfterMs?: number; reason?: string } = {},
): Error {
  return Object.assign(new Error(code), {
    name: 'HubError',
    code,
    status: extra.status ?? 400,
    ...extra,
    isOffline: code === 'offline',
  });
}

/** How a chat send turns out in the fake. */
export type ChatOutcome =
  { kind: 'deliver' } | { kind: 'soften'; text: string } | { kind: 'reject'; hint: string; retryAfterMs?: number };

/** One fake room, from one player's point of view. */
export class FakeRoom implements HubRoom {
  info: RoomInfo;
  state: RoomState = {};
  me: RoomSelf;
  left = false;
  ended = false;
  sent: { data: Json; to?: number }[] = [];
  /** What the next `chat` does. */
  chatOutcome: ChatOutcome = { kind: 'deliver' };
  private readonly events = new Emitter<{ [K in keyof RoomEvents]: RoomEvents[K] }>();
  private readonly log: CallLog;

  constructor(log: CallLog, me: RoomSelf, info: RoomInfo) {
    this.log = log;
    this.me = me;
    this.info = info;
  }

  seats(): RoomSeat[] {
    return this.info.seats;
  }

  on<K extends keyof RoomEvents>(event: K, listener: (payload: RoomEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  ready(isReady: boolean): Promise<void> {
    this.log.record('room.ready', isReady);
    const me = this.me.userId;
    this.setInfo({ seats: this.info.seats.map((s) => (s.userId === me ? { ...s, ready: isReady } : s)) });
    return Promise.resolve();
  }

  // ---- the newer hub's calls (left off with `older`) ----------------------------

  /** The rematch room `rematch()` resolves (set by FakeRooms). */
  rematchRoom: (() => Promise<HubRoom>) | null = null;

  /** Host only, in the lobby: hand the host role to a seated, connected player (absent on an older hub). */
  setHost?: (userId: number) => Promise<void>;
  /** On an ended room: join its rematch room, or start it (absent on an older hub). */
  rematch?: () => Promise<HubRoom>;

  /** The newer hub's calls on this room (FakeRooms leaves them off with `older`). */
  newer(): this {
    this.setHost = (userId) => this.fakeSetHost(userId);
    this.rematch = () => this.fakeRematch();
    return this;
  }

  private fakeSetHost(userId: number): Promise<void> {
    this.log.record('room.setHost', userId);
    if (!this.me.host || this.info.phase !== 'lobby') return Promise.reject(fakeHubError('not_host', { status: 403 }));
    if (!this.info.seats.some((s) => s.userId === userId && s.connected))
      return Promise.reject(fakeHubError('not_seated', { status: 409 }));
    this.setInfo({ hostId: userId });
    return Promise.resolve();
  }

  private fakeRematch(): Promise<HubRoom> {
    this.log.record('room.rematch');
    if (this.info.phase !== 'ended' || this.rematchRoom === null)
      return Promise.reject(fakeHubError('not_ended', { status: 409 }));
    this.left = true;
    return this.rematchRoom();
  }

  seat(seatData: Json): Promise<void> {
    this.log.record('room.seat', seatData);
    return Promise.resolve();
  }

  start(options?: RoomStartOptions): Promise<void> {
    if (options?.options === undefined) this.log.record('room.start');
    else this.log.record('room.start', options.options);
    this.setInfo({ phase: 'playing' });
    return Promise.resolve();
  }

  send(message: Json, options?: RoomSendOptions): Promise<void> {
    if (JSON.stringify(message).length > 8 * 1024) return Promise.reject(fakeHubError('too_large', { status: 413 }));
    this.log.record('room.send', message, options?.to);
    this.sent.push(options?.to === undefined ? { data: message } : { data: message, to: options.to });
    return Promise.resolve();
  }

  setState(patch: RoomState, options?: RoomStateOptions): Promise<void> {
    this.log.record('room.setState', patch, options?.replace === true);
    this.state = options?.replace === true ? { ...patch } : { ...this.state, ...patch };
    return Promise.resolve();
  }

  chat(text: string): Promise<string> {
    this.log.record('room.chat', text);
    const o = this.chatOutcome;
    if (o.kind === 'reject') {
      const extra =
        o.retryAfterMs === undefined
          ? { hint: o.hint, status: 422 }
          : { hint: o.hint, status: 422, retryAfterMs: o.retryAfterMs };
      return Promise.reject(fakeHubError('content_rejected', extra));
    }
    const delivered = o.kind === 'soften' ? o.text : text;
    this.events.emit(
      'chat',
      o.kind === 'soften'
        ? { text: delivered, from: this.me.userId, softened: true }
        : { text: delivered, from: this.me.userId },
    );
    return Promise.resolve(delivered);
  }

  quick(phraseId: string): Promise<void> {
    this.log.record('room.quick', phraseId);
    return Promise.resolve();
  }

  kick(userId: number): Promise<void> {
    this.log.record('room.kick', userId);
    return Promise.resolve();
  }

  leave(): Promise<void> {
    this.log.record('room.leave');
    this.left = true;
    return Promise.resolve();
  }

  end(results?: Json): Promise<void> {
    this.log.record('room.end', results);
    this.setInfo({ phase: 'ended' });
    this.events.emit('ended', results === undefined ? { room: this.info } : { room: this.info, results });
    return Promise.resolve();
  }

  // ---- drivers -------------------------------------------------------------

  /** The room changed (roster, phase, host); the `room` event. */
  setInfo(patch: Partial<RoomInfo>): void {
    this.info = { ...this.info, ...patch };
    this.me = { ...this.me, host: this.info.hostId === this.me.userId };
    this.events.emit('room', this.info);
  }

  /** Another player sits down (`extra`: `ready`, `joinedAt`…). */
  addSeat(userId: number, extra: Parameters<typeof fakeSeat>[1] = {}): void {
    this.setInfo({ seats: [...this.info.seats, fakeSeat(userId, extra)] });
  }

  /** Another player's seat changes (`ready`, `connected`, `joinedAt`). */
  patchSeat(userId: number, patch: Parameters<typeof fakeSeat>[1]): void {
    this.setInfo({ seats: this.info.seats.map((s) => (s.userId === userId ? { ...s, ...patch } : s)) });
  }

  /** Someone started (or joined) this ended room's rematch: `info.rematch`, as the newer hub sends it. */
  rematchBy(hostId: number, userIds: number[], code = 'REMAT'): void {
    const patch: Partial<RoomInfo> & { rematch: { code: string; hostId: number; userIds: number[] } } = {
      rematch: { code, hostId, userIds },
    };
    this.setInfo(patch);
  }

  /** A relayed message from `from`. */
  receive(from: number, data: Json, seq = 1): void {
    this.events.emit('msg', { from, data, seq });
  }

  /** A seat went away, came back or is gone. */
  seatChange(userId: number, status: 'away' | 'back' | 'gone'): void {
    const connected = status === 'back';
    this.info = { ...this.info, seats: this.info.seats.map((s) => (s.userId === userId ? { ...s, connected } : s)) };
    this.events.emit('seat', { userId, status });
    if (status === 'gone') this.events.emit('abandoned', { userId });
  }

  /** Someone else delivered a chat line. */
  chatFrom(from: number, text: string, softened = false): void {
    this.events.emit('chat', softened ? { text, from, softened: true } : { text, from });
  }

  /** The room is gone for this tab. */
  close(reason: string): void {
    this.events.emit('closed', { reason });
  }

  /** The host removed this player. */
  kicked(): void {
    this.events.emit('kicked', { roomId: this.info.id });
  }

  /** Another client ended the game (every client gets `ended` once). */
  endedBy(results?: Json): void {
    this.setInfo({ phase: 'ended' });
    this.events.emit('ended', results === undefined ? { room: this.info } : { room: this.info, results });
  }
}

/** The fake `hub.rooms`: rooms are created as host, joined as guest. */
export class FakeRooms implements RoomsLike {
  current: FakeRoom | null = null;
  /** Set to make the next `join` fail with this hub error code (`room_not_found`, `room_full`…). */
  joinError: string | null = null;
  /** What `reclaim` resolves (a held seat after a reload). */
  held: FakeRoom | null = null;
  /** Public rooms waiting in their lobby (`list`); `listError` makes `list` reject (an older hub). */
  open: RoomInfo[] = [];
  listError = false;
  /** Codes whose `join` fails with `room_full` (taken meanwhile). */
  readonly full = new Set<string>();
  /** An older hub: rooms without `setHost`, `rematch` or seats' `joinedAt`. */
  older = false;
  private readonly log: CallLog;
  private readonly host: {
    readonly slug: string;
    readonly userId: number;
    readonly offline: boolean;
    readonly now?: () => number;
  };

  constructor(
    log: CallLog,
    host: { readonly slug: string; readonly userId: number; readonly offline: boolean; readonly now?: () => number },
  ) {
    this.log = log;
    this.host = host;
  }

  /** My seat, with `joinedAt` on a newer hub. */
  private mySeat(): RoomSeat {
    return this.older ? fakeSeat(this.host.userId) : fakeSeat(this.host.userId, { joinedAt: this.host.now?.() ?? 0 });
  }

  /** A room for this page: the newer hub's calls unless `older`; `rematch()` joins or starts the rematch room. */
  private room(me: RoomSelf, info: RoomInfo): FakeRoom {
    const room = new FakeRoom(this.log, me, info);
    if (this.older) return room;
    room.newer();
    room.rematchRoom = () => {
      const r = rematchOf(room.info);
      const userId = this.host.userId;
      const hostId = r === null ? userId : r.hostId;
      const others = r === null ? [] : r.userIds.filter((id) => id !== userId);
      const next = fakeRoomInfo({
        id: 'room-rematch',
        code: r?.code ?? 'REMAT',
        game: this.host.slug,
        hostId,
        seats: [...others.map((id) => fakeSeat(id, { joinedAt: this.host.now?.() ?? 0 })), this.mySeat()],
      });
      this.current = this.room({ userId, host: hostId === userId, spectator: false }, next);
      return Promise.resolve(this.current);
    };
    return room;
  }

  create(options: RoomCreateOptions = {}): Promise<HubRoom> {
    this.log.record('rooms.create', options);
    if (this.host.offline) return Promise.reject(fakeHubError('offline', { status: 0 }));
    const info = fakeRoomInfo({
      game: this.host.slug,
      hostId: this.host.userId,
      seats: [this.mySeat()],
      public: options.public === true,
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    });
    this.current = this.room({ userId: this.host.userId, host: true, spectator: false }, info);
    return Promise.resolve(this.current);
  }

  join(codeOrId: string, options: { spectate?: boolean } = {}): Promise<HubRoom> {
    this.log.record('rooms.join', codeOrId, options.spectate === true);
    if (this.host.offline) return Promise.reject(fakeHubError('offline', { status: 0 }));
    if (this.joinError !== null) {
      const code = this.joinError;
      this.joinError = null;
      return Promise.reject(fakeHubError(code, { status: 404 }));
    }
    if (this.full.has(codeOrId)) return Promise.reject(fakeHubError('room_full', { status: 409 }));
    const listed = this.open.find((r) => r.code === codeOrId || r.id === codeOrId);
    const hostId = listed?.hostId ?? (this.host.userId === 1 ? 2 : 1);
    const info = fakeRoomInfo({
      ...listed,
      code: listed?.code ?? codeOrId,
      game: this.host.slug,
      hostId,
      seats: [...(listed?.seats ?? [fakeSeat(hostId)]), this.mySeat()],
    });
    this.current = this.room({ userId: this.host.userId, host: false, spectator: options.spectate === true }, info);
    return Promise.resolve(this.current);
  }

  list(options: RoomListOptions = {}): Promise<RoomInfo[]> {
    this.log.record('rooms.list', options);
    if (this.host.offline) return Promise.reject(fakeHubError('offline', { status: 0 }));
    if (this.listError) return Promise.reject(fakeHubError('not_found', { status: 404 }));
    return Promise.resolve(this.open.filter((r) => options.mode === undefined || r.mode === options.mode));
  }

  reclaim(): Promise<HubRoom | null> {
    this.log.record('rooms.reclaim');
    this.current = this.held;
    return Promise.resolve(this.held);
  }
}
