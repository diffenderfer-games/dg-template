// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freeBlock, gamePortBlock, portFree } from '../../scripts/kit/lib/ports.ts';
import { serveDist } from '../../scripts/kit/lib/serve.ts';
import { KIT_SCENARIOS } from '../../scripts/kit/shots/scenarios.ts';

describe('ports', () => {
  it('a free block never touches 8099', async () => {
    const p = await freeBlock(8091, 8200);
    expect(p > 8099 || p + 3 < 8099).toBe(true);
    expect(await portFree(p)).toBe(true);
  });

  it('the hub game-server block for a front port', () => {
    expect(gamePortBlock(8490)).toEqual([20000 + (8490 % 90) * 300, 20000 + (8490 % 90) * 300 + 299]);
  });
});

describe('serveDist', () => {
  it('serves dist under /<slug>/ only, and never outside dist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<p>hi</p>');
    writeFileSync(join(dir, 'assets', 'a.js'), 'x');
    const { url, server } = await serveDist(dir, 'my-game');
    try {
      expect(url).toMatch(/\/my-game\/$/);
      const index = await fetch(url);
      expect(index.headers.get('content-type')).toBe('text/html');
      expect(await index.text()).toBe('<p>hi</p>');
      expect((await fetch(`${url}assets/a.js`)).headers.get('content-type')).toBe('text/javascript');
      expect((await fetch(new URL('/_api/me', url))).status).toBe(404);
      expect((await fetch(`${url}..%2F..%2Fsecret`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});

describe('screenshot scenarios', () => {
  it('names are unique; planned ones say which hub phase they wait on', () => {
    const names = KIT_SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of KIT_SCENARIOS.filter((x) => x.skip)) expect(s.skip).toMatch(/^waits on /);
    expect(names).toEqual(expect.arrayContaining(['title', 'pause', 'hub-menu', 'daily-done', 'lobby', 'race-result']));
  });
});
