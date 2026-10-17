/**
 * kit/boot: online games the hub runs inside the session (open, make, join, play, the end), on kit/turns.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The screen"
 *
 * multiplayer.md §16.3. A game comes from Your games (`hub.saved.opened`,
 * `onOpen`), an invite link (`hub.turns.link`) or the title's Play online
 * (the computer, a link, anyone). The page follows it live through the
 * game's own events (`move`, `turn`, `ended`, `chat`): the client already
 * catches up after a gap or a quiet spell, so the kit never polls. The only
 * timer is the one that asks `canLetComputerPlay()` again when
 * `summary.handOverAt` (or the deadline) comes.
 */
import { fireAndForget } from '../core/async.ts';
import type { Cancel, Clock } from '../core/clock.ts';
import type { HubLike, TurnGameLike } from '../core/hub-like.ts';
import type { JsonObject } from '../core/json.ts';
import { t } from '../core/strings.ts';
import { face } from '../avatar/index.ts';
import { chatPanel, gamePhrases, type ChatPort } from '../online/chat.ts';
import { errText } from '../online/errors.ts';
import { nudger } from '../turns/index.ts';
import { turnsScreen, type TurnScreen } from '../turns/screen.ts';
import { nextCheckIn } from '../turns/status.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { confirm, openModal } from '../ui/modal.ts';
import { shareLink } from '../ui/share.ts';
import type { Screens } from '../ui/screens.ts';
import { toast } from '../ui/toast.ts';
import type { TurnBoard, TurnsHooks } from './types.ts';

/** What the session does for the flow. */
export type TurnsFlowHost = {
  /** Leave any game in progress (saved for Continue) before an online game opens. */
  enter(): void;
  /** The screen changed: input groups and the hub menu button follow. */
  shown(): void;
  toTitle(): void;
};

/** How a new game seats its other players. */
export type TurnsWho = 'computer' | 'link' | 'anyone';

/** An online game the hub runs as a chat port (free text answers the hub's delivered line). */
export function turnChat(game: Pick<TurnGameLike, 'say' | 'on'>): ChatPort {
  return {
    chat: async (text) => (await game.say({ text })).text,
    quick: async (quick) => void (await game.say({ quick })),
    on: (_event, cb) => game.on('chat', (line) => cb(line)),
  };
}

/** Online games the hub runs for one page. */
export class TurnsFlow {
  private current: TurnGameLike | null = null;
  private screen: TurnScreen | null = null;
  private offs: (() => void)[] = [];
  private recheck: Cancel | null = null;
  private nudge: (() => boolean) | null = null;
  private chatMode: string | null = null;
  private chatOffs: (() => void)[] = [];
  private readonly o: {
    hub: HubLike;
    hooks: Pick<TurnsHooks<JsonObject, JsonObject>, 'create' | 'testMove'> & {
      draw(el: HTMLElement, board: TurnBoard): void;
    };
    clock: Clock;
    screens: Screens;
    host: TurnsFlowHost;
    slug: string;
    quickChat: readonly string[];
  };

  constructor(o: TurnsFlow['o']) {
    this.o = o;
  }

  /** Is an online game on screen? */
  get active(): boolean {
    return this.current !== null;
  }

  /** Open a game the player sits in (Your games); an invited seat is taken first. */
  open(id: string): Promise<void> {
    return this.guard(async () => {
      const game = await this.o.hub.turns.open(id);
      const invited = game.summary.seats.some((s) => s.isMe && s.status === 'invited');
      return invited ? this.o.hub.turns.join(id) : game;
    });
  }

  /** Take a seat with an invite link key (`?hub_turn_link=`) or an open game's id. */
  join(idOrLinkKey: string): Promise<void> {
    return this.guard(() => this.o.hub.turns.join(idOrLinkKey));
  }

  /** The page was opened with an invite link (`?hub_turn_link=`): take the seat. True when it was. */
  async routeLink(): Promise<boolean> {
    const link = this.o.hub.turns.link;
    if (link === null) return false;
    await this.join(link);
    return true;
  }

  /** A new game: with the computer (started at once), with a link, or with open seats for anyone. */
  create(who: TurnsWho): Promise<void> {
    const base = this.o.hooks.create ?? {};
    return this.guard(async () => {
      if (who === 'computer') {
        const game = await this.o.hub.turns.create({ ...base, bots: true });
        await game.start();
        return game;
      }
      return this.o.hub.turns.create(who === 'link' ? { ...base, link: true } : { ...base, public: true });
    });
  }

