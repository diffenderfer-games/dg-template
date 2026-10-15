/**
 * scripts/kit/lib: a real hub for screenshots (the hub's own test kit, or a running instance).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Hub scenarios"
 *
 * Default: the hub test kit's `startHost` (HUB_TEST=1, a temp database, this
 * game linked in, a free port), stopped afterwards. `--url` (or DG_TEST_URL)
 * uses a running `npm run local` instead (the game must be linked there).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HUB, ROOT } from './paths.ts';

/** A hub to shoot against. */
export type HubHost = { url: string; stop: () => Promise<void> };

/** Start a test host with this game (or use `url`). */
export async function hubHost(slug: string, o: { url?: string; env?: Record<string, string> } = {}): Promise<HubHost> {
  const url = o.url ?? process.env.DG_TEST_URL;
  if (url) return { url: url.replace(/\/$/, ''), stop: () => Promise.resolve() };
  const file = join(HUB, 'test', 'helpers', 'server.mjs');
  if (!existsSync(file))
    throw new Error(`no hub test kit at ${file} (set DG_HOST, or pass --url of a running npm run local)`);
  const mod: unknown = await import(pathToFileURL(file).href);
  const start: unknown = typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'startHost') : undefined;
  if (typeof start !== 'function') throw new Error('the hub test kit has no startHost()');
  const host: unknown = await Reflect.apply(start, undefined, [{ apps: { [slug]: ROOT }, env: o.env ?? {} }]);
  const hostUrl: unknown = typeof host === 'object' && host !== null ? Reflect.get(host, 'url') : undefined;
  const stop: unknown = typeof host === 'object' && host !== null ? Reflect.get(host, 'stop') : undefined;
  if (typeof hostUrl !== 'string' || typeof stop !== 'function')
    throw new Error('startHost() returned something unexpected');
  return { url: hostUrl, stop: async () => void (await Reflect.apply(stop, host, [])) };
}
