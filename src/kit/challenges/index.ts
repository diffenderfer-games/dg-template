/**
 * kit/challenges: a challenge for another game (Diffenopoly's Game mode), through `hub.challenges`.
 * Source: dg-template src/kit/challenges/ (kit v1.37). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/challenges.md
 *
 * The page was opened at `/<game>/?hub_challenge=<id>` (the hub client takes
 * the parameter off the address at load). At boot the router asks this
 * module first (after a race or a launch): it reads `hub.challenges.active`
 * (8 s at most) and
 * - plays an `open` one with the game's `challenge.play({ seed, level })`;
 * - finishes one already finished again (a reload: the hub answers the same)
 *   and goes straight back;
 * - says so for one out of time, for a game without the `challenge` hook,
 *   or when it can't be read, with a "Back to …" button; the title shows.
 * At the end the session calls `finish(won)` once: `hub.challenges.complete`
 * (retried from a toast when it fails), then the result screen's "Back to
 * …" (and, after {@link CHALLENGE_RETURN_MS}, the kit itself) goes back to
 * `returnTo`.
 */
import { withTimeout } from '../core/async.ts';
import type { Clock } from '../core/clock.ts';
import type { HubLike } from '../core/hub-like.ts';
import type { KitChallenge, KitChallengeCompletion } from '../core/planned.ts';
import { t } from '../core/strings.ts';

/** How long the router waits for the hub to answer which challenge it is. */
export const CHALLENGE_LOOKUP_MS = 8000;

/** After the result is in, the kit goes back by itself after this long (the "Back to …" button goes at once). */
export const CHALLENGE_RETURN_MS = 5000;

/** How the kit handles a challenge. */
export type ChallengeOptions = {
  clock: Clock;
  /** The game has the `challenge` hook (else it says so and offers the way back). */
  playable: boolean;
  /** Play this open challenge (the session builds the game with `challenge.play`). */
  onPlay(challenge: KitChallenge): void;
  /** Tell the player something, with an optional button. */
  notify(text: string, action?: { label: string; onClick: () => void }): void;
};

/** The challenge adapter. */
export type ChallengeHandle = {
  /** The page was opened for a challenge (synchronous, at boot). */
  readonly requested: boolean;
  /** The challenge being played (or just finished), or null. */
  readonly current: KitChallenge | null;
  /** Look the challenge up and route it; true when it took the page (playing it, or on the way back). */
  route(): Promise<boolean>;
  /** The challenge ended: report it once (later calls answer the first). Null when there is none. */
  finish(won: boolean): Promise<KitChallengeCompletion | null>;
  /** Back to the game it was for (after `finish`: the hub's answer's address). */
  goBack(): void;
  /** Stop the automatic way back (the page is going away, a test). */
  dispose(): void;
};

/** "Back to {from}". */
export function backLabel(challenge: Pick<KitChallenge, 'fromTitle'>): string {
  return t('challengeBack', { from: challenge.fromTitle });
}

/** Install the challenge adapter (`null` when the hub client has no `hub.challenges`). */
export function installChallenges(hub: Pick<HubLike, 'challenges'>, o: ChallengeOptions): ChallengeHandle | null {
  const api = hub.challenges;
  if (api === undefined) return null;
  const requested = api.requested !== null;
  let current: KitChallenge | null = null;
  let done: Promise<KitChallengeCompletion | null> | null = null;
  let answer: KitChallengeCompletion | null = null;
  let leaving = false;
  let cancelReturn: (() => void) | null = null;

  const leave = (to: { returnTo: string }): void => {
    if (leaving) return;
    leaving = true;
    cancelReturn?.();
    api.goBack(to);
  };

  /** Report the result; a failure offers Try again (the hub's first answer stands, so a retry is safe). */
  const report = async (challenge: KitChallenge, won: boolean): Promise<KitChallengeCompletion | null> => {
    try {
      answer = await api.complete(challenge.id, { won });
      cancelReturn = o.clock.after(CHALLENGE_RETURN_MS, () => answer !== null && leave(answer));
      return answer;
    } catch {
      return new Promise((resolve) =>
        o.notify(t('challengeSendFailed'), {
          label: t('tryAgain'),
          onClick: () => void report(challenge, won).then(resolve),
        }),
      );
    }
  };

  const offerBack = (text: string, challenge: KitChallenge): void =>
    o.notify(text, { label: backLabel(challenge), onClick: () => leave(challenge) });

  const finish = (won: boolean): Promise<KitChallengeCompletion | null> => {
    if (current === null) return Promise.resolve(null);
    done ??= report(current, won);
    return done;
  };

  return {
    requested,
    get current() {
      return current;
    },
    async route() {
      if (!requested) return false;
      const challenge = await withTimeout(o.clock, api.active, CHALLENGE_LOOKUP_MS, null);
      if (challenge === null) {
        o.notify(t('challengeMissing'));
        return false;
      }
      if (challenge.status === 'expired') {
        offerBack(t('challengeExpired'), challenge);
        return false;
      }
      if (challenge.status !== 'open') {
        // Finished already (a reload after the end): the hub answers the same result; back we go.
        current = challenge;
        const finished = await finish(challenge.status === 'won');
        leave(finished ?? challenge);
        return true;
      }
      if (!o.playable) {
        offerBack(t('challengeNotHere'), challenge);
        return false;
      }
      current = challenge;
      o.onPlay(challenge);
      return true;
    },
    finish,
    goBack() {
      if (answer !== null) leave(answer);
      else if (current !== null && done === null) leave(current);
      // (reporting: the way back waits for the hub's answer, which goes back by itself)
      else if (done !== null) void done.then((a) => leave(a ?? current ?? { returnTo: '/' }));
    },
    dispose() {
      cancelReturn?.();
    },
  };
}
