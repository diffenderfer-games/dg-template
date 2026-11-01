import { describe, expect, it } from 'vitest';
import { manifestFacts } from '../../../src/kit/core/manifest.ts';
import { FakeHub } from '../../../src/kit/testing/index.ts';

describe('manifest: the game block the kit reads', () => {
  it("gives the game's stable id (game.id), or null when it declares none", () => {
    expect(manifestFacts({ id: 'wordle', slug: 'shmeplz' }).id).toBe('wordle');
    expect(manifestFacts({ slug: 'shmeplz' }).id).toBeNull();
    expect(manifestFacts({ id: 'Not An Id' }).id).toBeNull();
    expect(manifestFacts(undefined).id).toBeNull();
  });

  it('the fake hub defaults its slug (the harness passes the game id)', () => {
    expect(new FakeHub().slug).toBe('mygame');
    expect(new FakeHub({ slug: 'other' }).slug).toBe('other');
  });
});
