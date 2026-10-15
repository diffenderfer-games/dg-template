import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BAD_TICKET_CLOSE,
  createGameServer,
  portFromEnv,
  resolveFile,
  SeatTable,
  verifyPlayer,
} from '../../../src/kit/server/index.ts';

const dist = mkdtempSync(join(tmpdir(), 'dist-'));
mkdirSync(join(dist, 'assets'));
writeFileSync(join(dist, 'index.html'), '<html>app</html>');
writeFileSync(join(dist, 'assets', 'a.js'), 'x');

let base = '';
const srv = createGameServer({ dist, onUpgrade: (_req, socket) => socket.destroy() });
beforeAll(async () => {
  base = `http://127.0.0.1:${await srv.listen(0)}`;
});
afterAll(() => void srv.server.close());

describe('game server', () => {
  it('serves files with their type, the app for routes, 404 for missing assets', async () => {
    const js = await fetch(`${base}/assets/a.js`);
    expect(js.headers.get('content-type')).toBe('text/javascript');
    expect(await (await fetch(`${base}/play/level/3`)).text()).toBe('<html>app</html>');
    expect((await fetch(`${base}/assets/missing.png`)).status).toBe(404);
  });

  it('never serves outside dist', () => {
    expect(resolveFile(dist, '/../../etc/passwd')).not.toMatch(/passwd$/);
  });

  it('answers /healthz at once (the catalog waits at most 15 s)', async () => {
    const r = await fetch(`${base}/healthz`);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('PORT or GAME_PORT picks the port', () => {
    expect(portFromEnv({ PORT: '4100' })).toBe(4100);
    expect(portFromEnv({ GAME_PORT: '4200' })).toBe(4200);
    expect(portFromEnv({}, 9)).toBe(9);
  });

  it('a bad ticket is refused (close 4401)', async () => {
    expect(BAD_TICKET_CLOSE).toBe(4401);
    expect(await verifyPlayer(() => Promise.resolve({ id: 1 }), 't')).toEqual({ id: 1 });
    expect(await verifyPlayer(() => Promise.reject(new Error('bad')), 't')).toBeNull();
    expect(await verifyPlayer(() => Promise.resolve({ id: 1 }), null)).toBeNull();
  });
});

describe('SeatTable (SpacePong gameManager)', () => {
  it('holds a dropped seat for the grace, lets the same player back, then frees it', () => {
    let t = 0;
    const seats = new SeatTable<string>(() => t);
    seats.sit(0, 'tok-a', 'Ann');
    seats.sit(1, 'tok-b', 'Bo');
    seats.hold(1, 1000);
    expect(seats.computerSeats()).toEqual([1]);
    t = 500;
    expect(seats.rejoin('tok-b')).toBe(1);
    seats.hold(1, 1000);
    t = 2000;
    expect(seats.expire()).toEqual([1]);
    expect(seats.rejoin('tok-b')).toBeNull();
    expect(seats.anyoneHere()).toBe(true);
  });
});
