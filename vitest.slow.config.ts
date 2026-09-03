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
    hookTimeout: 1_800_000,
    // Serial, and not for tidiness: half of this suite measures time. A benchmark that
    // shares a core with a four-minute simulation measures the machine's load rather
    // than the code — the world-map tick budget failed at 8,3 ms beside the parameter
    // sweep and passed at 5 ms on its own.
    fileParallelism: false,
  },
})
