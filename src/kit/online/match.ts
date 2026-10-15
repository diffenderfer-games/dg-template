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
 * - `ended` is handled once; `closed` and `kicked` go to the title with words.
 * Plus the leave guard (`setBusy` during a live match), quiet during play and
 * presence (lobby: joinable with open seats; playing: watchable).
 */
import type { HubRoom, RoomInfo } from '@diffenderfer-games/hub';
import { fireAndForget } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { Json } from '../core/json.ts';
import type { TableLaunch } from '../core/planned.ts';
import { t } from '../core/strings.ts';
import { randomSeed } from '../rng/index.ts';
import { closedText } from './errors.ts';
import type { HostMatch, OnlineGame } from './types.ts';
import { envelope, fits, freshest, parseEnvelope, successorOf } from './wire.ts';

/** Send the host's state to the successor this often. */
export const BACKUP_MS = 2000;

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
  private backups: { at: number; d: Json }[] = [];
  private ended = false;
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

  constructor(
    hub: Pick<HubLike, 'rooms' | 'mp' | 'presence' | 'notify'>,
    game: OnlineGame,
    clock: Clock,
    on: MatchEvents,
  ) {
    this.hub = hub;
    this.game = game;
    this.clock = clock;
    this.on = on;
  }

  /** The room's code (null when not in one). */
  get code(): string | null {
    return this.room?.info.code ?? null;
  }

  /** Host a new room (for an invite's party, a table, or the Play online button). */
  async create(o: { mode?: string; partyId?: string; table?: TableLaunch } = {}): Promise<void> {
    const room = await this.hub.rooms.create({
      ...(o.mode === undefined ? {} : { mode: o.mode }),
      ...(o.partyId === undefined ? {} : { partyId: o.partyId }),
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

  /** Take back a seat held after a reload (the kit's boot calls it with a timeout). */
  async reclaim(): Promise<boolean> {
    const room = await this.hub.rooms.reclaim();
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
    this.playing = room.info.phase === 'playing';
    this.offs = [
      room.on('room', (info) => this.onRoom(info)),
      room.on('msg', (m) => this.onMessage(m.from, m.data)),
      room.on('seat', (s) => this.onSeat(s.userId, s.status)),
      room.on('abandoned', (a) => this.onSeat(a.userId, 'gone')),
      room.on('ended', (e) => this.onEnded(e.results)),
      room.on('closed', (c) => this.gone(closedText(c.reason))),
      room.on('kicked', () => this.gone(t('kicked'))),
    ];
    this.reportPresence();
    this.on.lobby(room.info, this.isHost);
  }

  private detach(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }

  private onRoom(info: RoomInfo): void {
    const wasHost = this.isHost;
    this.isHost = this.room?.me.host ?? false;
    if (this.isHost && !wasHost && this.playing && this.host === null) {
      const b = freshest(this.backups);
      this.host = b === null ? null : this.game.restore(b.d);
    }
    this.reportPresence();
    this.on.lobby(info, this.isHost);
  }

  private onMessage(from: number, data: Json): void {
    const e = parseEnvelope(data);
    if (e === null) return; // another version, or not ours: dropped, never misread
    if (e.t === 'in' && this.isHost) this.host?.apply(from, e.d);
    else if ((e.t === 'view' || e.t === 'pview') && !this.isHost && this.game.isView(e.d)) {
      if (e.t === 'view' && this.privateViews) return; // this seat gets its own view: it wins over the public one
      if (e.t === 'pview') this.privateViews = true;
      this.view = e.d;
      if (!this.playing) this.begin();
    } else if (e.t === 'backup' && !this.isHost) {
      this.backups = [...this.backups.slice(-2), { at: e.at, d: e.d }];
    }
  }

  private onSeat(userId: number, status: 'away' | 'back' | 'gone'): void {
    if (status === 'back') this.computerSeats.delete(userId);
    else this.computerSeats.add(userId);
    this.on.seat(userId, status);
  }

  private onEnded(results: Json | undefined): void {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.calm();
    this.on.ended(results);
  }

  private gone(text: string): void {
    this.detach();
    this.room = null;
    this.playing = false;
    this.calm();
    this.on.left(text);
  }

  private begin(): void {
    this.playing = true;
    this.hub.mp.setBusy(true, { label: 'a match' });
    this.hub.notify.setQuiet(true);
    this.reportPresence();
    this.on.playing();
  }

  private calm(): void {
    this.hub.mp.setBusy(false);
    this.hub.notify.setQuiet(false);
  }

  /** Report presence for the room (lobby: joinable with open seats; playing: watchable). */
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
        openSeats: Math.max(0, room.info.maxPlayers - room.info.seats.length),
      });
  }

  /** The host starts the match. */
  start(): void {
    const room = this.room;
    if (!room || !this.isHost || this.playing) return;
    fireAndForget(room.start());
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
      this.send(room, envelope('in', input, this.clock.now()));
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
    const next = successorOf(room.info);
    if (next !== null && now - this.lastBackup >= BACKUP_MS) {
      this.lastBackup = now;
      this.send(room, envelope('backup', host.backup(), now), next);
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
    this.detach();
    this.room = null;
    this.playing = false;
    this.host = null;
    this.calm();
    fireAndForget(room.leave());
  }
}
