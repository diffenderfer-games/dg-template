/**
 * kit/boot: online play inside the session (lobby → match → result), on kit/online, or kit/live for a live game.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "In the session"
 *
 * The title's online button asks how to play: Play now joins a public room waiting in its lobby
 * (`hub.rooms.list`) or else hosts one anyone can join; With friends hosts a private room to invite
 * them into; or a room's code. Invites, parties and links still arrive as launches.
 *
 * Two kinds of match share the lobby: kit/online's (the host's page runs the
 * game's rules) and kit/live's (the hub's live server runs the game's sim;
 * the flow adds the loading screen while each page builds the match).
 *
 * Getting out is always one step: the lobby's Leave and the loading screen's
 * Leave, and Back (the phone's, the browser's, the pad's B, Esc) while the
 * lobby or the loading screen shows (the session's back guard; on the loading
 * screen it asks first, like a match). Leaving leaves the room with the hub,
 * so no seat is held and nobody is offered a Rejoin.
 */
import type { HubRoom } from '@diffenderfer-games/hub';
import { fireAndForget } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { field, type Json } from '../core/json.ts';
import type { KitLaunch } from '../core/planned.ts';
import { face } from '../avatar/index.ts';
import { MANIFEST } from '../core/manifest.ts';
import { chatPanel, gamePhrases, roomChat } from '../online/chat.ts';
import { errText } from '../online/errors.ts';
import { lobbyScreen, lobbyTicks, tickLobby } from '../online/lobby.ts';
import { rematchOf, roomExtras } from '../online/ready.ts';
import { confirm } from '../ui/modal.ts';
import { shareLink } from '../ui/share.ts';
import { nameIn, rematchPanel, type RematchPanel } from './rematch-panel.ts';
import { OnlineMatch } from '../online/match.ts';
import type { OnlineGame } from '../online/types.ts';
import { LiveRoomMatch } from '../live/room-match.ts';
import type { LiveRoomGame } from '../live/types.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { openModal, type ModalHandle } from '../ui/modal.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import { t } from '../core/strings.ts';
import { joinCodeForm, lookingSheet, type JoinKinds, type JoinTarget } from './joining.ts';

/** What the session does for the online flow. */
export type OnlineFlowHost = {
  /** Enter online mode (leaving any daily or race; the activity becomes `online`). */
  enter(): void;
  /** The play screen; returns its HUD element. */
  showPlay(): HTMLElement;
  /** The result screen (its element, for a live game's places). */
  showResult(won: boolean): HTMLElement | null;
  toTitle(): void;
  /** The lobby or the loading screen shows: Back leaves the room instead of the page (the session's back guard). */
  guard(): void;
  readonly screen: string;
};

/** Which kind of match the rooms play. */
export type RoomGame = { online: OnlineGame } | { live: LiveRoomGame };

/** Online play for one page. */
export class OnlineFlow {
  readonly match: OnlineMatch | LiveRoomMatch;
  private readonly hub: HubLike;
  private readonly game: RoomGame;
  private readonly screens: Screens;
  private readonly host: OnlineFlowHost;
  /** The loading screen's words and bar, while a live match is built. */
  private loading: { text: HTMLElement; bar: HTMLElement } | null = null;
  /** The lobby's chat panel, kept for its room. */
  private chat: { room: HubRoom; mode: string; el: HTMLElement } | null = null;
  /** The session is in online mode for this flow (a reclaimed seat enters it when its room shows). */
  private entered = false;
  /** The Play now / Make a room sheet, while it is open (a room reached another way, an invite, closes it). */
  private chooser: ModalHandle | null = null;
  private readonly clock: Clock;
  /** The lobby's once-a-second countdown, while it has one. */
  private tick: (() => void) | null = null;
  /** The result screen's Rematch panel and its listener on the ended room. */
  private rematch: { panel: RematchPanel; off: () => void } | null = null;
  /** The code of the rematch room this page moved into (its lobby says so). */
  private rematchCode: string | null = null;

