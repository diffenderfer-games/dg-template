// Join with a code (kit/boot joining.ts): a room's 5-letter code, an online game's invite link or its key.
import { describe, expect, it } from 'vitest';
import { parseJoinCode } from '../../../src/kit/boot/joining.ts';

const both = { rooms: true, turns: true };

describe('parseJoinCode', () => {
  it('reads a room code, forgiving case, spaces and dashes', () => {
    expect(parseJoinCode('k7qpa', both)).toEqual({ kind: 'room', code: 'K7QPA' });
    expect(parseJoinCode(' K7Q-PA ', both)).toEqual({ kind: 'room', code: 'K7QPA' });
  });

  it('reads an invite link or a bare key for online games', () => {
    expect(parseJoinCode('https://x.test/g/?a=1&hub_turn_link=Key_123-abcdef', both)).toEqual({
      kind: 'turn',
      key: 'Key_123-abcdef',
    });
    expect(parseJoinCode('Key_123-abcdefgh', both)).toEqual({ kind: 'turn', key: 'Key_123-abcdefgh' });
  });

  it('only what the game has: no rooms, no room codes; no online games, no links', () => {
    expect(parseJoinCode('K7QPA', { rooms: false, turns: true })).toBeNull();
    expect(parseJoinCode('https://x.test/?hub_turn_link=Key_123-abcdef', { rooms: true, turns: false })).toBeNull();
  });

  it('nothing, look-alike letters (O, I, 0, 1) or junk is null', () => {
    expect(parseJoinCode('', both)).toBeNull();
    expect(parseJoinCode('ABCD0', both)).toBeNull();
    expect(parseJoinCode('hello there', both)).toBeNull();
  });
});
