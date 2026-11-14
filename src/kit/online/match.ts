/**
 * kit/online: one hub-room match (host runs the rules; guests send input and draw views).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "The match"
 *
 * Resilience (multiplayer.md §8 "away, back, gone"):
 * - an away or gone seat is played by the computer (the game's `computer`
 *   hook) and handed back on `back` with no reset; a match never ends because
 *   someone left;
 * - `room.me.host` is re-checked on every `room` event; the host keeps
 *   sending its state to the successor, which takes over from the freshest
 *   backup when the host role moves to it;
 * - a host back after a reload or a closed tab (the hub keeps its seat and its host role for the grace)
 *   carries the same match on: from this device's copy of it (saved every backup and as the page hides),
 *   else from the successor's backup, which it asks for (`want`) until a guest hands it back (`handoff`);
 *   inputs the copy already holds are not applied twice (`q`), and a guest keeps the inputs it makes while
 *   the host is away and sends them once the host's views come again;
 * - `ended` is handled once; `closed` and `kicked` go to the title with words.
 * Plus the leave guard (`setBusy` during a live match), quiet during play and
 * presence (lobby: joinable with open seats; playing: watchable).
 */
import type { HubRoom, RoomInfo } from '@diffenderfer-games/hub';
import { fireAndForget } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { Json } from '../core/json.ts';
import { localStore, scopedKey, type Store } from '../core/store.ts';
import type { TableLaunch } from '../core/planned.ts';
import { t } from '../core/strings.ts';
import { randomSeed } from '../rng/index.ts';
import { closedText } from './errors.ts';
import { hubNow, lobbyReadiness } from './ready.ts';
import type { HostMatch, OnlineGame } from './types.ts';
import {
  carryEnvelope,
  carryOf,
  envelope,
  fits,
  freshest,
  parseEnvelope,
  savedCarry,
  successorOf,
  type Carry,
} from './wire.ts';

/** Send the host's state to the successor (and keep this device's copy) this often. */
export const BACKUP_MS = 2000;

/** A host back without its match asks the guests for it this often, until one hands it back. */
export const WANT_MS = 2000;

/** The most inputs a guest keeps while the host is away (the newest; sent when the host is back). */
export const HELD_INPUTS = 10;

/** What the match tells the session. */
export type MatchEvents = {
  /** The lobby changed (seats, host). */
  lobby(info: RoomInfo, isHost: boolean): void;
  /** The match started (for guests: the first view arrived). */
  playing(): void;
  /** The match ended (once), with the host's results. */
  ended(results: Json | undefined): void;
  /** The room is gone for this tab (with words for the player), or the player left. */
  left(text: string | null): void;
  /** A seat went away / came back / is gone (the computer plays it meanwhile). */
  seat(userId: number, status: 'away' | 'back' | 'gone'): void;
  /** The hub closed the room a while after it ended (the player may still be on the results); without it, `left`. */
  closedAfterEnd?(): void;
};

/** A match in a hub room. */
export class OnlineMatch {
  room: HubRoom | null = null;
  isHost = false;
  me = 0;
  playing = false;
  /** The latest view to draw. */
  view: Json | null = null;
  readonly computerSeats = new Set<number>();
  private host: HostMatch | null = null;
  private backups: Carry[] = [];
  /** The match's id (the host picks it at the start; it rides on backups, so a restart would show). */
  matchId: string | null = null;
  /** Views drawn from the host (a guest's count). */
  viewsIn = 0;
  /** Host: the room `seq` of the last input in the state, and the floor below which replayed inputs are old. */
  private appliedSeq = 0;
  private seqFloor = 0;
  /** The next ask for the match, while the host waits for it (the play loop doesn't run on the loading screen). */
  private askAgain: (() => void) | null = null;
  /** Guest: the host is away (its seat dropped); inputs wait in `heldInputs` until its views come again. */
  private hostAway = false;
  private heldInputs: Json[] = [];
  private ended = false;
  /**
   * This page showed the match (`begin`). Apart from `playing`: a page that comes back into a room already
   * playing (a reload's reclaim, a rejoin) is `playing` from the start, and still shows play on its first view.
   */
  private begun = false;
  private tickAcc = 0;
  private lastBackup = 0;
  /** Host: the private view last sent to each seat. */
  private readonly sentPrivate = new Map<number, string>();
  /** Guest: the host sends this seat its own view. */
  private privateViews = false;
  private table: TableLaunch | undefined;
  private offs: (() => void)[] = [];
  private readonly hub: Pick<HubLike, 'rooms' | 'mp' | 'presence' | 'notify'>;
  private readonly game: OnlineGame;
  private readonly clock: Clock;
  private readonly on: MatchEvents;
  private readonly store: Store;

