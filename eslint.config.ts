/**
 * ESLint (KIT): few rules, aimed at real bugs (docs/plans/template-kit.md §8.5).
 *
 * - typescript-eslint's recommended + type-checked sets, strict about `any` and `as`;
 * - determinism: no `Math.random` / `Date` in the rules, daily, race and kit code (inject the RNG and clock);
 * - safety: no `innerHTML` built from data, no storage outside `kit/core/store.ts`;
 * - wording: no violent words in game copy, and never "run" / "turn game" / "instance" in the copy table.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const RANDOM = {
  object: 'Math',
  property: 'random',
  message: 'Use the seeded RNG (kit/rng); randomSeed() is the only Math.random.',
};
const DATE = { name: 'Date', message: 'Use the injected clock (kit/core/clock.ts) so tests stay deterministic.' };
const STORAGE = [
  { name: 'localStorage', message: 'Use kit/core/store.ts (try/catch, scoped keys).' },
  { name: 'sessionStorage', message: 'Use kit/core/store.ts (try/catch, scoped keys).' },
];
const HTML_SINKS = [
  {
    selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/][right.type!='Literal']",
    message: 'Build DOM with h() / textContent: never HTML from data (player names, chat).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'Build DOM with h() / textContent.',
  },
];
const VIOLENT = /\b(kill|killed|kills|shoot|shot|gun|guns|murder|blood|die|dies|dead)\b/i;
const VIOLENT_COPY = [
  {
    selector: `Literal[value=${String(VIOLENT)}]`,
    message: 'No violent words in UI copy (multiplayer.md): "zap", "tag", "out".',
  },
  {
    selector: `TemplateElement[value.raw=${String(VIOLENT)}]`,
    message: 'No violent words in UI copy (multiplayer.md).',
  },
];
const KIND_WORDS = /\b(run|runs|turn game|instance)\b/i;
const KIND_COPY = [
  {
    selector: `Literal[value=${String(KIND_WORDS)}]`,
    message: 'Players never see "run", "turn game" or "instance" (saved-games.md §11): say "game", "Continue".',
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-rules/**',
      'shots/**',
      '.tmp/**',
      'node_modules/**',
      // Replaced by scripts/kit/shots.ts in P4 of the kit plan; removed then.
      'scripts/shots.mjs',
      'scripts/shots-hub.mjs',
      // Owned by the daily-puzzle work stream; linted once it is folded in (see docs/kit/daily-puzzle.md).
      'src/kit/daily-puzzle/**',
      'tests/kit/daily-puzzle/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { project: ['./tsconfig.json', './tsconfig.node.json'], tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', ...HTML_SINKS],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/kit/core/store.ts', 'src/kit/testing/**'],
    rules: { 'no-restricted-globals': ['error', ...STORAGE] },
  },
  {
    files: ['src/kit/**/*.ts', 'src/game/rules.ts', 'src/game/daily.ts', 'src/game/race.ts', 'src/game/turns/**/*.ts'],
    ignores: [
      'src/kit/rng/**',
      'src/kit/core/clock.ts',
      'src/kit/core/store.ts',
      'src/kit/server/**',
      'src/kit/testing/**',
    ],
    rules: {
      'no-restricted-properties': ['error', RANDOM],
      'no-restricted-globals': ['error', DATE, ...STORAGE],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...HTML_SINKS, ...VIOLENT_COPY] },
  },
  {
    files: ['src/game/strings.ts', 'src/kit/core/strings.ts'],
    rules: { 'no-restricted-syntax': ['error', ...HTML_SINKS, ...VIOLENT_COPY, ...KIND_COPY] },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
