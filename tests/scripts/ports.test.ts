import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { freeBlock, portFree } from '../../scripts/kit/lib/ports.ts';

const held: Server[] = [];
function hold(port: number, host: string): Promise<void> {
  const s = createServer();
  held.push(s);
  return new Promise((done) => s.listen(port, host, done));
}
afterEach(async () => {
  await Promise.all(held.splice(0).map((s) => new Promise((done) => s.close(done))));
});

describe('ports', () => {
  it('sees a port held on 127.0.0.1 only (a dual-stack probe misses it on Windows)', async () => {
    await hold(8731, '127.0.0.1');
    expect(await portFree(8731)).toBe(false);
  });

  it('sees a port held on 0.0.0.0', async () => {
    await hold(8741, '0.0.0.0');
    expect(await portFree(8741)).toBe(false);
  });

  it('skips a block with a busy port', async () => {
    await hold(8752, '127.0.0.1');
    expect(await freeBlock(8751, 8800)).not.toBe(8751);
  });
});