  constructor(
    hub: Pick<HubLike, 'rooms' | 'mp' | 'presence' | 'notify'>,
    game: OnlineGame,
    clock: Clock,
    on: MatchEvents,
    store: Store = localStore,
  ) {
    this.hub = hub;
    this.game = game;
    this.clock = clock;
    this.on = on;
    this.store = store;
  }

  /** Does this page run the match now? */
  get hosting(): boolean {
    return this.isHost && this.host !== null;
  }

  /** The room's code (null when not in one). */
  get code(): string | null {
    return this.room?.info.code ?? null;
  }

  /** Host a new room (for an invite's party, a table, With friends, or Play now's `public` one anyone can join). */
  async create(o: { mode?: string; partyId?: string; table?: TableLaunch; public?: boolean } = {}): Promise<void> {
    const room = await this.hub.rooms.create({
      ...(o.mode === undefined ? {} : { mode: o.mode }),
      ...(o.partyId === undefined ? {} : { partyId: o.partyId }),
      ...(o.public === true ? { public: true } : {}),
    });
    this.table = o.table;
    this.attach(room);
    if (o.partyId !== undefined) fireAndForget(this.hub.mp.setJoinInfo(o.partyId, { room: room.info.code }));
  }

  /** Already hosting: give an invite's party this room (multiplayer.md §6: "or share the room you're already in"). */
  shareRoom(partyId: string): void {
    const code = this.room?.info.code;
    if (code !== undefined) fireAndForget(this.hub.mp.setJoinInfo(partyId, { room: code }));
  }

  /** Join a room by code (as a spectator when watching). */
  async join(code: string, spectate = false): Promise<void> {
    this.attach(await this.hub.rooms.join(code, { spectate }));
  }

  /** Take back a seat held after a reload (the kit's boot calls it with a timeout; `early`: the hub already asked, as the page started). */
  async reclaim(early?: Promise<HubRoom | null>): Promise<boolean> {
    const room = await (early ?? this.hub.rooms.reclaim());
    if (room === null) return false;
    this.attach(room);
    return true;
  }

  private attach(room: HubRoom): void {
    this.detach();
    this.room = room;
    this.me = room.me.userId;
    this.isHost = room.me.host;
    this.ended = false;
    this.begun = false;
    this.playing = room.info.phase === 'playing';
    this.offs = [
      room.on('room', (info) => this.onRoom(info)),
      room.on('msg', (m) => this.onMessage(m.from, m.data, m.seq)),
      room.on('seat', (s) => this.onSeat(s.userId, s.status)),
      room.on('abandoned', (a) => this.onSeat(a.userId, 'gone')),
      room.on('ended', (e) => this.onEnded(e.results)),
      room.on('closed', (c) => this.onClosed(c.reason)),
      room.on('kicked', () => this.gone(t('kicked'))),
    ];
    this.hostAway = this.hostSeatDropped(room.info);
    this.reportPresence();
    this.on.lobby(room.info, this.isHost);
    this.resume();
  }

  private detach(): void {
    this.stopAsking();
    for (const off of this.offs) off();
    this.offs = [];
  }

  /** Move to another room (a rematch's): the old room's listeners go, the match starts afresh in the new one's lobby. */
  adopt(room: HubRoom): void {
    this.calm();
    this.forget();
    this.host = null;
    this.view = null;
    this.matchId = null;
    this.viewsIn = 0;
    this.heldInputs = [];
    this.backups = [];
    this.sentPrivate.clear();
    this.privateViews = false;
    this.computerSeats.clear();
    this.table = undefined;
    this.attach(room);
  }

  /** A guest says it is ready (or not). */
  ready(on: boolean): void {
    const room = this.room;
    if (room && !this.isHost && room.info.phase === 'lobby') fireAndForget(room.ready(on));
  }

  /** Whether the match has ended (the result screen shows). */
  get over(): boolean {
    return this.ended;
  }

  private onClosed(reason: string): void {
    if (this.ended && reason === 'ended' && this.on.closedAfterEnd !== undefined) {
      this.detach();
      this.room = null;
      this.on.closedAfterEnd();
      return;
    }
    this.gone(closedText(reason));
  }

  private onRoom(info: RoomInfo): void {
    const wasHost = this.isHost;
    this.isHost = this.room?.me.host ?? false;
    if (this.hostSeatDropped(info)) this.hostAway = true;
    this.reportPresence();
    this.on.lobby(info, this.isHost);
    if (this.isHost && !wasHost) this.resume();
  }

