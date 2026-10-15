/**
 * scripts/kit/lib: free ports (this machine runs many dev servers).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Ports"
 */
import { createServer } from 'node:net';

/** Is nothing listening on `port` (any address)? */
export function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const s = createServer()
      .once('error', () => done(false))
      .once('listening', () => s.close(() => done(true)));
    s.listen(port);
  });
}

/**
 * A port whose next three neighbours are free too (the hub's local instance
 * uses P, P+1 and P+2), from `from` upward in steps of 10. Never 8099 (the
 * user's own instance).
 */
export async function freeBlock(from = 8101, to = 8999): Promise<number> {
  for (let p = from; p < to; p += 10) {
    if (p <= 8099 && p + 3 >= 8099) continue;
    const ok = await Promise.all([0, 1, 2, 3].map((k) => portFree(p + k)));
    if (ok.every(Boolean)) return p;
  }
  throw new Error(`no free port block between ${from} and ${to}`);
}

/** The hub's game-server port block for a front port P: 20000 + (P % 90) × 300 (300 ports). */
export function gamePortBlock(port: number): [number, number] {
  const start = 20000 + (port % 90) * 300;
  return [start, start + 299];
}
