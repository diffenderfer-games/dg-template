// Online games the hub runs on the kit's screen (multiplayer.md §16.3): the title's Play online, Your games,
// invite links, whose move it is, who is there (seat.connected), the hand-over at handOverAt, chat with the
// game's own quick-chat phrases (game.turns.quickChat), the end and the rematch. FakeHub, a toy board (_support/toys.ts).
import { expect, it } from 'vitest';
import { MANIFEST } from '../../src/kit/core/manifest.ts';
import type { TurnBoard } from '../../src/kit/boot/index.ts';
import { openTurnGame, type FakeTurnGame } from '../../src/kit/testing/index.ts';
import { bootGame, describeIf, HAS, type Booted } from './_support/harness.ts';
import { toyTurns } from './_support/toys.ts';

/** Boot with the toy board in place of the game's own: these suites test the kit's turns screen, not one game's board. */
const boot = (o: Parameters<typeof bootGame>[0] = {}): Promise<Booted> =>
  bootGame({ ...o, patch: { turns: toyTurns, ...o?.patch } });

const status = (g: Booted): string => g.ui.querySelector('[data-testid="turn-status"]')?.textContent ?? '';
const has = (g: Booted, testid: string): boolean => g.ui.querySelector(`[data-testid="${testid}"]`) !== null;

/** Boot, then open game `id` from Your games (`?hub_open=…&hub_kind=turns`). */
async function opened(id = 'tg-9'): Promise<{ g: Booted; game: FakeTurnGame }> {
  const g = await boot({ before: (f) => (f.saved.opened = { id, kind: 'turns' }) });
  await g.settle();
  const game = g.fake.turns.games.get(id);
  if (!game) throw new Error('the game was not opened');
  return { g, game };
}

describeIf(HAS.turns, 'this game declares no game.turns')('online games the hub runs (kit/turns screen)', () => {
  it('the title offers Play online; the computer makes a started game on the turns screen', async () => {
    const g = await boot();
    expect(MANIFEST.turns).toBe(true); // this suite runs only for a game that declares game.turns
    g.press('turns-new');
    g.press('turns-computer');
    await g.settle();
    expect(g.fake.log.last('turns.create')?.args[0]).toMatchObject({ bots: true });
    expect(g.fake.log.count('turns.start')).toBe(1);
    expect(g.hook.screen()).toBe('turns');
    expect(status(g)).toBe('Your turn');
    expect(g.fake.resume.blockedBy).toBe('turns');
  });

  it('a game from Your games: moves from the board, the other player live, then "is playing" / "Waiting for…"', async () => {
    const { g, game } = await opened();
    expect(g.hook.screen()).toBe('turns');
    game.view = { any: 'view' };
    game.turnChanged({});
    await g.settle();
    g.press('toy-move');
    await g.settle();
    expect(game.moves).toEqual([{ toy: 1 }]);
    game.turnChanged({ isMyTurn: false, toAct: [1] });
    await g.settle();
    expect(status(g)).toBe('Sam is playing');
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="toy-move"]')?.disabled).toBe(true);
    game.seatConnected(1, false);
    await g.settle();
    expect(status(g)).toBe('Waiting for Sam…');
    // Unknown (a player who hides their presence, an older hub) reads as here, never "waiting".
    game.turnChanged({ seats: game.summary.seats.map((s) => (s.seat === 1 ? { ...s, connected: undefined } : s)) });
    await g.settle();
    expect(status(g)).toBe('Sam is playing');
  });

  it('the hand-over shows when handOverAt comes (a timer, no polling) and lets the computer play', async () => {
    const { g, game } = await opened();
    const now = g.fake.clock.now();
    game.turnChanged({ isMyTurn: false, toAct: [1], handOverAt: now + 2 * 60_000 });
    game.seatConnected(1, false);
    await g.settle();
    expect(has(g, 'turns-hand-over')).toBe(false);
    const calls = g.fake.log.calls.length;
    g.fake.clock.advance(60_000);
    await g.settle();
    expect(g.fake.log.calls.length).toBe(calls); // nothing fetched while waiting
    g.fake.clock.advance(60_100);
    await g.settle();
    const btn = g.ui.querySelector('[data-testid="turns-hand-over"]');
    expect(btn?.textContent).toBe('Let the computer play for Sam');
    game.seatConnected(1, true); // Sam came back: no hand-over for a player who is here
    await g.settle();
    expect(has(g, 'turns-hand-over')).toBe(false);
    game.seatConnected(1, false);
    await g.settle();
    g.press('turns-hand-over');
    await g.settle();
    expect(g.fake.log.count('turns.letComputerPlay')).toBe(1);
    expect(game.summary.seats[1]?.status).toBe('bot');
    expect(has(g, 'turns-hand-over')).toBe(false);
  });

  it("chat: the hub's chips and the game's own phrases (g:<slug>:<i>), lines live", async () => {
    const { g, game } = await opened();
    const first = MANIFEST.turnsQuickChat[0] ?? '';
    const chip = g.ui.querySelector<HTMLElement>(`[data-testid="quick-g:${g.fake.slug}:0"]`);
    expect(chip?.textContent).toBe(first);
    chip?.click();
    await g.settle();
    expect(g.fake.log.last('turns.say')?.args[0]).toEqual({ quick: `g:${g.fake.slug}:0` });
    game.chatFrom({ from: 2, at: 0, text: 'Nice one!', quick: 'nice' });
    await g.settle();
    expect(g.ui.querySelector('[data-testid="chat-lines"]')?.textContent).toContain('Sam: Nice one!');
  });

  it('the end: won or lost from the outcome, Rematch opens the new game; Back closes it', async () => {
    const { g, game } = await opened();
    game.ended({ winners: [0] });
    await g.settle();
    expect(status(g)).toBe('You won!');
    g.press('turns-rematch');
    await g.settle();
    expect(g.fake.log.count('turns.rematch')).toBe(1);
    expect(game.closed).toBe(true);
    g.press('turns-back');
    await g.settle();
    expect(g.hook.screen()).toBe('title');
    expect(g.fake.turns.anyOpen).toBe(false);
  });

  it('an invite link (?hub_turn_link=) takes the seat at boot', async () => {
    const g = await boot({ before: (f) => (f.turns.link = 'key-1') });
    await g.settle();
    expect(g.fake.log.last('turns.join')?.args[0]).toBe('key-1');
    expect(g.hook.screen()).toBe('turns');
  });

  it('a game without a turns hook leaves online games to the hub (no button, no route)', async () => {
    const g = await boot({
      patch: { turns: undefined },
      before: (f) => (f.saved.opened = { id: 'tg-1', kind: 'turns' }),
    });
    await g.settle();
    expect(has(g, 'turns-new')).toBe(false);
    expect(g.fake.log.count('turns.open')).toBe(0);
    expect(g.hook.screen()).toBe('title');
  });
});

