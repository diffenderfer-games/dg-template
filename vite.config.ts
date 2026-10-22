import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** The game's slug: the package name (the folder, the repo and the URL). */
function slug(): string {
  const pkg: unknown = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const name = typeof pkg === 'object' && pkg !== null && 'name' in pkg ? pkg.name : null;
  return typeof name === 'string' && name !== '' ? name : 'game';
}

// The build's `base: './'` is REQUIRED — the catalog mounts every game under /<slug>/, so
// emitted asset URLs must be relative or they 404. See HANDOFF.md.
// `npm run dev` and `vite preview` serve under /<slug>/ too, as the catalog does: the hub
// client reads the game's slug from the address, and at `/` it has none, so saves fail.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : `/${slug()}/`,
  build: { target: 'es2022' }, // es2022 → top-level await works in main.ts
}));