  /** The title's Play online: who to play with. */
  choose(): void {
    openModal({
      title: t('turnsWho'),
      testid: 'turns-who',
      buttons: [
        {
          label: t('turnsWithComputer'),
          testid: 'turns-computer',
          primary: true,
          onClick: () => void this.create('computer'),
        },
        { label: t('turnsWithLink'), testid: 'turns-link', onClick: () => void this.create('link') },
        { label: t('turnsWithAnyone'), testid: 'turns-anyone', onClick: () => void this.create('anyone') },
        { label: t('back'), testid: 'turns-who-back' },
      ],
    });
  }

  /** Stop following the game (the hub keeps it; Your games lists it). */
  close(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.recheck?.();
    this.recheck = null;
    for (const off of this.chatOffs) off();
    this.chatOffs = [];
    this.chatMode = null;
    this.current?.close();
    this.current = null;
    this.screen = null;
    this.nudge = null;
  }

  private async guard(get: () => Promise<TurnGameLike>): Promise<void> {
    try {
      const game = await get();
      this.o.host.enter();
      this.enter(game);
    } catch (e) {
      toast(errText(e), { kind: 'warn' });
      if (!this.active) this.o.host.toTitle();
    }
  }

  /** The chat panel for the game's chat mode now (its live lines are unsubscribed when it is replaced). */
  private makeChat(game: TurnGameLike, names: () => Map<number, string>): HTMLElement | null {
    for (const off of this.chatOffs) off();
    this.chatOffs = [];
    this.chatMode = game.chatMode;
    if (game.chatMode === 'off') return null;
    const port: ChatPort = {
      ...turnChat(game),
      on: (_event, cb) => {
        const off = game.on('chat', (line) => cb(line));
        this.chatOffs.push(off);
        return off;
      },
    };
    return chatPanel(port, game.chatMode, (id) => names().get(id) ?? '?', {
      extra: gamePhrases(this.o.slug, this.o.quickChat),
      earlier: game.chat,
    });
  }

  private enter(game: TurnGameLike): void {
    this.close();
    this.current = game;
    this.nudge = nudger(game, () => this.o.clock.now());
    const names = (): Map<number, string> =>
      new Map(game.summary.seats.flatMap((s) => (s.userId === null ? [] : [[s.userId, s.name] as const])));
    const chat = this.makeChat(game, names);
    const screen = turnsScreen(
      {
        title: t('turnsTitle'),
        chat,
        face: (s) =>
          face(this.o.hub, { name: s.name, look: s.look, ...(s.userId === null ? {} : { userId: s.userId }) }, 32),
      },
      {
        start: () => void this.act(() => game.start()),
        copyLink: () => this.copyLink(game),
        nudge: () => {
          if (this.nudge?.() === true) toast(t('turnsReminded'));
        },
        handOver: () => void this.act(() => game.letComputerPlay()),
        rematch: () => void this.guard(() => game.rematch()),
        leave: () =>
          void confirm({ title: t('leaveGame'), body: t('turnsLeaveBody'), yes: t('leave'), no: t('stay') }).then(
            (yes) => {
              if (yes) void this.act(() => game.leave(), true);
            },
          ),
        back: () => this.o.host.toTitle(),
        player: (userId) => this.o.hub.social.openPlayer({ userId }),
        invite: () => this.inviteFriends(game),
        remove: (seat, name) => this.askRemove(game, seat, name),
      },
    );
    this.screen = screen;
    this.o.screens.show('turns', () => screen.el, { presence: { kind: 'menu' } });
    this.o.host.shown();
    const redraw = (): void => this.redraw();
    this.offs.push(game.on('move', redraw), game.on('turn', redraw), game.on('ended', redraw));
    this.redraw();
  }

  /** The board the game draws (and its test move reads). */
  private board(game: TurnGameLike): TurnBoard {
    return {
      view: game.view,
      summary: game.summary,
      mySeat: game.mySeat,
      canMove: game.summary.phase === 'playing' && (game.summary.isMyTurn || game.mayActNow),
      move: (move) => this.act(() => game.move(move)),
      remove:
        game.summary.isMine && game.kick !== undefined
          ? (seat) => {
              const s = game.summary.seats.find((x) => x.seat === seat);
              if (s && !s.isMe && s.userId !== null && (s.status === 'joined' || s.status === 'invited'))
                this.askRemove(game, seat, s.name);
            }
          : null,
    };
  }

