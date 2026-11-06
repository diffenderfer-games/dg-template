// Challenges for another game (docs/kit/challenges.md): the page opened at `?hub_challenge=` for Diffenopoly.
import { describe, expect, it } from 'vitest';
import { CHALLENGE_RETURN_MS } from '../../src/kit/challenges/index.ts';
import type { ChallengeHooks } from '../../src/kit/boot/index.ts';
import type { KitChallenge } from '../../src/kit/core/planned.ts';
import type { Profile, Run } from '../../src/game/state.ts';
import { bootGame, PROBE } from './_support/harness.ts';

/** The game's own `challenge` hook, or a stand-in built from its `newRun` (the kit's part is what is tested). */
const challengeHook: ChallengeHooks<Profile, Run> = PROBE.challenge ?? {
  play: (ctx, o) => PROBE.newRun(ctx, { mode: 'normal', seed: o.seed, rng: o.rng }),
  goal: (level) => `A ${level} goal`,
};

function bootChallenge(c: Partial<KitChallenge> = {}) {
  return bootGame({
    fake: { planned: { challenges: true } },
    before: (f) => void f.challenges?.open(c),
    patch: { challenge: challengeHook },
  });
}

describe('a challenge for another game (hub.challenges)', () => {
  it('plays straight away at boot, with the banner, and saves nothing for Continue', async () => {
    const g = await bootChallenge({ seed: 77 });
    expect(g.hook.mode()).toBe('challenge');
    expect(g.hook.screen()).toBe('play');
    expect(g.ui.querySelector('[data-testid="challenge-banner"]')?.textContent).toContain('Challenge for Diffenopoly');
    g.hook.addScore?.(50);
    g.hook.pause?.();
    expect(g.fake.log.count('resume.save')).toBe(0);
  });

  it('a win is reported once; the result goes back to the game it was for (button, or by itself)', async () => {
    const g = await bootChallenge();
    g.hook.solveNow?.();
    await g.frames(3);
    expect(g.hook.screen()).toBe('result');
    expect(g.fake.log.named('challenges.complete').map((c) => c.args[1])).toEqual([{ won: true }]);
    expect(g.fake.log.count('submitScore')).toBe(0);
    expect(g.calls.count('onResult')).toBe(0);
    expect(g.ui.querySelector('[data-testid="play-again"]')).toBeNull();
    expect(g.ui.querySelector('[data-testid="challenge-back"]')?.textContent).toContain('Back to Diffenopoly');
    g.press('challenge-back');
    await g.settle();
    expect(g.fake.log.count('challenges.goBack')).toBe(1);
    g.fake.clock.advance(CHALLENGE_RETURN_MS);
    expect(g.fake.log.count('challenges.goBack')).toBe(1);
  });

  it('Quit before the end asks to give up first; giving up is reported as lost and goes back', async () => {
    const g = await bootChallenge();
    g.hook.toTitle?.();
    await g.settle();
    expect(g.fake.log.count('challenges.complete')).toBe(0);
    g.press('confirm-yes');
    await g.frames(2);
    expect(g.fake.log.named('challenges.complete').map((c) => c.args[1])).toEqual([{ won: false }]);
    expect(g.hook.screen()).toBe('result');
    g.fake.clock.advance(CHALLENGE_RETURN_MS);
    await g.settle();
    expect(g.fake.log.count('challenges.goBack')).toBe(1);
  });

  it('a game without the hook shows the title and says so; a page not opened for one is untouched', async () => {
    const g = await bootGame({ fake: { planned: { challenges: true } }, before: (f) => void f.challenges?.open() });
    if (PROBE.challenge === undefined) {
      expect(g.hook.screen()).toBe('title');
      expect(g.ui.querySelector('[data-testid="toast"]')?.textContent).toContain("doesn't have challenges yet");
    }
    const plain = await bootGame({ fake: { planned: { challenges: true } } });
    expect(plain.hook.screen()).toBe('title');
    expect(plain.fake.log.count('challenges.complete')).toBe(0);
  });
});