  private hostSeatDropped(info: RoomInfo): boolean {
    return !this.isHost && info.seats.some((s) => s.userId === info.hostId && !s.connected);
  }

  /**
   * The host in a match it has no state for (a reload, a closed tab, the role moved here): this device's
   * copy of the match or the freshest backup held here, whichever is newer; else ask the guests (`want`,
   * again each WANT_MS) until one hands it back.
   */
  private resume(): void {
    const room = this.room;
    if (room === null || !this.isHost || !this.playing || this.ended || this.host !== null) return;
    const saved = savedCarry(this.store.getJson(this.savedKey(room)), room.info.id);
    const backup = freshest(this.backups);
    const best = saved !== null && (backup === null || saved.at >= backup.at) ? saved : backup;
    if (best === null || !this.takeOver(best)) this.askForMatch(room);
  }

  /** Carry the match on from `c`: the computer keeps the seats it played and any still dropped (false: not a valid state). */
  private takeOver(c: Carry): boolean {
    const host = this.game.restore(c.s);
    if (host === null) return false;
    this.host = host;
    this.matchId = c.m;
    this.appliedSeq = c.q;
    this.seqFloor = c.q;
    const dropped = this.room?.info.seats.filter((s) => !s.connected).map((s) => s.userId) ?? [];
    for (const seat of [...c.cs, ...dropped]) this.computerSeats.add(seat);
    this.computerSeats.delete(this.me);
    this.view = host.view(this.me);
    if (!this.begun) this.begin();
    return true;
  }

  private askForMatch(room: HubRoom): void {
    this.stopAsking();
    this.send(room, envelope('want', null, this.clock.now()));
    this.askAgain = this.clock.after(WANT_MS, () => {
      this.askAgain = null;
      if (this.room === room && this.isHost && this.host === null && this.playing && !this.ended)
        this.askForMatch(room);
    });
  }

  private stopAsking(): void {
    this.askAgain?.();
    this.askAgain = null;
  }

  private onMessage(from: number, data: Json, seq: number): void {
    const e = parseEnvelope(data);
    if (e === null) return; // another version, or not ours: dropped, never misread
    if (e.t === 'in' && this.isHost) {
      if (seq <= this.seqFloor) return; // replayed to a returning host: already in the state it carried on from
      if (this.host?.apply(from, e.d) === true) this.appliedSeq = Math.max(this.appliedSeq, seq);
    } else if ((e.t === 'view' || e.t === 'pview') && !this.isHost && this.game.isView(e.d)) {
      if (e.t === 'view' && this.privateViews) return; // this seat gets its own view: it wins over the public one
      if (e.t === 'pview') this.privateViews = true;
      this.view = e.d;
      this.viewsIn++;
      if (this.hostAway) this.hostBack();
      if (!this.begun) this.begin();
    } else if (e.t === 'backup' && !this.isHost) {
      const c = carryOf(e);
      this.backups = [...this.backups.slice(-2), c];
      if (c.m !== null) this.matchId = c.m;
    } else if (e.t === 'want' && !this.isHost) {
      const b = freshest(this.backups);
      if (b !== null && this.room !== null) this.send(this.room, carryEnvelope('handoff', b), from);
    } else if (e.t === 'handoff' && this.isHost && this.host === null && this.playing && !this.ended) {
      this.takeOver(carryOf(e));
    }
  }

  /** Guest: the host's views come again: the inputs made meanwhile go now, in order. */
  private hostBack(): void {
    this.hostAway = false;
    const room = this.room;
    const held = this.heldInputs;
    this.heldInputs = [];
    if (room === null) return;
    for (const input of held) this.send(room, envelope('in', input, this.clock.now()));
  }

  private onSeat(userId: number, status: 'away' | 'back' | 'gone'): void {
    if (status === 'back') this.computerSeats.delete(userId);
    else this.computerSeats.add(userId);
    if (status !== 'back' && !this.isHost && userId === this.room?.info.hostId) this.hostAway = true;
    this.on.seat(userId, status);
  }

  /** This device's copy of the match it hosts (one per game and account). */
  private savedKey(room: HubRoom): string {
    return scopedKey(room.info.game, 'online-match', this.me);
  }

  private carry(host: HostMatch, at: number): Carry {
    return { s: host.backup(), at, m: this.matchId, q: this.appliedSeq, cs: [...this.computerSeats] };
  }

  /** Host: keep this device's copy of the match now (every backup, and as the page hides or closes). */
  keep(): void {
    const room = this.room;
    if (room === null || !this.isHost || this.host === null || this.ended) return;
    this.store.setJson(this.savedKey(room), { room: room.info.id, ...this.carry(this.host, this.clock.now()) });
  }

