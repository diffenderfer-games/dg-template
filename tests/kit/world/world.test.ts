// kit/world: the game's own room (game.world, live since hub client next.9; Adventure Mode next.10) and the planned W2 adapter.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapFingerprint, serializeWorldMap } from '@diffenderfer-games/world';
import { describe, expect, it } from 'vitest';
import { field } from '../../../src/kit/core/json.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';
import { quickMatch, roomPath, worldBlock } from '../../../src/kit/world/index.ts';
import { generateRequest, generateRoom, parseGameWorld, roomProblems, worldKey } from '../../../src/kit/world/room.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const declared: unknown = field(field(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')), 'game'), 'world');

describe('kit/world: your room (game.world)', () => {
  it('reads a block the hub way: seed defaults to the slug; the key is game.<slug>', () => {
    const { world } = parseGameWorld({ generate: { type: 'lounge', needs: { tables: 2 } } });
    expect(world && generateRequest(world, 'my-game')).toEqual({
      type: 'lounge',
      seed: 'my-game',
      needs: { tables: 2 },
    });
    expect(worldKey('my-game')).toBe('game.my-game');
    expect(roomPath('my-game')).toBe('/world/game.my-game');
    expect(parseGameWorld(undefined)).toEqual({ world: null, problems: [] });
  });

  it("this game's declared room generates a valid map, the same one every time", () => {
    const { world, problems } = parseGameWorld(declared);
    expect(problems).toEqual([]);
    if (world === null) return; // a game without a room of its own
    const a = generateRoom(world, 'some-slug');
    const b = generateRoom(world, 'some-slug');
    if (a === null || b === null) return; // a committed map file only
    expect(roomProblems(serializeWorldMap(a))).toEqual([]);
    expect(mapFingerprint(a)).toBe(mapFingerprint(b));
  });

  it('roomProblems reports a broken map file', () => {
    expect(roomProblems('{"format":"dg-world@1"}').length).toBeGreaterThan(0);
    expect(roomProblems('not json').length).toBeGreaterThan(0);
  });
});

describe('kit/world: tables in the world (W2, coming)', () => {
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
