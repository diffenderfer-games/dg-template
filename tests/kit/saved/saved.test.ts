// kit/saved: "Your games" (hub.saved) on the FakeHub.
import { describe, expect, it } from 'vitest';
import { createSaved, rowLabel, type SavedRoutes } from '../../../src/kit/saved/index.ts';
import { createFakeHub, savedEntry, turnSummary } from '../../../src/kit/testing/index.ts';

const routesInto = (routed: string[], turns = true): SavedRoutes => ({
  continueRun: () => routed.push('run'),
  resumeDaily: (id) => routed.push(`daily:${id}`),
  ...(turns ? { openTurns: (id: string) => routed.push(`turns:${id}`) } : {}),
});

describe('kit/saved', () => {
  it('Continue rows: the saved game and days in progress, from hub.saved', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.resume.save({ state: { level: 3 }, progress: { label: 'Level 3' } });
    fake.daily.inProgressDay('2026-10-14');
    const s = createSaved(fake, routesInto([]));
    const rows = await s.continueRows(() => Promise.resolve(null));
    expect(rows.map((r) => r.label).sort()).toEqual(['Daily challenge · Oct 14 (Started)', 'Level 3']);
    expect(s.routeOpened()).toBe(false);
  });

  it('if the list fails, the one saved game from kit/resume stands in', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    fake.saved.list = () => Promise.reject(new Error('offline'));
    const s = createSaved(fake, routesInto([]));
    expect(await s.continueRows(() => Promise.resolve('Level 3'))).toEqual([
      { id: 'run', kind: 'run', label: 'Level 3' },
    ]);
    expect(await s.continueRows(() => Promise.resolve(null))).toEqual([]);
  });

  it('rows use the hub wording: Continue, Daily challenge · Oct 14, Online with Sam · your turn (never "run")', () => {
    const progress = { label: '34 cards left', fraction: null };
    expect(rowLabel(savedEntry({ id: '1', kind: 'daily', progress, daily: { day: '2026-10-14', seed: 1 } }))).toBe(
      'Daily challenge · Oct 14 (34 cards left)',
    );
    expect(rowLabel(savedEntry({ id: '2', kind: 'turns', progress, turns: turnSummary() }))).toBe(
      'Online with Sam · your turn',
    );
    expect(rowLabel(savedEntry({ id: '3', kind: 'run', progress }))).toBe('34 cards left');
  });

  it('opened routes by kind; onOpen takes the hub menu’s picks without a reload', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const routed: string[] = [];
    fake.saved.opened = { id: 't9', kind: 'turns' };
    const s = createSaved(fake, routesInto(routed));
    expect(s.routeOpened()).toBe(true);
    s.open('d', 'daily');
    const day = fake.daily.inProgressDay('2026-10-02');
    await fake.saved.open(day);
    expect(routed).toEqual(['turns:t9', 'daily:d', `daily:${day}`]);
    expect(fake.log.count('saved.reload')).toBe(0);
  });

  it('a game with no screen for online games leaves them to the hub (a reload with ?hub_open)', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    const routed: string[] = [];
    fake.saved.opened = { id: 't9', kind: 'turns' };
    const s = createSaved(fake, routesInto(routed, false));
    expect(s.routeOpened()).toBe(false);
    fake.saved.add({ id: 'tg-1', kind: 'turns', turns: turnSummary() });
    await fake.saved.open('tg-1');
    expect(routed).toEqual([]);
    expect(fake.log.count('saved.reload')).toBe(1);
    expect((await s.continueRows(() => Promise.resolve(null))).map((r) => r.kind)).toEqual([]);
  });

  it('discard gives a day in progress up; change refreshes', async () => {
    const fake = createFakeHub({ events: new EventTarget() });
    let changes = 0;
    const s = createSaved(fake, routesInto([]), () => changes++);
    const day = fake.daily.inProgressDay('2026-10-02');
    expect((await s.dailiesInProgress()).map((g) => g.id)).toEqual([day]);
    await s.discard(day);
    expect(await s.dailiesInProgress()).toEqual([]);
    expect(changes).toBe(2);
  });
});
