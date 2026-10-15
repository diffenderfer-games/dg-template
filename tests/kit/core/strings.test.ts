import { afterEach, describe, expect, it } from 'vitest';
import { KIT_STRINGS, setKitStrings, shortDay, t, wordingProblems } from '../../../src/kit/core/index.ts';

describe('kit strings: the wording rule (saved-games.md §11, multiplayer.md)', () => {
  afterEach(() => setKitStrings({}));

  it('no kit string says run, turn game or instance, or uses a violent word', () => {
    for (const [key, text] of Object.entries(KIT_STRINGS)) {
      expect(wordingProblems(text, 200), key).toEqual([]);
    }
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(t('onlineWithTurn', { name: 'Sam' })).toBe('Online with Sam · your turn');
    expect(t('dailyOn', { date: shortDay('2026-10-14') })).toBe('Daily challenge · Oct 14');
    expect(t('waitingFor')).toBe('Waiting for {name}…');
  });

  it('a game can override any string', () => {
    setKitStrings({ play: 'Go!' });
    expect(t('play')).toBe('Go!');
    expect(t('continue')).toBe('Continue');
  });

  it('flags the words players must never see', () => {
    expect(wordingProblems('Your run: level 3')[0]).toMatch(/run/);
    expect(wordingProblems('Turn game with Sam')[0]).toMatch(/turn game/i);
    expect(wordingProblems('Shoot the asteroids')[0]).toMatch(/violent/);
    expect(wordingProblems('x'.repeat(61))).toHaveLength(1);
    expect(wordingProblems('Level 12 · 34 cards left')).toEqual([]);
  });
});