describeIf(HAS.turns, 'this game declares no game.turns')('the lobby: inviting friends, taking a player out', () => {
  const lobby = (game: FakeTurnGame, isMine = true): void =>
    game.turnChanged({
      phase: 'lobby',
      isMine,
      isMyTurn: false,
      toAct: [],
      seats: [
        { seat: 0, userId: 1, name: 'Player1', avatar: '', look: '', status: 'joined', isMe: isMine },
        { seat: 1, userId: 2, name: 'Sam', avatar: '', look: '', status: 'joined', isMe: !isMine },
        { seat: 2, userId: null, name: '', avatar: '', look: '', status: 'open', isMe: false },
      ],
    });

  it('Invite friends lists the friends not seated yet; Invite holds a seat for one', async () => {
    const { g, game } = await opened();
    g.fake.social.friendList = [
      {
        id: 2,
        username: 'Sam',
        avatar: '',
        look: '',
        guest: false,
        presence: null,
        notifyOnline: false,
        since: 0,
        lastSeenAt: 0,
      },
      {
        id: 5,
        username: 'Ann',
        avatar: '',
        look: '',
        guest: false,
        presence: null,
        notifyOnline: false,
        since: 0,
        lastSeenAt: 0,
      },
    ];
    lobby(game);
    await g.settle();
    g.press('turns-invite');
    await g.settle();
    expect(has(g, 'turns-invite-2')).toBe(false); // already seated
    g.press('turns-invite-5');
    await g.settle();
    expect(g.fake.log.last('turns.invite')?.args[0]).toEqual([5]);
    expect(game.summary.seats[2]).toMatchObject({ status: 'invited', userId: 5 });
  });

  it('the creator takes a player out after confirming; nobody else sees Remove', async () => {
    const { g, game } = await opened();
    lobby(game);
    await g.settle();
    expect(has(g, 'turns-remove-0')).toBe(false); // never their own seat
    g.press('turns-remove-1');
    await g.settle();
    g.press('confirm-yes');
    await g.settle();
    expect(g.fake.log.last('turns.kick')?.args[0]).toBe(1);
    expect(game.summary.seats[1]).toMatchObject({ status: 'open' });

    lobby(game, false);
    await g.settle();
    expect(has(g, 'turns-remove-0')).toBe(false);
    expect(has(g, 'turns-remove-1')).toBe(false);
  });
});

describeIf(HAS.turns, 'this game declares no game.turns')('a board with its own seats: remove', () => {
  it("the board's remove (the creator's) asks first, then takes the player out", async () => {
    const seen: { board: TurnBoard | null } = { board: null };
    const g = await boot({
      before: (f) => (f.saved.opened = { id: 'tg-r', kind: 'turns' }),
      patch: {
        turns: {
          ...toyTurns,
          draw: (ctx, el, b) => {
            seen.board = b;
            toyTurns.draw(ctx, el, b);
          },
        },
      },
    });
    await g.settle();
    const game = g.fake.turns.games.get('tg-r');
    if (!game) throw new Error('not opened');
    game.turnChanged({ isMine: true });
    await g.settle();
    const remove = seen.board?.remove ?? null;
    expect(remove).not.toBe(null);
    remove?.(1);
    await g.settle();
    g.press('confirm-yes');
    await g.settle();
    expect(g.fake.log.last('turns.kick')?.args[0]).toBe(1);
    game.turnChanged({ isMine: false });
    await g.settle();
    expect(seen.board?.remove).toBe(null);
  });
});

