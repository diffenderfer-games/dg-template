import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAges, checkBoards, checkChanges, checkLabels, checkWorld } from '../../scripts/kit/lib/game-block.ts';
import {
  compareVersions,
  driftedFiles,
  hashText,
  readKitManifest,
  writeKitManifest,
} from '../../scripts/kit/lib/kit-manifest.ts';
import { expandPath, KIT_MODULES, moduleFiles } from '../../scripts/kit/lib/modules.ts';

describe('kit.json: versions and hashes', () => {
  it('hashes ignore line endings (a CRLF checkout matches the template)', () => {
    expect(hashText('a\r\nb\r\n')).toBe(hashText('a\nb\n'));
    expect(hashText('a')).not.toBe(hashText('b'));
  });

  it('round-trips kit.json and finds edited and missing files', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-'));
    writeFileSync(join(root, 'a.ts'), 'one\n');
    writeFileSync(join(root, 'b.ts'), 'two\n');
    writeKitManifest(root, {
      kitVersion: '1.2',
      modules: { m: { version: '1.1', files: { 'a.ts': hashText('one\n'), 'b.ts': hashText('two\n'), 'c.ts': 'x' } } },
    });
    const back = readKitManifest(root);
    expect(back?.kitVersion).toBe('1.2');
    writeFileSync(join(root, 'b.ts'), 'edited\n');
    const entry = back?.modules.m;
    expect(entry && driftedFiles(root, entry)).toEqual({ edited: ['b.ts'], missing: ['c.ts'] });
  });

  it('compares versions numerically', () => {
    expect(compareVersions('1.10', '1.9')).toBe(1);
    expect(compareVersions('1.0', '1')).toBe(0);
    expect(compareVersions('0.9', '1.0')).toBe(-1);
  });

  it('every module owns its src folder, and expandPath lists files with / separators', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-'));
    expect(expandPath(root, 'nothing')).toEqual([]);
    expect(KIT_MODULES.core?.paths).toContain('src/kit/core');
    const core = KIT_MODULES.core;
    if (core) expect(moduleFiles(process.cwd(), core)).toContain('src/kit/core/clock.ts');
  });
});

describe('kit:check: the game block', () => {
  it("what's new is written for kids", () => {
    expect(checkChanges(['You can now pause with the Escape key.', { id: 'x', text: 'New levels!' }])).toEqual([]);
    expect(checkChanges(['Refactored the save code'])[0]).toMatch(/developer talk/);
    expect(checkChanges(['Fix #12 in the menu'])[0]).toMatch(/developer talk/);
    expect(checkChanges(['x'.repeat(281)])[0]).toMatch(/280/);
    expect(checkChanges(['Now you can shoot the rocks'])[0]).toMatch(/violent/);
    expect(checkChanges([42])[0]).toMatch(/string/);
  });

  it('labels come from the hub vocabulary', () => {
    expect(checkLabels(['arcade', '2d', 'phone'])).toEqual([]);
    expect(checkLabels(['shooter'])[0]).toMatch(/shooter/);
  });

  it('ages are { min } or { min, max }, from 2, max no lower than min', () => {
    expect(checkAges(undefined)).toEqual([]);
    expect(checkAges({ min: 6 })).toEqual([]);
    expect(checkAges({ min: 2, max: 9 })).toEqual([]);
    expect(checkAges({ min: 1 })[0]).toMatch(/^ages.min/);
    expect(checkAges({ min: 6, max: 4 })).toEqual(['ages.max: at least ages.min']);
    expect(checkAges({ min: 6.5 })[0]).toMatch(/^ages.min/);
    expect(checkAges({ min: 6, upTo: 9 })[0]).toMatch(/upTo/);
    expect(checkAges('6+')[0]).toMatch(/^ages:/);
  });

  it('every board used in code is declared', () => {
    expect(checkBoards({ leaderboards: [{ key: 'high', title: 'High' }] }, ['high'])).toEqual([]);
    expect(checkBoards({}, ['high'])[0]).toMatch(/high/);
  });

  it('game.world is the live shape: a map file, a generated room, or both (hub.md "The world")', () => {
    expect(checkWorld(undefined)).toEqual([]);
    expect(checkWorld({ map: 'world/lobby.json' })).toEqual([]);
    expect(checkWorld({ generate: { type: 'lounge', needs: { tables: 4, game: 'My Game' } } })).toEqual([]);
    expect(checkWorld({})[0]).toMatch(/needs a map file, a generate block, or both/);
    expect(checkWorld({ map: 'world/lobby.tmj' })[0]).toMatch(/world.map: must be a .json map file/);
    // The W2 tables are not in the manifest yet: the strict schema refuses them.
    expect(checkWorld({ tables: [{ key: 'classic', title: 'Classic', players: [2, 4] }] }).join()).toMatch(/tables/);
  });
});