  constructor(hub: HubLike, game: RoomGame, clock: Clock, screens: Screens, host: OnlineFlowHost) {
    this.clock = clock;
    this.hub = hub;
    this.game = game;
    this.screens = screens;
    this.host = host;
    const lobby = (): void => {
      this.enter();
      if (!this.match.playing && (host.screen === 'lobby' || host.screen === 'loading' || host.screen === 'title'))
        this.showLobby();
    };
    const playing = (): void => {
      this.enter();
      this.loading = null;
      const hud = host.showPlay();
      if ('live' in game) game.live.hud?.(hud);
      this.match.reportPresence(); // the room's presence, not the play screen's plain one
    };
    const left = (text: string | null): void => {
      this.entered = false;
      this.dropRematch();
      if (text !== null) toast(text, { kind: 'warn' });
      host.toTitle();
    };
    this.match =
      'live' in game
        ? new LiveRoomMatch(hub, game.live, {
            lobby,
            loading: (fraction, label) => this.showLoading(fraction, label),
            playing,
            ended: (results) => this.liveEnded(game.live, results),
            left,
            problem: (text) => toast(text, { kind: 'warn' }),
            closedAfterEnd: () => this.rematch?.panel.update(null),
          })
        : new OnlineMatch(hub, game.online, clock, {
            lobby,
            playing,
            ended: (results) => this.addRematch(host.showResult(this.won(results))),
            left,
            seat: () => undefined,
            closedAfterEnd: () => this.rematch?.panel.update(null),
          });
  }

  /** Did this player win (kit/online: the host's `{ winners }`; kit/live: the hub's `winnerId`)? */
  private won(results: Json | undefined): boolean {
    if (this.match instanceof LiveRoomMatch) return this.match.won(results);
    const winners = field(results, 'winners');
    return Array.isArray(winners) && winners.includes(this.match.me);
  }

  /** A live match ended: the result screen, with the game's places. */
  private liveEnded(live: LiveRoomGame, results: Json | undefined): void {
    const el = this.host.showResult(this.won(results));
    const start = this.match instanceof LiveRoomMatch ? this.match.matchStart : null;
    if (el) live.result?.(el, LiveRoomMatch.places(results), start);
    this.addRematch(el);
  }

  /** The result screen gets the Rematch panel (a hub with `rematch`), kept current with the ended room. */
  private addRematch(el: HTMLElement | null): void {
    this.dropRematch();
    const room = this.match.room;
    if (el === null || room === null) return;
    const go = roomExtras(room).rematch;
    if (go === undefined) return;
    const me = this.match.me;
    const seats = room.info.seats;
    const panel = rematchPanel({
      me,
      seats,
      press: async () => {
        const next = await go();
        this.dropRematch();
        this.rematchCode = next.info.code;
        this.match.adopt(next);
        this.showLobby();
      },
    });
    let told = rematchOf(room.info) !== null;
    const off = room.on('room', (info) => {
      panel.update(info);
      const r = rematchOf(info);
      if (r === null || told) return;
      told = true;
      if (r.hostId !== me && !r.userIds.includes(me) && this.host.screen === 'result')
        toast(t('rematchToast', { name: nameIn(seats, r.hostId) }));
    });
    panel.update(room.info);
    this.rematch = { panel, off };
    const menu = el.querySelector('.kit-menu');
    if (menu) menu.before(panel.el);
    else el.append(panel.el);
  }

  private dropRematch(): void {
    this.rematch?.off();
    this.rematch = null;
  }

  /** Online mode, once (the session leaves a daily or race for it). */
  private enter(): void {
    this.closeChooser();
    if (this.entered) return;
    this.entered = true;
    this.host.enter();
  }

  /** A live game's part of the lobby (its options, its controls). */
  private liveLobby(): HTMLElement | null {
    const match = this.match;
    if (!(match instanceof LiveRoomMatch) || !('live' in this.game)) return null;
    return (
      this.game.live.describe?.(match.options, {
        isHost: match.isHost,
        update: () => {
          match.update();
          this.showLobby();
        },
      }) ?? null
    );
  }

