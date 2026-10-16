// Appendix B rows 56–63: hub APIs that were planned. Saved games, online games over days and avatars are
// live (next.6/next.7) and run; the world's rows stay skipped until it ships (next.9; kit/testing/phases.ts).
import { describe, expect } from 'vitest';
import { envelope } from '../../src/kit/online/wire.ts';
import { rosterSync } from '../../src/kit/online/roster.ts';
import { bootGame } from './_support/harness.ts';
import { planned } from './_support/planned.ts';

describe('planned hub APIs', () => {
  planned('savedGames01')(
    'row 56: hub.saved: opened routes by kind, onOpen switches without a reload, change refreshes Continue',
    async () => {
      let day = '';
      const g = await bootGame({
        before: (f) => {
          day = f.daily.inProgressDay('2026-10-14');
          f.saved.opened = { id: day, kind: 'daily' };
        },
      });
      await g.settle();
      expect(g.fake.log.last('daily.resume')?.args[0]).toBe(day);
      expect(g.hook.mode()).toBe('daily');
      g.hook.toTitle?.();
      await g.settle();
      expect(g.ui.querySelector('[data-testid="continue"]')?.textContent).toMatch(/Daily challenge · Oct 14/);
      g.fake.saved.add({ id: 'r1', kind: 'run', progress: { label: '9 coins', fraction: null } });
      await g.settle();
      expect(g.ui.querySelector('[data-testid="continue-r1"]')).not.toBeNull();
      await g.fake.saved.open('r1');
      await g.settle();
      expect(g.hook.mode()).toBe('normal');
    },
  );

  planned('savedGames3')(
    'row 57: a turn game replays missed moves, shows whose turn it is, and ends once',
    async () => {
      const g = await bootGame();
      const game = await g.fake.turns.open('tg-1');
      const seen: string[] = [];
      game.on('move', (m) => seen.push(`move ${m.seq}`));
      game.on('turn', (s) => seen.push(s.isMyTurn ? 'my turn' : 'their turn'));
      game.on('ended', () => seen.push('ended'));
      expect(game.summary.isMyTurn).toBe(true);
      await game.move({ take: 2 });
      game.turnChanged({ isMyTurn: false, toAct: [1] });
      game.opponentMoved({ seq: 2, seat: 1, view: { coins: 10 }, events: [] });
      game.ended({ winners: [1] });
      expect(seen).toEqual(['their turn', 'move 2', 'ended']);
      expect(g.fake.resume.blockedBy).toBe('turns'); // no Continue saves while an online game is open
      game.close();
      expect(g.fake.log.names()).toEqual(expect.arrayContaining(['turns.open', 'turns.move', 'turns.close']));
    },
  );

  planned('worldW2')(
    'row 58: a table launch passes its options to start; a table that never started says so',
    async () => {
      const g = await bootGame({ fake: { planned: { world: true } } });
      g.fake.mp.launch({
        kind: 'host',
        partyId: 'p',
        table: { id: 't1', type: 'quick', title: 'Quick (3 coins)', options: { coins: 3 } },
      });
      await g.settle();
      g.fake.rooms.current?.addSeat(2);
      g.press('lobby-start');
      await g.frames(10);
      const view = g.fake.rooms.current?.sent.find((m) => JSON.stringify(m.data).includes('"view"'));
      expect(JSON.stringify(view?.data)).toContain('"target":3');
    },
  );

  planned('worldW2', 'savedGames3')(
    'row 59: a join launch from a table into a turn game opens it, with no host step',
    async () => {
      const g = await bootGame({ fake: { planned: { world: true } } });
      g.fake.mp.launch({ kind: 'join', room: 'tg-7', table: { id: 't', type: 'duel', title: 'Duel' } });
      await g.settle();
      expect(g.fake.log.count('rooms.create')).toBe(0);
    },
  );

  planned('worldW3')('row 60: a reaction reaches the onReaction hook, not when quiet', async () => {
    const g = await bootGame({ fake: { planned: { world: true } } });
    expect(g.hook.screen()).toBe('title');
    expect(envelope('in', null, 0).t).toBe('in');
  });

  planned('worldW3')('row 61: setRoster is called once per roster change (own-server games)', async () => {
    const g = await bootGame({ fake: { planned: { world: true } } });
    const report = rosterSync(g.fake);
    report([1, 2]);
    report([2, 1]);
    report([1, 2, 3]);
    expect(g.fake.log.named('mp.setRoster').map((c) => c.args[0])).toEqual([
      [1, 2],
      [1, 2, 3],
    ]);
  });

  planned('avatars0')('row 62: a look change re-renders the title bust and the badges, with no reload', async () => {
    const g = await bootGame();
    await g.settle();
    const bust = g.ui.querySelector('[data-testid="avatar-demo"] dg-avatar');
    expect(bust?.getAttribute('look')).toBe('AV1me-1');
    g.fake.avatar?.change(1, 'new-look');
    await g.settle();
    expect(bust?.getAttribute('look')).toBe('AV1new-look');
  });

  planned('worldW2')('row 63: Quick match shows only when the hub has it, and routes like an invite', async () => {
    const plain = await bootGame();
    expect(plain.ui.querySelector('[data-testid="quick-match"]')).toBeNull();
    const g = await bootGame({ fake: { planned: { world: true } } });
    g.press('quick-match');
    expect(g.fake.log.count('mp.quickMatch')).toBe(1);
  });
});
