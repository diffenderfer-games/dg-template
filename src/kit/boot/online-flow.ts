/**
 * kit/boot: online play inside the session (lobby → match → result), on kit/online.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "In the session"
 */
import { fireAndForget } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import { field, type Json } from '../core/json.ts';
import type { KitLaunch } from '../core/planned.ts';
import { face } from '../avatar/index.ts';
import { chatPanel } from '../online/chat.ts';
import { errText } from '../online/errors.ts';
import { lobbyScreen } from '../online/lobby.ts';
import { OnlineMatch } from '../online/match.ts';
import type { OnlineGame } from '../online/types.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';

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

  /** Host a room: the Play online button, a `host` launch (with its party), or a table (world W2). */
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
    const chat = chatPanel(room, room.info.chatMode, (id) => names.get(id) ?? '?');
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
      { presence: { kind: 'lobby', room: room.info.code, joinable: true } },
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
