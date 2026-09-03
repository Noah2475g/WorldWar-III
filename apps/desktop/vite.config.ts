import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * The desktop build (T-M11-03).
 *
 * Relative base paths, because the packaged app is loaded from the file system rather
 * than from a server — an absolute /assets/ path would simply not resolve there.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@worldwar/shared': r('../../packages/shared/src/index.ts'),
      '@worldwar/core': r('../../packages/core/src/index.ts'),
      '@worldwar/ai': r('../../packages/ai/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // The world map alone is 0.9 MB of JSON; a warning about it every build is noise.
    chunkSizeWarningLimit: 2000,
  },
})