  /** The loading screen while a live match is built (updated in place). */
  private showLoading(fraction: number, label: string): void {
    this.enter();
    if (this.loading === null || this.host.screen !== 'loading') {
      const text = h('p.kit-tagline', { 'data-testid': 'live-loading' });
      const bar = h('i');
      this.screens.show('loading', () =>
        h(
          'div.kit-loading',
          { 'aria-busy': 'true' },
          text,
          h('div.kit-progress', {}, bar),
          // Never stuck here: the player can always go back (the room is left).
          button(t('leave'), () => this.host.toTitle(), { testid: 'loading-leave', cls: 'kit-loading-leave' }),
        ),
      );
      this.loading = { text, bar };
      this.host.guard();
    }
    this.loading.text.textContent = label;
    this.loading.bar.style.width = `${String(Math.round(Math.max(0, Math.min(1, fraction)) * 100))}%`;
  }

  /** The room code the player is in (the launch adapter's idempotency check). */
  currentRoom(): string | null {
    return this.match.code;
  }

  /**
   * The title's online button: Play now (`online-play-now`), With friends (`online-friends`), Join with a
   * code (a room's; an online game's link too when the game has them, through `joinCode`).
   */
  choose(joinCode: { kinds: JoinKinds; go(target: JoinTarget): void }): void {
    const pick = (go: () => void) => (): void => {
      this.closeChooser();
      go();
    };
    const body = h(
      'div.kit-choose',
      {},
      button(
        t('playNow'),
        pick(() => void this.playNow()),
        {
          cls: 'kit-primary',
          testid: 'online-play-now',
          sub: t('onlinePlayNowSub'),
        },
      ),
      button(
        t('onlineFriends'),
        pick(() => void this.hostRoom()),
        {
          testid: 'online-friends',
          sub: t('onlineFriendsSub'),
        },
      ),
      joinCodeForm(joinCode.kinds, (target) => pick(() => joinCode.go(target))()),
    );
    this.chooser = openModal({
      title: t('onlineWho'),
      testid: 'online-who',
      body,
      buttons: [{ label: t('back'), testid: 'online-who-back' }],
      onClose: () => {
        this.chooser = null;
      },
    });
  }

  private closeChooser(): void {
    const sheet = this.chooser;
    this.chooser = null;
    sheet?.close();
  }

  /** Play now: join a public room waiting in its lobby with a free seat, else host one anyone can join. */
  async playNow(): Promise<void> {
    this.enter();
    const looking = lookingSheet();
    try {
      for (const code of await this.openRooms()) {
        try {
          await this.match.join(code, false);
          return;
        } catch {
          // full or started meanwhile: try the next
        }
      }
      await this.match.create({ public: true });
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
      this.host.toTitle();
    } finally {
      looking.close();
    }
  }

  /** Codes of public rooms in their lobby with a free seat, not this player's (none on a hub without `list`). */
  private async openRooms(): Promise<string[]> {
    const me = this.hub.userId();
    try {
      const rooms = await this.hub.rooms.list();
      return rooms
        .filter((r) => r.phase === 'lobby' && r.seats.length < r.maxPlayers && !r.seats.some((s) => s.userId === me))
        .map((r) => r.code);
    } catch {
      return [];
    }
  }

  /** Host a room: With friends (private), a `host` launch (with its party), or a table (world W2). */
  async hostRoom(l?: KitLaunch): Promise<void> {
    if (this.match.room !== null && this.match.isHost && l?.partyId !== undefined) {
      this.match.shareRoom(l.partyId); // another invite from the same lobby: share this room
      return;
    }
    this.enter();
    try {
      await this.match.create({
        ...(l?.mode === undefined ? {} : { mode: l.mode }),
        ...(l?.partyId === undefined ? {} : { partyId: l.partyId }),
        ...(l?.table === undefined ? {} : { table: l.table }),
      });
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
      this.host.toTitle();
    }
  }

  /** Join a room (a guest launch, Join, Watch, an invite link, a rejoin). */
  async joinRoom(code: string, spectate: boolean): Promise<void> {
    this.enter();
    try {
      await this.match.join(code, spectate);
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
      this.host.toTitle();
    }
  }

  /**
   * The lobby's chat: one panel for the room's life (the lobby is drawn again on every change in the
   * room, and a new panel would drop the lines shown and what the player is typing).
   */
  private chatFor(room: HubRoom): HTMLElement {
    const mode = room.info.chatMode;
    if (this.chat?.room === room && this.chat.mode === mode) return this.chat.el;
    const slug = this.hub.slug;
    const extra = slug === null ? [] : gamePhrases(slug, MANIFEST.roomQuickChat); // game.multiplayer.quickChat
    const nameOf = (id: number): string => room.info.seats.find((s) => s.userId === id)?.name ?? '?';
    const el = chatPanel(roomChat(room), mode, nameOf, { extra });
    this.chat = { room, mode, el };
    return el;
  }

