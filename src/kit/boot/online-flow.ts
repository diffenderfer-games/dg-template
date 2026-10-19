/**
 * kit/boot: online play inside the session (lobby → match → result), on kit/online.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "In the session"
 *
 * The title's online button asks how to play: Play now joins a public room waiting in its lobby
 * (`hub.rooms.list`) or else hosts one anyone can join; With friends hosts a private room to invite
 * them into; or a room's code. Invites, parties and links still arrive as launches.
 */
import { fireAndForget } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { field, type Json } from '../core/json.ts';
import type { KitLaunch } from '../core/planned.ts';
import { face } from '../avatar/index.ts';
import { MANIFEST } from '../core/manifest.ts';
import { chatPanel, gamePhrases, roomChat } from '../online/chat.ts';
import { errText } from '../online/errors.ts';
import { lobbyScreen } from '../online/lobby.ts';
import { OnlineMatch } from '../online/match.ts';
import type { OnlineGame } from '../online/types.ts';
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
  showPlay(): void;
  showResult(won: boolean): void;
  toTitle(): void;
  readonly screen: string;
};

/** Online play for one page. */
export class OnlineFlow {
  readonly match: OnlineMatch;
  private readonly hub: HubLike;
  private readonly game: OnlineGame;
  private readonly screens: Screens;
  private readonly host: OnlineFlowHost;

  constructor(hub: HubLike, game: OnlineGame, clock: Clock, screens: Screens, host: OnlineFlowHost) {
    this.hub = hub;
    this.game = game;
    this.screens = screens;
    this.host = host;
    this.match = new OnlineMatch(hub, game, clock, {
      lobby: () => {
        if (!this.match.playing && (host.screen === 'lobby' || host.screen === 'loading' || host.screen === 'title'))
          this.showLobby();
      },
      playing: () => {
        host.showPlay();
        this.match.reportPresence(); // the room's presence, not the play screen's plain one
      },
      ended: (results) => host.showResult(this.won(results)),
      left: (text) => {
        if (text !== null) toast(text, { kind: 'warn' });
        host.toTitle();
      },
      seat: () => undefined,
    });
  }

  /** Did this player win (the host's `{ winners }`)? */
  private won(results: Json | undefined): boolean {
    const winners = field(results, 'winners');
    return Array.isArray(winners) && winners.includes(this.match.me);
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
    let sheet: ModalHandle | null = null;
    const pick = (go: () => void) => (): void => {
      sheet?.close();
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
    sheet = openModal({
      title: t('onlineWho'),
      testid: 'online-who',
      body,
      buttons: [{ label: t('back'), testid: 'online-who-back' }],
    });
  }

  /** Play now: join a public room waiting in its lobby with a free seat, else host one anyone can join. */
  async playNow(): Promise<void> {
    this.host.enter();
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
    this.host.enter();
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
    this.host.enter();
    try {
      await this.match.join(code, spectate);
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
      this.host.toTitle();
    }
  }

  /** The lobby screen. */
  showLobby(): void {
    const room = this.match.room;
    if (!room) return;
    const names = new Map(room.info.seats.map((s) => [s.userId, s.name]));
    const slug = this.hub.slug;
    const extra = slug === null ? [] : gamePhrases(slug, MANIFEST.roomQuickChat); // game.multiplayer.quickChat
    const chat = chatPanel(roomChat(room), room.info.chatMode, (id) => names.get(id) ?? '?', { extra });
    this.screens.show(
      'lobby',
      () =>
        lobbyScreen(
          {
            info: room.info,
            isHost: this.match.isHost,
            me: this.match.me,
            minPlayers: this.game.minPlayers,
            chat,
            face: (seat) => face(this.hub, { userId: seat.userId, name: seat.name, look: seat.look }, 32),
          },
          {
            start: () => this.match.start(),
            leave: () => this.host.toTitle(),
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
  }

  /** One frame of the match. */
  frame(dt: number): void {
    this.match.frame(dt);
  }

  /** Draw the latest view. */
  render(): void {
    if (this.match.playing || this.match.view !== null) this.game.render(this.match.view, this.match.me);
  }

  /** Leave the room (and revoke nothing: invite links expire with the room). */
  leave(): void {
    this.match.leave();
  }

  /** Make an invite link for this room (the hub's dialog also offers it). */
  inviteLink(): void {
    fireAndForget(this.hub.mp.inviteLink());
  }
}
