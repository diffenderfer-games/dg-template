import { describe, expect, it } from 'vitest';
import { QueueHangError, serialQueue, singleFlight, withTimeout } from '../../../src/kit/core/index.ts';
import { fakeClock } from '../../../src/kit/testing/index.ts';

describe('async helpers', () => {
  it('singleFlight shares one call in flight, then starts a new one', async () => {
    let calls = 0;
    let release = (): void => undefined;
    const f = singleFlight(() => {
      calls++;
      return new Promise<number>((r) => {
        release = () => r(calls);
      });
    });
    const a = f();
    const b = f();
    expect(a).toBe(b);
    release();
    expect(await a).toBe(1);
    const c = f();
    expect(c).not.toBe(a);
    release();
    expect(await c).toBe(2);
  });

  it('withTimeout returns the fallback when the promise is slow or fails', async () => {
    const clock = fakeClock();
    const slow = withTimeout(clock, new Promise<string>(() => undefined), 2500, 'fallback');
    clock.advance(2500);
    expect(await slow).toBe('fallback');
    expect(await withTimeout(clock, Promise.reject(new Error('x')), 10, 'fb')).toBe('fb');
    expect(await withTimeout(clock, Promise.resolve('ok'), 10, 'fb')).toBe('ok');
  });

  it('serialQueue runs tasks one at a time, in order (skipbo roomTask)', async () => {
    const clock = fakeClock();
    const run = serialQueue(clock);
    const order: string[] = [];
    let releaseA = (): void => undefined;
    const a = run(
      () =>
        new Promise<void>((r) => {
          releaseA = () => {
            order.push('a');
            r();
          };
        }),
    );
    const b = run(() => {
      order.push('b');
      return Promise.resolve();
    });
    await clock.settle();
    expect(order).toEqual([]);
    releaseA();
    await Promise.all([a, b]);
    expect(order).toEqual(['a', 'b']);
  });

  it('the serial queue hang guard abandons a stuck task so the queue moves on', async () => {
    const clock = fakeClock();
    const run = serialQueue(clock, { hangMs: 20_000 });
    const stuck = run(() => new Promise<void>(() => undefined));
    const next = run(() => Promise.resolve('next'));
    await clock.settle();
    clock.advance(20_000);
    await expect(stuck).rejects.toBeInstanceOf(QueueHangError);
    await expect(next).resolves.toBe('next');
  });
});
