/**
 * kit/live: a live game's match, from its hub-room lobby to the result.
 * Source: dg-template src/kit/live/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/live.md § "The page flow"
 *
 * The room is the lobby (invites, chat, presence, reconnects: the online
 * flow's). Each player's own choices go in their seat (`room.seat`); the host
 * shares the match options in the room's state, so everyone sees them, and
 * passes them to `room.start`, which places the match on the hub's live
 * server (docs/multiplayer.md §17). When the room plays, every page builds
 * what the options need (`prepare`, with a loading screen), joins the live
 * match (`live.join`) and plays it; a dropped connection joins again. The
 * hub ends the room with the places when the sim's outcome says so.
 *
 * Every way in ends on a screen the player can use: a match the live server no
 * longer has (it ended, everyone left, the server restarted) or a room that
 * ended before this page got into its match takes the player back with "That
 * match has ended"; a match not on screen within {@link LOAD_LIMIT_MS} does too.
 */
import type { HubRoom, RoomInfo } from '@diffenderfer-games/hub';
import { joinLiveRoom, type LiveMatch } from '@diffenderfer-games/hub/live';
import { fireAndForget } from '../core/async.ts';
import type { HubLike } from '../core/hub-like.ts';
import { field, isJsonObject, jsonEqual, type Json, type JsonObject } from '../core/json.ts';
import { t } from '../core/strings.ts';
import { randomSeed } from '../rng/index.ts';
import { closedText, errText } from '../online/errors.ts';
import type { LiveRoomGame, LiveStart } from './types.ts';

/** Joining again after a drop: the first wait, ms (doubling to {@link REJOIN_MAX_MS}). */
const REJOIN_FIRST_MS = 500;
const REJOIN_MAX_MS = 8000;
/** Joins that may fail in a row before the player is told and taken back to the title. */
const REJOIN_TRIES = 8;
/** The longest a match may take to be on screen (built and joined) before the player is taken back. */
export const LOAD_LIMIT_MS = 90_000;

/**
 * The live server's refusal code at the start of a failed join's words (`no_match: This game is
 * over.`), or null. `no_match`: it has no such match any more; `version`: the page is out of date.
 */
export function refusalCode(e: unknown): string | null {
  const words = e instanceof Error ? e.message : '';
  return /^([a-z_]+)(?::|$)/.exec(words)?.[1] ?? null;
}

/** What the match tells the flow. */
export type LiveRoomEvents = {
  /** The lobby changed (seats, host, the options). */
  lobby(info: RoomInfo, isHost: boolean): void;
  /** Building the match (0…1, with what is happening). */
  loading(fraction: number, label: string): void;
  /** Joined: the match is on screen. */
  playing(): void;
  /** The room ended (once), with the hub's `{ places, winnerId }`. */
  ended(results: Json | undefined): void;
  /** The room is gone for this tab, or the player left (with words, or null). */
  left(text: string | null): void;
  /** Something didn't work (words for a toast); the player stays where they are. */
  problem(text: string): void;
};

/** A live game's room and its match. */
export class LiveRoomMatch {
  room: HubRoom | null = null;
  isHost = false;
  me = 0;
  playing = false;
  /** The match's start (once the room plays). */
  matchStart: LiveStart | null = null;
  /** (kit/online's latest view; a live match is drawn from its own view) */
  readonly view = null;
  private match: LiveMatch | null = null;
  private ended = false;
  private entering = false;
  /** This page got into the room's match (once, since it was attached). */
  private joined = false;
  /** Takes the player back when the match isn't on screen in time. */
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  /** Counts attaches: a build begun for an earlier one (a reload's reclaim, then its rejoin launch) is let go. */
  private epoch = 0;
  private tries = 0;
  private sharedOptions: JsonObject | null = null;
  private offs: (() => void)[] = [];
  private readonly hub: Pick<HubLike, 'rooms' | 'mp' | 'presence' | 'notify'>;
  private readonly game: LiveRoomGame;
  private readonly on: LiveRoomEvents;

  constructor(hub: Pick<HubLike, 'rooms' | 'mp' | 'presence' | 'notify'>, game: LiveRoomGame, on: LiveRoomEvents) {
    this.hub = hub;
    this.game = game;
    this.on = on;
  }

  get code(): string | null {
    return this.room?.info.code ?? null;
  }

  /** The options the host picked (what the lobby shows), or null before they're shared. */
  get options(): JsonObject | null {
    const shared = field(this.room?.state, 'options');
    return isJsonObject(shared) ? shared : null;
  }