  /** The test driver `__game.turnsMove()`: make the game's `testMove` when this player may move. */
  testMove(): boolean {
    const game = this.current;
    const pick = this.o.hooks.testMove;
    if (game === null || pick === undefined) return false;
    const board = this.board(game);
    const move = board.canMove ? pick(board) : null;
    if (move === null) return false;
    void board.move(move);
    return true;
  }

  /** Redraw the screen and the board, and ask about the hand-over again when its time comes. */
  private redraw(): void {
    const game = this.current;
    const screen = this.screen;
    if (game === null || screen === null) return;
    const now = this.o.clock.now();
    screen.update(game, now);
    // The chat mode follows who sits there (free text once everyone seated is a mutual friend).
    if (game.chatMode !== this.chatMode) {
      const names = (): Map<number, string> =>
        new Map(game.summary.seats.flatMap((s) => (s.userId === null ? [] : [[s.userId, s.name] as const])));
      screen.setChat(this.makeChat(game, names));
    }
    this.o.hooks.draw(screen.board, this.board(game));
    this.recheck?.();
    const wait = nextCheckIn(game.summary, now);
    this.recheck = wait === null ? null : this.o.clock.after(wait + 50, () => this.redraw());
  }

  /** Run an action; a refusal shows the hub's words; then redraw (`toTitle` after it when asked). */
  private act(work: () => Promise<unknown>, toTitle = false): Promise<void> {
    return work().then(
      () => {
        if (toTitle) this.o.host.toTitle();
        else this.redraw();
      },
      (e: unknown) => {
        toast(errText(e), { kind: 'warn' });
        this.redraw();
      },
    );
  }

  /** Confirm, then take the player in `seat` out (`game.kick`). */
  private askRemove(game: TurnGameLike, seat: number, name: string): void {
    fireAndForget(
      confirm({
        title: t('turnsRemoveTitle', { name }),
        body: game.summary.phase === 'lobby' ? t('turnsRemoveLobby') : t('turnsRemovePlaying'),
        yes: t('turnsRemoveYes'),
        no: t('stay'),
      }).then((yes) => {
        if (yes && game.kick !== undefined) void this.act(() => game.kick?.(seat) ?? Promise.resolve());
      }),
    );
  }

  /** Invite friends: the player's friends not already seated, each with an Invite button (`game.invite`). */
  private inviteFriends(game: TurnGameLike): void {
    const list = h('ul.kit-friends', { 'data-testid': 'turns-friends' }, h('li.kit-tagline', {}, '…'));
    openModal({
      title: t('turnsInviteTitle'),
      testid: 'turns-invite-sheet',
      body: list,
      buttons: [{ label: t('back'), testid: 'turns-invite-back' }],
    });
    fireAndForget(
      this.o.hub.social.friends().then((friends) => {
        const seated = new Set(game.summary.seats.flatMap((s) => (s.userId === null ? [] : [s.userId])));
        const free = friends.filter((f) => !seated.has(f.id) && !f.guest);
        if (free.length === 0) return void list.replaceChildren(h('li.kit-tagline', {}, t('turnsNoFriends')));
        list.replaceChildren(
          ...free.map((f) => {
            const go = button(
              t('turnsInviteOne'),
              () => {
                go.disabled = true;
                void this.act(() => game.invite([f.id])).then(() => {
                  const label = go.querySelector('.kit-btn-label');
                  if (label) label.textContent = t('turnsInvited');
                  if (!game.summary.seats.some((s) => s.status === 'open')) toast(t('turnsNoSeats'));
                });
              },
              { testid: `turns-invite-${f.id}` },
            );
            return h(
              'li.kit-friend',
              {},
              face(this.o.hub, { name: f.username, look: f.look, userId: f.id }, 32),
              h('span.kit-friend-name', {}, f.username),
              go,
            );
          }),
        );
      }),
      (e) => list.replaceChildren(h('li.kit-tagline', {}, errText(e))),
    );
  }

  /** Share the invite link: the share sheet, else the clipboard, else a dialog to copy it by hand (kit/ui share). */
  private copyLink(game: TurnGameLike): void {
    const url = game.link;
    if (url === null) return;
    const title = typeof document === 'undefined' || document.title === '' ? t('turnsTitle') : document.title;
    fireAndForget(shareLink({ url, title, text: t('turnsShareText') }));
  }
}
