/**
 * kit/boot: online games played over days inside the session (open, make, join, play, the end), on kit/turns.
 * Source: dg-template src/kit/boot/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The screen"
 *
 * multiplayer.md §16.3. A game comes from Your games (`hub.saved.opened`,
 * `onOpen`), an invite link (`hub.turns.link`) or the title's Play over days
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
import { confirm, openModal } from '../ui/modal.ts';
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

/** An online game over days as a chat port (free text answers the hub's delivered line). */
export function turnChat(game: Pick<TurnGameLike, 'say' | 'on'>): ChatPort {
  return {
    chat: async (text) => (await game.say({ text })).text,
    quick: async (quick) => void (await game.say({ quick })),
    on: (_event, cb) => game.on('chat', (line) => cb(line)),
  };
}

/** Online games over days for one page. */
export class TurnsFlow {
  private current: TurnGameLike | null = null;
  private screen: TurnScreen | null = null;
  private offs: (() => void)[] = [];
  private recheck: Cancel | null = null;
  private nudge: (() => boolean) | null = null;
  private readonly o: {
    hub: HubLike;
    hooks: Pick<TurnsHooks<JsonObject, JsonObject>, 'create'> & { draw(el: HTMLElement, board: TurnBoard): void };
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

  /** The title's Play over days: who to play with. */
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

  private enter(game: TurnGameLike): void {
    this.close();
    this.current = game;
    this.nudge = nudger(game, () => this.o.clock.now());
    const names = (): Map<number, string> =>
      new Map(game.summary.seats.flatMap((s) => (s.userId === null ? [] : [[s.userId, s.name] as const])));
    const chat =
      game.chatMode === 'off'
        ? null
        : chatPanel(turnChat(game), game.chatMode, (id) => names().get(id) ?? '?', {
            extra: gamePhrases(this.o.slug, this.o.quickChat),
            earlier: game.chat,
          });
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
      },
    );
    this.screen = screen;
    this.o.screens.show('turns', () => screen.el, { presence: { kind: 'menu' } });
    this.o.host.shown();
    const redraw = (): void => this.redraw();
    this.offs.push(game.on('move', redraw), game.on('turn', redraw), game.on('ended', redraw));
    this.redraw();
  }

  /** Redraw the screen and the board, and ask about the hand-over again when its time comes. */
  private redraw(): void {
    const game = this.current;
    const screen = this.screen;
    if (game === null || screen === null) return;
    const now = this.o.clock.now();
    screen.update(game, now);
    const playing = game.summary.phase === 'playing';
    const board: TurnBoard = {
      view: game.view,
      summary: game.summary,
      mySeat: game.mySeat,
      canMove: playing && (game.summary.isMyTurn || game.mayActNow),
      move: (move) => this.act(() => game.move(move)),
    };
    this.o.hooks.draw(screen.board, board);
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

  private copyLink(game: TurnGameLike): void {
    const link = game.link;
    if (link === null) return;
    const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clip === undefined) return void toast(link);
    fireAndForget(
      clip.writeText(link).then(() => toast(t('turnsLinkCopied'))),
      () => toast(link),
    );
  }
}
