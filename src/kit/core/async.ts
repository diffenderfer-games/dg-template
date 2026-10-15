/**
 * kit/core: small async helpers (single flight, timeouts, a serial queue).
 * Source: dg-template src/kit/core/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/core.md
 */
import type { Clock } from './clock.ts';

/** Share one in-flight call: callers during a call get the same promise; a later call starts a new one. */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** `p`, or `fallback` when it takes longer than `ms` or rejects. */
export function withTimeout<T>(clock: Clock, p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const cancel = clock.after(ms, () => resolve(fallback));
    p.then(
      (v) => {
        cancel();
        resolve(v);
      },
      () => {
        cancel();
        resolve(fallback);
      },
    );
  });
}

/** A promise that resolves after `ms` on `clock`. */
export function delay(clock: Clock, ms: number): Promise<void> {
  return new Promise((resolve) => clock.after(ms, resolve));
}

/** Run a promise for its side effect; a rejection goes to `onError` (default: ignored). */
export function fireAndForget(p: Promise<unknown>, onError: (e: unknown) => void = () => undefined): void {
  p.catch(onError);
}

/** Thrown into a queued task's caller when the task before it hung. */
export class QueueHangError extends Error {
  constructor(ms: number) {
    super(`a queued task took longer than ${ms} ms`);
    this.name = 'QueueHangError';
  }
}

/**
 * One-at-a-time tasks (skipbo `roomTask`): each task waits for the previous one.
 * A task that takes longer than `hangMs` is abandoned (its caller gets a
 * `QueueHangError`), so one stuck call can't freeze the queue for good.
 */
export function serialQueue(clock: Clock, opts: { hangMs?: number } = {}): <T>(task: () => Promise<T>) => Promise<T> {
  const hangMs = opts.hangMs ?? 20_000;
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(
      () =>
        new Promise<T>((resolve, reject) => {
          const cancel = clock.after(hangMs, () => reject(new QueueHangError(hangMs)));
          task().then(
            (v) => {
              cancel();
              resolve(v);
            },
            (e: unknown) => {
              cancel();
              reject(e instanceof Error ? e : new Error(String(e)));
            },
          );
        }),
    );
    tail = run.catch(() => undefined);
    return run;
  };
}
