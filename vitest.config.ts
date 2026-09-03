import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Fast suite: everything except long runs.
 *
 * Long-running checks (tournaments, 1000-day runs, world-map benchmarks) live in
 * `*.slow.test.ts` and run via `pnpm test:slow`. Keeping them out of `pnpm verify`
 * is deliberate — see docs/plan/03-TASKS.md, "Schnelle und langsame Pruefungen".
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@worldwar/shared': r('./packages/shared/src/index.ts'),
      '@worldwar/core': r('./packages/core/src/index.ts'),
      '@worldwar/ai': r('./packages/ai/src/index.ts'),
      '@worldwar/testkit': r('./packages/testkit/src/index.ts'),
      '@worldwar/mapgen': r('./packages/mapgen/src/index.ts'),
    },
  },
  test: {
    include: ['{packages,apps,test}/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.slow.test.ts', '**/e2e/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: ['**/index.ts', '**/*.test.{ts,tsx}', '**/types.ts', '**/main.tsx'],
    },
  },
})
