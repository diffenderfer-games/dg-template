import { defineConfig } from 'vitest/config';

// Unit tests are TypeScript (tests/**/*.test.ts); the hub suites in tests/hub/ run under node:test.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