describeIf(HAS.turns, 'this game declares no game.turns')('chat follows who sits there', () => {
  it('the text box appears once the hub allows free text (a friend sat down), with the earlier lines kept', async () => {
    const { g, game } = await opened();
    game.chatMode = 'quick';
    game.turnChanged({});
    await g.settle();
    expect(has(g, 'chat-input')).toBe(false);
    game.chatFrom({ from: 2, at: 0, text: 'hello', quick: 'hi' });
    await g.settle();
    game.chatMode = 'on';
    game.turnChanged({});
    await g.settle();
    expect(has(g, 'chat-input')).toBe(true);
    expect(g.ui.querySelectorAll('[data-testid="chat"]').length).toBe(1);
  });
});

describeIf(HAS.turns, 'this game declares no game.turns')('joining others: Anyone, games waiting, a code', () => {
  /** Type into Join with a code and press Join. */
  const typeCode = (g: Booted, text: string): void => {
    const input = g.ui.querySelector<HTMLInputElement>('[data-testid="join-code"]');
    if (!input) throw new Error('no join-code box');
    input.value = text;
    g.press('join-code-go');
  };

  it('Anyone takes a seat in a game that is waiting instead of making one', async () => {
    const g = await boot();
    g.fake.turns.lobbies = [openTurnGame({ id: 'open-1' })];
    g.press('turns-new');
    g.press('turns-anyone');
    expect(has(g, 'looking')).toBe(true);
    await g.settle();
    expect(g.fake.log.last('turns.join')?.args[0]).toBe('open-1');
    expect(g.fake.log.count('turns.create')).toBe(0);
    expect(has(g, 'looking')).toBe(false);
    expect(g.hook.screen()).toBe('turns');
  });

  it('Anyone skips a game taken meanwhile or full, then makes one anyone can join that starts by itself', async () => {
    const g = await boot();
    g.fake.turns.lobbies = [openTurnGame({ id: 'gone' }), openTurnGame({ id: 'full', taken: 2, seats: 2 })];
    g.fake.turns.taken.add('gone');
    g.press('turns-new');
    g.press('turns-anyone');
    await g.settle();
    expect(g.fake.log.calls.filter((c) => c.name === 'turns.join').map((c) => c.args[0])).toEqual(['gone']);
    expect(g.fake.log.last('turns.create')?.args[0]).toMatchObject({ public: true, autoStart: true });
    expect(g.hook.screen()).toBe('turns');
  });

  it('Anyone on a hub without openLobbies makes a game anyone can join', async () => {
    const g = await boot();
    g.fake.turns.lobbiesError = true;
    g.press('turns-new');
    g.press('turns-anyone');
    await g.settle();
    expect(g.fake.log.last('turns.create')?.args[0]).toMatchObject({ public: true, autoStart: true });
  });

  it('the chooser lists the games waiting ("Sam is waiting", seats) with Join, and More games online', async () => {
    const g = await boot();
    g.fake.turns.lobbies = [openTurnGame({ id: 'open-7', host: 'Sam', taken: 1, seats: 3 })];
    g.press('turns-new');
    await g.settle();
    const row = g.ui.querySelector('[data-testid="turns-open-open-7"]')?.textContent ?? '';
    expect(row).toContain('Sam is waiting');
    expect(row).toContain('1 of 3 players');
    g.press('turns-open-join-open-7');
    await g.settle();
    expect(g.fake.log.last('turns.join')?.args[0]).toBe('open-7');
    expect(has(g, 'turns-who')).toBe(false);
    expect(g.hook.screen()).toBe('turns');

    const h = await boot();
    h.press('turns-new');
    await h.settle();
    expect(h.ui.querySelector('[data-testid="turns-open"]')?.textContent).toBe('Nobody is waiting right now.');
    h.press('turns-more');
    expect(h.fake.log.count('social.openPlayOnline')).toBe(1);
  });

  it('More games online is left out on a runtime without the Play online sheet', async () => {
    const g = await boot({ before: (f) => (f.social.openPlayOnline = undefined) });
    g.press('turns-new');
    expect(has(g, 'turns-more')).toBe(false);
  });

  it('Join with a code: a pasted invite link takes the seat; nonsense says so and stays', async () => {
    const g = await boot();
    g.press('turns-new');
    typeCode(g, 'what?');
    await g.settle();
    expect(g.fake.log.count('turns.join')).toBe(0);
    expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toBe("That code doesn't look right.");
    expect(has(g, 'turns-who')).toBe(true);
    typeCode(g, 'https://example.test/mygame/?hub_turn_link=AbC_123-xyz789');
    await g.settle();
    expect(g.fake.log.last('turns.join')?.args[0]).toBe('AbC_123-xyz789');
    expect(g.hook.screen()).toBe('turns');
  });
});
