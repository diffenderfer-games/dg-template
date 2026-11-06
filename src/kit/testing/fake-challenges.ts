/**
 * kit/testing: challenges for another game (`hub.challenges`, docs/hub.md "Challenges").
 * Source: dg-template src/kit/testing/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md
 *
 * Behaviour from the client (core/challenges): `requested` is the id the page
 * was opened with; `active` answers the challenge (asked once); `complete`
 * answers `{ status, returnTo, token, move }` and the first result stands;
 * `goBack` is recorded (the page would load `returnTo`). Off by default, like
 * a client older than next.21: `createFakeHub({ planned: { challenges: true } })`,
 * then `open(...)` before boot.
 */
import type { ChallengesLike, KitChallenge, KitChallengeCompletion } from '../core/planned.ts';
import type { CallLog } from './calls.ts';
import { fakeHubError } from './fake-room.ts';

/** A challenge: open, Easy, for Diffenopoly, seed 1234. */
export function fakeChallenge(c: Partial<KitChallenge> = {}): KitChallenge {
  return {
    id: 'ch_fakefakefakefakefake0',
    game: 'mygame',
    from: 'diffenopoly',
    fromTitle: 'Diffenopoly',
    level: 'easy',
    seed: 1234,
    status: 'open',
    returnTo: '/diffenopoly/?hub_open=sg_TABLE&hub_kind=turns',
    expiresAt: 30 * 60 * 1000,
    ...c,
  };
}

/** `hub.challenges`, faked. */
export class FakeChallenges implements ChallengesLike {
  private readonly log: CallLog;
  /** The challenge the page was opened for (`open`), or null. */
  challenge: KitChallenge | null = null;
  /** The next `complete` fails (offline), once per count. */
  failCompletes = 0;
  /** `active` never answers (a hub that is slow to reply). */
  hang = false;
  private answer: KitChallengeCompletion | null = null;
  private lookup: Promise<KitChallenge | null> | null = null;

  constructor(log: CallLog) {
    this.log = log;
  }

  /** The page was opened at `/<game>/?hub_challenge=<id>` for this challenge (call before boot). */
  open(c: Partial<KitChallenge> = {}): KitChallenge {
    this.challenge = fakeChallenge(c);
    return this.challenge;
  }

  get requested(): string | null {
    return this.challenge?.id ?? null;
  }

  get active(): Promise<KitChallenge | null> {
    this.lookup ??= this.hang ? new Promise<never>(() => undefined) : Promise.resolve(this.challenge);
    return this.lookup;
  }

  complete(id: string, result: { readonly won: boolean }): Promise<KitChallengeCompletion> {
    this.log.record('challenges.complete', id, result);
    const c = this.challenge;
    if (c === null || c.id !== id) return Promise.reject(fakeHubError('not_found', { status: 404 }));
    if (this.failCompletes > 0) {
      this.failCompletes--;
      return Promise.reject(fakeHubError('offline', { status: 0 }));
    }
    this.answer ??= { status: result.won ? 'won' : 'lost', returnTo: c.returnTo, token: null, move: 'sent' };
    return Promise.resolve(this.answer);
  }

  goBack(to: { readonly returnTo: string }): void {
    this.log.record('challenges.goBack', to.returnTo);
  }
}
