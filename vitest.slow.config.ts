import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/** Long runs only: tournaments, 1000-day simulations, world-map benchmarks. */
export default defineConfig({
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
    include: ['{packages,apps,test}/**/*.slow.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    testTimeout: 1_800_000,
    hookTimeout: 300_000,
  },
})
