// Planned hub API adapter (kit/saved), tested against the plan's shapes (FakeHub planned flags).
import { describe, expect, it } from 'vitest';
import { createSaved, rowLabel } from '../../../src/kit/saved/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';

describe('kit/saved', () => {
  it('without hub.saved: one Continue row from the saved game (or none)', async () => {
    const s = createSaved(createFakeHub({ events: new EventTarget() }), {
      continueRun: () => undefined,
      resumeDaily: () => undefined,
      openTurns: () => undefined,
    });
    expect(s.available).toBe(false);
    expect(await s.continueRows(() => Promise.resolve('Level 3'))).toEqual([
      { id: 'run', kind: 'run', label: 'Continue: Level 3' },
    ]);
    expect(await s.continueRows(() => Promise.resolve(null))).toEqual([]);
    expect(s.routeOpened()).toBe(false);
  });

  it('rows use the hub wording: Continue, Daily challenge · Oct 14, Online with Sam · your turn (never "run")', () => {
    const base = {
      game: 'g',
      status: 'active' as const,
      title: null,
      createdAt: 0,
      updatedAt: 0,
      progress: { label: '34 cards left', fraction: null },
    };
    expect(rowLabel({ ...base, id: '1', kind: 'daily', daily: { day: '2026-10-14', seed: 1 } })).toBe(
      'Daily challenge · Oct 14 (34 cards left)',
    );
    const seats = [
      { seat: 0, userId: 1, name: 'Me', status: 'joined' as const, isMe: true },
      { seat: 1, userId: 2, name: 'Sam', status: 'joined' as const, isMe: false },
    ];
    expect(
      rowLabel({
        ...base,
        id: '2',
        kind: 'turns',
        turns: { mode: null, phase: 'playing', seats, toAct: [0], isMyTurn: true, seq: 3, unseen: 0 },
      }),
    ).toBe('Online with Sam · your turn');
    expect(rowLabel({ ...base, id: '3', kind: 'run' })).toBe('Continue: 34 cards left');
  });

  it('with hub.saved: opened routes by kind', () => {
    const fake = createFakeHub({ events: new EventTarget(), planned: { savedGames: true } });
    const routed: string[] = [];
    if (fake.saved) fake.saved.opened = { id: 't9', kind: 'turns' };
    const s = createSaved(fake, {
      continueRun: () => routed.push('run'),
      resumeDaily: (id) => routed.push(`daily:${id}`),
      openTurns: (id) => routed.push(`turns:${id}`),
    });
    expect(s.routeOpened()).toBe(true);
    s.open('d', 'daily');
    expect(routed).toEqual(['turns:t9', 'daily:d']);
  });
});