  /** Host a room (With friends, Play now's public one, an invite's party). */
  async create(o: { mode?: string; partyId?: string; public?: boolean } = {}): Promise<void> {
    const room = await this.hub.rooms.create({
      ...(o.mode === undefined ? {} : { mode: o.mode }),
      ...(o.partyId === undefined ? {} : { partyId: o.partyId }),
      ...(o.public === true ? { public: true } : {}),
    });
    this.attach(room);
    if (o.partyId !== undefined) fireAndForget(this.hub.mp.setJoinInfo(o.partyId, { room: room.info.code }));
  }

  /** Already hosting: give an invite's party this room. */
  shareRoom(partyId: string): void {
    const code = this.code;
    if (code !== null) fireAndForget(this.hub.mp.setJoinInfo(partyId, { room: code }));
  }

  /** Join a room by code (live matches have no spectators yet: a Watch takes a seat like a Join). */
  async join(code: string, _spectate = false): Promise<void> {
    this.attach(await this.hub.rooms.join(code, { spectate: false }));
  }

  /** Take back a seat held after a reload (`early`: the hub already asked, as the page started). */
  async reclaim(early?: Promise<HubRoom | null>): Promise<boolean> {
    const room = await (early ?? this.hub.rooms.reclaim());
    if (room === null) return false;
    this.attach(room);
    return true;
  }

  private attach(room: HubRoom): void {
    this.detach();
    this.epoch += 1;
    this.entering = false;
    this.room = room;
    this.me = room.me.userId;
    this.isHost = room.me.host;
    this.ended = false;
    this.joined = false;
    this.playing = false;
    this.matchStart = null;
    this.sharedOptions = null;
    this.offs = [
      room.on('room', (info) => this.onRoom(info)),
      room.on('state', () => this.on.lobby(room.info, this.isHost)),
      room.on('ended', (e) => this.onEnded(e.results)),
      room.on('closed', (c) => this.gone(closedText(c.reason))),
      room.on('kicked', () => this.gone(t('kicked'))),
    ];
    // My choices in my seat; being here is being ready (the host can start once everyone is).
    fireAndForget(room.seat(this.game.seat()));
    if (!this.isHost) fireAndForget(room.ready(true));
    this.shareOptions();
    this.reportPresence();
    if (room.info.phase === 'playing') this.enter();
    else this.on.lobby(room.info, this.isHost);
  }

  private detach(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.stopLoadTimer();
  }

