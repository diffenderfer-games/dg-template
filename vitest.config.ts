import { defineConfig } from 'vitest/config';

// Unit tests (vitest). Four projects (docs/kit/testing.md):
// - kit:        tests/kit/**        the kit modules (Node; a file opts into jsdom with `// @vitest-environment jsdom`)
// - hub-events: tests/hub-events/** one test per hub event and callback, the kit against the stub game (jsdom, FakeHub)
// - game:       tests/game/**       your rules, determinism and sims
// - slow:       **/*.slow.test.ts   long sims and the 365-day daily harness (`npm run test:slow`)
// The browser hub suites (tests/hub/) run under node:test against a real hub (`npm run test:hub`).
const SLOW = '**/*.slow.test.ts';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'kit',
          include: ['tests/kit/**/*.test.ts', 'tests/scripts/**/*.test.ts'],
          exclude: [SLOW],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: { name: 'hub-events', include: ['tests/hub-events/**/*.test.ts'], exclude: [SLOW], environment: 'jsdom' },
      },
      {
        extends: true,
        test: { name: 'game', include: ['tests/game/**/*.test.ts'], exclude: [SLOW], environment: 'jsdom' },
      },
      {
        extends: true,
        test: { name: 'slow', include: ['tests/**/*.slow.test.ts'], environment: 'node', testTimeout: 600_000 },
      },
    ],
  },
});
