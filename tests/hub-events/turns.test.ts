// Online games over days on the kit's screen (multiplayer.md §16.3): the title's Play over days, Your games,
// invite links, whose move it is, who is there (seat.connected), the hand-over at handOverAt, chat with the
// game's own quick-chat phrases (game.turns.quickChat), the end and the rematch. FakeHub, the stub game's board.
import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../../src/kit/core/manifest.ts';
import type { FakeTurnGame } from '../../src/kit/testing/index.ts';
import { bootGame, type Booted } from './_support/harness.ts';

const status = (g: Booted): string => g.ui.querySelector('[data-testid="turn-status"]')?.textContent ?? '';
const has = (g: Booted, testid: string): boolean => g.ui.querySelector(`[data-testid="${testid}"]`) !== null;

/** Boot, then open game `id` from Your games (`?hub_open=…&hub_kind=turns`). */
async function opened(id = 'tg-9'): Promise<{ g: Booted; game: FakeTurnGame }> {
  const g = await bootGame({ before: (f) => (f.saved.opened = { id, kind: 'turns' }) });
  await g.settle();
  const game = g.fake.turns.games.get(id);
  if (!game) throw new Error('the game was not opened');
  return { g, game };
}

describe('online games over days (kit/turns screen)', () => {
  it('the title offers Play over days; the computer makes a started game on the turns screen', async () => {
    const g = await bootGame();
    expect(MANIFEST.turns).toBe(true); // the template declares game.turns
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
    game.view = { coins: 12, turn: 0, winner: null };
    game.turnChanged({});
    await g.settle();
    g.press('take-2');
    await g.settle();
    expect(game.moves).toEqual([{ take: 2 }]);
    game.turnChanged({ isMyTurn: false, toAct: [1] });
    await g.settle();
    expect(status(g)).toBe('Sam is playing');
    expect(g.ui.querySelector<HTMLButtonElement>('[data-testid="take-1"]')?.disabled).toBe(true);
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
    const g = await bootGame({ before: (f) => (f.turns.link = 'key-1') });
    await g.settle();
    expect(g.fake.log.last('turns.join')?.args[0]).toBe('key-1');
    expect(g.hook.screen()).toBe('turns');
  });

  it('a game without a turns hook leaves online games to the hub (no button, no route)', async () => {
    const g = await bootGame({
      patch: { turns: undefined },
      before: (f) => (f.saved.opened = { id: 'tg-1', kind: 'turns' }),
    });
    await g.settle();
    expect(has(g, 'turns-new')).toBe(false);
    expect(g.fake.log.count('turns.open')).toBe(0);
    expect(g.hook.screen()).toBe('title');
  });
});