  private stopLoadTimer(): void {
    if (this.loadTimer !== null) clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  /** Take the player back to the title with words (the room is left). */
  private giveUp(text: string): void {
    this.entering = false;
    this.leave();
    this.on.left(text);
  }

  /** The host shares the options it would start with (everyone's lobby shows them). */
  private shareOptions(): void {
    const room = this.room;
    if (!room || !this.isHost || room.info.phase !== 'lobby') return;
    const options = this.game.options();
    if (this.sharedOptions !== null && jsonEqual(this.sharedOptions, options)) return;
    this.sharedOptions = options;
    fireAndForget(room.setState({ options }));
  }

  /** My choices (and, for the host, the options) changed in the lobby: tell the room. */
  update(): void {
    if (this.room?.info.phase !== 'lobby') return;
    fireAndForget(this.room.seat(this.game.seat()));
    this.shareOptions();
  }

  private onRoom(info: RoomInfo): void {
    this.isHost = this.room?.me.host ?? false;
    this.shareOptions();
    this.reportPresence();
    if (info.phase === 'playing' && !this.playing && !this.entering && !this.ended) this.enter();
    else if (info.phase === 'lobby') this.on.lobby(info, this.isHost);
  }

  /** Host: start the match with the options now (the hub places it, then the room plays). */
  start(): void {
    void this.begin();
  }

  private async begin(): Promise<void> {
    const room = this.room;
    if (!room || !this.isHost || room.info.phase !== 'lobby') return;
    const options = this.game.options();
    try {
      await room.setState({ options });
      await room.start({ options });
    } catch (e) {
      this.on.problem(errText(e));
    }
  }

  /** The room plays: build what the match needs, then join it. */
  private enter(): void {
    const room = this.room;
    if (!room || this.entering) return;
    this.entering = true;
    this.playing = true;
    this.hub.mp.setBusy(true, { label: 'a match' });
    this.hub.notify.setQuiet(true);
    this.reportPresence();
    const start: LiveStart = {
      room: room.info.code,
      seats: room.info.seats.map((s) => ({
        userId: s.userId,
        name: s.name,
        look: s.look,
        data: isJsonObject(s.data) ? s.data : null,
      })),
      me: room.info.seats.findIndex((s) => s.userId === this.me),
      options: this.options ?? this.game.options(),
    };
    this.matchStart = start;
    this.on.loading(0, t('liveGettingReady'));
    const epoch = this.epoch;
    const current = (): boolean => epoch === this.epoch && !this.ended;
    // Never an endless loading screen: not in the match in time, the player is taken back.
    this.loadTimer ??= setTimeout(() => {
      this.loadTimer = null;
      if (current() && this.match === null) this.giveUp(t('liveNoJoin'));
    }, LOAD_LIMIT_MS);
    void this.game
      .prepare(start, (fraction, label) => {
        if (current()) this.on.loading(fraction, label);
      })
      .then(() => (current() ? this.connect() : undefined))
      .catch((e: unknown) => {
        // Building it failed: try again a few times, then take the player back (the match goes on without them).
        if (!current()) return;
        this.entering = false;
        this.tries += 1;
        if (this.tries >= REJOIN_TRIES) {
          this.giveUp(errText(e));
          return;
        }
        setTimeout(
          () => {
            if (current() && this.match === null) this.enter();
          },
          REJOIN_FIRST_MS * 2 ** Math.min(this.tries, 4),
        );
      });
  }

  /** Join the live match (again after a drop), backing off between tries. */
  private async connect(): Promise<void> {
    const room = this.room;
    const start = this.matchStart;
    if (!room || !start || this.ended) return;
    this.on.loading(1, t('liveJoining'));
    try {
      const match = await joinLiveRoom(room, { sim: this.game.sim });
      if (this.room !== room || this.ended) {
        match.leave();
        return;
      }
      this.match = match;
      this.joined = true;
      this.tries = 0;
      this.entering = false;
      this.stopLoadTimer();
      match.onClose(() => {
        if (this.match !== match) return;
        this.match = null;
        if (!this.ended && this.room === room) this.retry();
      });
      this.game.play(match, start);
      this.on.playing();
    } catch (e) {
      if (this.room !== room || this.ended) return;
      // The live server no longer has this match (it ended, everyone left, it restarted), or the page is out of date: no use trying again.
      const refused = refusalCode(e);
      if (refused === 'no_match' || refused === 'version') {
        this.giveUp(refused === 'version' ? t('liveUpdated') : t('liveOver'));
        return;
      }
      if (this.tries >= REJOIN_TRIES) {
        this.giveUp(errText(e));
        return;
      }
      this.retry();
    }
  }

  private retry(): void {
    // (spread out, so pages that dropped together don't all come back at once)
    const wait = Math.min(REJOIN_MAX_MS, REJOIN_FIRST_MS * 2 ** this.tries) * (0.75 + (randomSeed() % 1000) / 2000);
    this.tries += 1;
    setTimeout(() => void this.connect(), wait);
  }

  private onEnded(results: Json | undefined): void {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.entering = false;
    this.stopLoadTimer();
    // Ended before this page got into it (a rejoin, a build still going), or with no places while away from it
    // (the live server dropped it): nothing to show but that it's over.
    if (!this.joined || (this.match === null && LiveRoomMatch.places(results).length === 0)) {
      this.leave();
      this.on.left(t('liveOver'));
      return;
    }
    this.calm();
    this.on.ended(results);
  }

  /** The places (user ids, winner first) from the hub's results. */
  static places(results: Json | undefined): number[] {
    const places = field(results, 'places');
    return Array.isArray(places) ? places.filter((p) => typeof p === 'number') : [];
  }

  /** Did this player win? */
  won(results: Json | undefined): boolean {
    return field(results, 'winnerId') === this.me;
  }

  private gone(text: string): void {
    this.stopMatch();
    this.detach();
    this.room = null;
    this.playing = false;
    this.calm();
    this.on.left(text);
  }

  private calm(): void {
    this.hub.mp.setBusy(false);
    this.hub.notify.setQuiet(false);
  }

  private stopMatch(): void {
    this.match?.leave();
    this.match = null;
    this.game.stop();
  }

  /** Presence: a lobby with open seats is joinable; a match isn't. */
  reportPresence(): void {
    const room = this.room;
    if (!room) return;
    if (this.playing) this.hub.presence.set({ kind: 'playing', room: room.info.code, joinable: false });
    else
      this.hub.presence.set({
        kind: 'lobby',
        room: room.info.code,
        joinable: true,
        public: room.info.public,
        openSeats: Math.max(0, room.info.maxPlayers - room.info.seats.length),
      });
  }

  /** One frame of play: the game sets its input and moves its view. */
  frame(dt: number): void {
    if (this.match !== null) this.game.frame(dt);
  }

  /** Draw. */
  render(): void {
    this.game.render();
  }

  /** Leave the room (the title, Leave, another launch). */
  leave(): void {
    const room = this.room;
    this.stopMatch();
    if (!room) return;
    this.detach();
    this.room = null;
    this.playing = false;
    this.calm();
    fireAndForget(room.leave());
  }
}
