// Planned hub API adapter (kit/world), tested against the plan's shapes (FakeHub planned flags).
import { describe, expect, it } from 'vitest';
import { createFakeHub } from '../../../src/kit/testing/index.ts';
import { quickMatch, worldBlock } from '../../../src/kit/world/index.ts';

describe('kit/world', () => {
  it('derives the default tables from the game block (world.md §3.1)', () => {
    expect(worldBlock({})).toBeNull();
    expect(worldBlock({ multiplayer: { players: [2, 4] }, race: true })).toEqual({
      tables: [
        { key: 'play', title: 'Play', players: [2, 4] },
        { key: 'race', title: 'Race', mode: 'race', players: [2, 2] },
      ],
    });
    expect(
      worldBlock({ multiplayer: { modes: [{ key: 'classic', title: 'Classic', players: [2, 6] }] } })?.tables[0],
    ).toMatchObject({ key: 'classic', mode: 'classic' });
  });

  it('Quick match exists only when the hub has it', async () => {
    expect(quickMatch(createFakeHub({ events: new EventTarget() }))).toBeNull();
    const hub = createFakeHub({ events: new EventTarget(), planned: { world: true } });
    await quickMatch(hub)?.('classic');
    expect(hub.log.last('mp.quickMatch')?.args[0]).toEqual({ mode: 'classic' });
  });
});
