import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHALLENGE_LOOKUP_MS,
  CHALLENGE_RETURN_MS,
  installChallenges,
  type ChallengeOptions,
} from '../../../src/kit/challenges/index.ts';
import type { KitChallenge } from '../../../src/kit/core/planned.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

let fake: FakeHub;
let played: KitChallenge[];
let notes: { text: string; action?: { label: string; onClick(): void } }[];

function install(over: Partial<ChallengeOptions> = {}) {
  const handle = installChallenges(fake, {
    clock: fake.clock,
    playable: true,
    onPlay: (c) => played.push(c),
    notify: (text, action) => notes.push(action === undefined ? { text } : { text, action }),
    ...over,
  });
  if (handle === null) throw new Error('no hub.challenges');
  return handle;
}

/** A fresh fake with `hub.challenges`, opened for a challenge with these fields. */
function opened(c: Partial<KitChallenge> = {}): FakeHub {
  fake = createFakeHub({ events: new EventTarget(), planned: { challenges: true } });
  fake.challenges?.open(c);
  return fake;
}

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget(), planned: { challenges: true } });
  played = [];
  notes = [];
});

describe('challenge adapter', () => {
  it('is off without hub.challenges (a client before next.21), and routes nothing when the page was not opened for one', async () => {
    const older = createFakeHub({ events: new EventTarget() });
    const none = installChallenges(older, {
      clock: fake.clock,
      playable: true,
      onPlay: () => undefined,
      notify: () => undefined,
    });
    expect(none).toBeNull();
    const c = install();
    expect(c.requested).toBe(false);
    expect(await c.route()).toBe(false);
    expect(await c.finish(true)).toBeNull();
  });

  it('plays an open challenge, reports the end once, then goes back by itself (or at once with the button)', async () => {
    const challenge = opened().challenges?.challenge;
    const c = install();
    expect(c.requested).toBe(true);
    expect(await c.route()).toBe(true);
    expect(played).toEqual([challenge]);
    const done = await c.finish(true);
    expect(done).toMatchObject({ status: 'won', returnTo: challenge?.returnTo });
    expect(await c.finish(false)).toBe(done);
    expect(fake.log.named('challenges.complete')).toHaveLength(1);
    expect(fake.log.count('challenges.goBack')).toBe(0);
    fake.clock.advance(CHALLENGE_RETURN_MS);
    expect(fake.log.named('challenges.goBack').map((call) => call.args)).toEqual([[challenge?.returnTo]]);
    c.goBack();
    expect(fake.log.count('challenges.goBack')).toBe(1);
  });

  it('a report that fails offers Try again', async () => {
    opened();
    if (fake.challenges) fake.challenges.failCompletes = 1;
    const c = install();
    await c.route();
    const finishing = c.finish(false);
    await fake.clock.settle();
    expect(notes.map((n) => n.text)).toEqual(["Your result didn't reach the hub yet."]);
    notes[0]?.action?.onClick();
    expect(await finishing).toMatchObject({ status: 'lost' });
    expect(fake.log.count('challenges.complete')).toBe(2);
  });

  it('one finished already (a reload) is reported again and goes straight back', async () => {
    opened({ status: 'won' });
    const c = install();
    expect(await c.route()).toBe(true);
    expect(played).toHaveLength(0);
    expect(fake.log.last('challenges.complete')?.args[1]).toEqual({ won: true });
    expect(fake.log.count('challenges.goBack')).toBe(1);
  });

  it('out of time: says so and offers the way back; the page goes to the title', async () => {
    opened({ status: 'expired' });
    expect(await install().route()).toBe(false);
    expect(notes.at(-1)?.text).toBe('This challenge ran out of time.');
    expect(notes.at(-1)?.action?.label).toBe('Back to Diffenopoly');
    notes.at(-1)?.action?.onClick();
    expect(fake.log.count('challenges.goBack')).toBe(1);
  });

  it('a game without the challenge hook says so', async () => {
    opened();
    expect(await install({ playable: false }).route()).toBe(false);
    expect(notes.at(-1)?.text).toBe("This game doesn't have challenges yet.");
    expect(played).toHaveLength(0);
  });

  it('a hub that does not answer in time: the title, with a note', async () => {
    opened();
    if (fake.challenges) fake.challenges.hang = true;
    const routed = install().route();
    fake.clock.advance(CHALLENGE_LOOKUP_MS);
    expect(await routed).toBe(false);
    expect(notes.at(-1)?.text).toBe("That challenge couldn't be opened.");
    expect(played).toHaveLength(0);
  });
});
