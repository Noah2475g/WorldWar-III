import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Architecture rules are enforced by tooling, not by discipline.
 *
 * 1. Core purity      — no clock, no randomness, no I/O inside packages/core (R-ARCH-01).
 * 2. Fixed-point math — `*` and `/` are banned in the core; use mulFixed/divFixed/mulChain.
 *                       Two Fixed values multiplied directly are wrong by a factor of 1000,
 *                       and nothing would notice until balancing (D-02).
 * 3. Import boundaries — shared <- core <- ai <- apps, never the other way round (D-01).
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/src-tauri/target/**',
      'test/guards/fixtures/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // R-UI-02: the contrast test guarantees the palette in tokens.ts. A component that
    // writes its own hex value sits outside that guarantee — which is precisely how a
    // readable interface drifts into an unreadable one.
    files: ["apps/desktop/src/**/*.ts", "apps/desktop/src/**/*.tsx"],
    ignores: ["apps/desktop/src/ui/tokens.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Farbliteral: Farben gehören nach apps/desktop/src/ui/tokens.ts (R-UI-02).",
        },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Core must be deterministic: use the seeded rng from @worldwar/shared (R-ARCH-01).' },
        { object: 'Date', property: 'now', message: 'Core must not read the wall clock: game time is state.tick (R-TIME-05).' },
        { object: 'performance', property: 'now', message: 'Core must not read the wall clock (R-TIME-05).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'Core must not schedule real time (R-TIME-05).' },
        { name: 'setInterval', message: 'Core must not schedule real time (R-TIME-05).' },
        { name: 'fetch', message: 'Core must not perform I/O (R-FREE-04).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='*']",
          message: 'Fixed-point: use mulFixed()/mulChain() instead of `*` (D-02). If this is plain integer bookkeeping, disable the rule on that line with a reason.',
        },
        {
          selector: "BinaryExpression[operator='/']",
          message: 'Fixed-point: use divFixed() instead of `/` (D-02). If this is plain integer bookkeeping, disable the rule on that line with a reason.',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Core must not read the wall clock (R-TIME-05).',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@worldwar/ai*', '@worldwar/testkit*', '@worldwar/mapgen*'], message: 'Dependency direction is shared <- core <- ai <- apps (D-01).' },
            { group: ['react*', 'vite*'], message: 'Core must not depend on the user interface (R-ARCH-01).' },
            { group: ['fs', 'node:fs', 'path', 'node:path', 'os', 'node:os'], message: 'Core must not touch the file system (R-ARCH-01).' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@worldwar/*'], message: 'shared is the bottom of the dependency chain (D-01).' },
          ],
        },
      ],
    },
  },
  {
    // Node scripts: plain ESM, run by node directly.
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    files: ['**/*.test.ts', 'packages/testkit/src/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
    },
  },
)
