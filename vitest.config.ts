import { defineConfig } from 'vitest/config';
import { readKitSkips, skippedFiles } from './scripts/kit/lib/kit-skips.ts';

// Unit tests (vitest). Four projects (docs/kit/testing.md):
// - kit:        tests/kit/**        the kit modules (Node; a file opts into jsdom with `// @vitest-environment jsdom`)
// - hub-events: tests/hub-events/** one test per hub event and callback, the kit against the game's hooks (jsdom, FakeHub)
// - game:       tests/game/**       your rules, determinism and sims
// - slow:       **/*.slow.test.ts   long sims and the 365-day daily harness (`npm run test:slow`)
// The browser hub suites (tests/hub/) run under node:test against a real hub (`npm run test:hub`).
// Kit tests that don't apply to this game are listed in tests/kit-skips.json: listed files are left
// out here, listed tests are skipped with their reason (scripts/kit/vitest-skips.ts).
const SLOW = '**/*.slow.test.ts';
const SKIPPED = skippedFiles(readKitSkips(import.meta.dirname).skips);
const SETUP = ['scripts/kit/vitest-skips.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'kit',
          include: ['tests/kit/**/*.test.ts', 'tests/scripts/**/*.test.ts'],
          exclude: [SLOW, ...SKIPPED],
          environment: 'node',
          setupFiles: SETUP,
        },
      },
      {
        extends: true,
        test: {
          name: 'hub-events',
          include: ['tests/hub-events/**/*.test.ts'],
          exclude: [SLOW, ...SKIPPED],
          environment: 'jsdom',
          setupFiles: SETUP,
        },
      },
      {
        extends: true,
        test: { name: 'game', include: ['tests/game/**/*.test.ts'], exclude: [SLOW], environment: 'jsdom' },
      },
      {
        extends: true,
        test: {
          name: 'slow',
          include: ['tests/**/*.slow.test.ts'],
          exclude: SKIPPED,
          environment: 'node',
          testTimeout: 600_000,
          setupFiles: SETUP,
        },
      },
    ],
  },
});