  /** The lobby screen. */
  showLobby(): void {
    const room = this.match.room;
    if (!room) return;
    const chat = this.chatFor(room);
    this.screens.show(
      'lobby',
      () =>
        lobbyScreen(
          {
            info: room.info,
            isHost: this.match.isHost,
            me: this.match.me,
            minPlayers: 'live' in this.game ? (this.game.live.minPlayers ?? 2) : this.game.online.minPlayers,
            chat,
            extra: this.liveLobby(),
            face: (seat) => face(this.hub, { userId: seat.userId, name: seat.name, look: seat.look }, 32),
            now: this.clock.now(),
            watching: room.me.spectator,
            rematch: this.rematchCode === room.info.code,
          },
          {
            start: () => this.match.start(),
            leave: () => this.host.toTitle(),
            ready: (on) => this.match.ready(on),
            share: () => void this.shareInvite(),
            ...(roomExtras(room).setHost === undefined
              ? {}
              : { makeHost: (userId: number) => void this.makeHost(userId) }),
            invite: () => this.hub.social.openInvite(),
            bell: () => this.hub.social.openNotify(this.hub.slug === null ? {} : { game: this.hub.slug }),
            player: (userId) => this.hub.social.openPlayer({ userId }),
          },
        ),
      {
        presence: {
          kind: 'lobby',
          room: room.info.code,
          joinable: true,
          public: room.info.public,
          openSeats: Math.max(0, room.info.maxPlayers - room.info.seats.length),
        },
      },
    );
    this.host.guard();
    this.keepTicking();
  }

  /** One frame of the match. */
  frame(dt: number): void {
    this.match.frame(dt);
  }

  /** Draw the latest view. */
  render(): void {
    if (this.match instanceof LiveRoomMatch) this.match.render();
    else if ('online' in this.game && (this.match.playing || this.match.view !== null))
      this.game.online.render(this.match.view, this.match.me);
  }

  /** Leave the room (and revoke nothing: invite links expire with the room). */
  leave(): void {
    this.entered = false;
    this.dropRematch();
    this.rematchCode = null;
    this.stopTick();
    this.match.leave();
  }

  /** Make an invite link for this room (the hub's dialog also offers it). */
  inviteLink(): void {
    fireAndForget(this.hub.mp.inviteLink());
  }

  /** The lobby's Invite link: a link to this room, handed on through `shareLink` (never printed). */
  private async shareInvite(): Promise<void> {
    try {
      const link = await this.hub.mp.inviteLink();
      const url = typeof location === 'undefined' ? link.url : new URL(link.url, location.href).href;
      await shareLink({ url, title: t('lobbyShareTitle'), text: t('turnsShareText') });
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
    }
  }

  /** The host hands the host role to `userId`, after asking. */
  private async makeHost(userId: number): Promise<void> {
    const room = this.match.room;
    const setHost = room === null ? undefined : roomExtras(room).setHost;
    if (room === null || setHost === undefined) return;
    const name = nameIn(room.info.seats, userId);
    const yes = await confirm({
      title: t('makeHostTitle', { name }),
      body: t('makeHostBody'),
      yes: t('makeHost'),
      no: t('cancel'),
    });
    if (!yes || this.match.room !== room) return;
    try {
      await setHost(userId);
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
    }
  }

  /** Tick the lobby's countdowns once a second while it shows one; a wait that is over draws it again. */
  private keepTicking(): void {
    if (this.tick !== null) return;
    const el = this.screens.element;
    if (el === null || this.host.screen !== 'lobby' || !lobbyTicks(el)) return;
    this.tick = this.clock.after(1000, () => {
      this.tick = null;
      const now = this.screens.element;
      if (now === null || this.host.screen !== 'lobby' || this.match.room === null) return;
      if (tickLobby(now, this.clock.now())) this.showLobby();
      else this.keepTicking();
    });
  }

  private stopTick(): void {
    this.tick?.();
    this.tick = null;
  }
}
