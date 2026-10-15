/**
 * scripts/kit/lib: where things are (this repo, the template, the hub checkout).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Scripts"
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** This game's (or the template's) root folder. */
export const ROOT = resolve(import.meta.dirname, '..', '..', '..');

/** The template checkout to sync from: `DG_TEMPLATE`, else `../dg-template`. */
export const TEMPLATE = resolve(process.env.DG_TEMPLATE ?? join(ROOT, '..', 'dg-template'));

/** The hub checkout (its test kit and local instance): `DG_HOST`, else `../diffenderfer-games`. */
export const HUB = resolve(process.env.DG_HOST ?? join(ROOT, '..', 'diffenderfer-games'));

/** Is this repo the template itself (it still has the starters `new-game` deletes)? */
export function isTemplate(root: string = ROOT): boolean {
  return existsSync(join(root, 'src', 'starters'));
}

/** The catalog slug: `DEPLOY_SLUG`, else the folder name lowercased (the hub's own rule). */
export function slugOf(root: string = ROOT): string {
  return (process.env.DEPLOY_SLUG ?? basename(root)).toLowerCase();
}

/**
 * The hub's npm workspace: the repo root once its phase 12 moved it there,
 * else `next/` (both have the `local` script). Named by package scripts, not paths.
 */
export function hubWorkspace(hub: string = HUB): string {
  const hasLocal = (dir: string): boolean => {
    try {
      const text = readFileSync(join(dir, 'package.json'), 'utf8');
      return text.includes('"local"');
    } catch {
      return false;
    }
  };
  if (hasLocal(hub)) return hub;
  const next = join(hub, 'next');
  if (hasLocal(next)) return next;
  throw new Error(`no hub workspace with a "local" script in ${hub} (set DG_HOST to the diffenderfer-games checkout)`);
}

/** The system Chrome (`CHROME_PATH`, else the Windows default). */
export const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** The scratch folder for logs and state (`.tmp/`, git-ignored). */
export const TMP = join(ROOT, '.tmp');
