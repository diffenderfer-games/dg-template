/**
 * vitest setup: skip the kit tests listed in tests/kit-skips.json, with their reason.
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Kit tests that don't apply"
 *
 * Whole files are left out in vitest.config.ts; this skips single tests by name.
 */
import { beforeEach } from 'vitest';
import { listedPath, readKitSkips, skipReason } from './lib/kit-skips.ts';
import { ROOT } from './lib/paths.ts';

const { skips } = readKitSkips(ROOT);

if (skips.length > 0) {
  beforeEach((ctx) => {
    const names = [ctx.task.name];
    for (let s = ctx.task.suite; s; s = s.suite) if (s.name !== '') names.unshift(s.name);
    const reason = skipReason(skips, listedPath(ROOT, ctx.task.file.filepath), [ctx.task.name, names.join(' > ')]);
    if (reason !== null) ctx.skip(`kit-skips.json: ${reason}`);
  });
}