  /** The match is over or left: this device's copy goes. */
  private forget(): void {
    const room = this.room;
    if (room !== null) this.store.remove(this.savedKey(room));
  }

  private onEnded(results: Json | undefined): void {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.forget();
    this.calm();
    this.on.ended(results);
  }

  private gone(text: string): void {
    this.forget();
    this.detach();
    this.room = null;
    this.playing = false;
    this.calm();
    this.on.left(text);
  }

  private begin(): void {
    this.playing = true;
    this.begun = true;
    this.hub.mp.setBusy(true, { label: 'a match' });
    this.hub.notify.setQuiet(true);
    this.reportPresence();
    this.on.playing();
  }

  private calm(): void {
    this.hub.mp.setBusy(false);
    this.hub.notify.setQuiet(false);
  }

  /** Report presence for the room (lobby: joinable with open seats, and `public` for a room anyone can join; playing: watchable). */
  reportPresence(): void {
    const room = this.room;
    if (!room) return;
    if (this.playing)
      this.hub.presence.set({ kind: 'playing', room: room.info.code, joinable: false, watchable: true });
    else
      this.hub.presence.set({
        kind: 'lobby',
        room: room.info.code,
        joinable: true,
        public: room.info.public,
        openSeats: Math.max(0, room.info.maxPlayers - room.info.seats.length),
      });
  }

  /** The host starts the match. */
  start(): void {
    const room = this.room;
    if (!room || !this.isHost || this.playing) return;
    // The hub starts a room only once every guest is ready (or seated a minute): never a match it refused.
    if (lobbyReadiness(room.info, 0, hubNow(room.info, this.clock.now())).waiting.length > 0) return;
    fireAndForget(room.start());
    this.matchId = randomSeed().toString(36);
    this.appliedSeq = 0;
    this.seqFloor = 0;
    const seats = room.info.seats.map((s) => s.userId);
    this.host = this.game.start({
      seats,
      seed: randomSeed(),
      ...(room.info.mode === undefined ? {} : { mode: room.info.mode }),
      ...(this.table === undefined ? {} : { table: this.table }),
    });
    this.view = this.host.view(this.me);
    this.begin();
  }

  /** One frame: the host simulates and broadcasts; guests send their input. */
  frame(dt: number): void {
    const room = this.room;
    if (!room || !this.playing || this.ended) return;
    this.tickAcc += dt;
    const tick = this.tickAcc >= 1 / this.game.tickHz;
    if (tick) this.tickAcc = 0;
    const input = this.game.input();
    if (this.isHost && this.host) {
      if (input !== null) this.host.apply(this.me, input);
      this.host.step(dt, this.computerSeats);
      this.view = this.host.view(this.me);
      if (tick) this.broadcast(room, this.host);
      const result = this.host.outcome();
      if (result !== null) {
        this.broadcast(room, this.host);
        fireAndForget(room.end({ winners: result.winners }));
      }
    } else if (tick && input !== null && !room.me.spectator) {
      if (this.hostAway) this.heldInputs = [...this.heldInputs, input].slice(-HELD_INPUTS);
      else this.send(room, envelope('in', input, this.clock.now()));
    }
  }

  private broadcast(room: HubRoom, host: HostMatch): void {
    const now = this.clock.now();
    const pub = host.view(null);
    this.send(room, envelope('view', pub, now));
    const pubText = JSON.stringify(pub);
    for (const s of room.info.seats) {
      if (s.userId === this.me) continue;
      const mine = host.view(s.userId);
      const text = JSON.stringify(mine);
      if (text === pubText || this.sentPrivate.get(s.userId) === text) continue;
      this.sentPrivate.set(s.userId, text);
      this.send(room, envelope('pview', mine, now), s.userId);
    }
    if (now - this.lastBackup >= BACKUP_MS) {
      this.lastBackup = now;
      this.keep();
      const next = successorOf(room.info);
      if (next !== null) this.send(room, carryEnvelope('backup', this.carry(host, now)), next);
    }
  }

  private send(room: HubRoom, e: ReturnType<typeof envelope>, to?: number): void {
    if (!fits(e)) return;
    fireAndForget(room.send(e, to === undefined ? {} : { to }));
  }

  /** Leave the room (Leave button, the title, another launch). */
  leave(): void {
    const room = this.room;
    if (!room) return;
    this.forget();
    this.detach();
    this.room = null;
    this.playing = false;
    this.host = null;
    this.calm();
    fireAndForget(room.leave());
  }
}
