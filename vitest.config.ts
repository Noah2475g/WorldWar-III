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
  /**
   * Dieselbe Bauflagge wie `apps/desktop/vite.config.ts` (T-M39-04).
   *
   * Im Testlauf ist sie **an**: sonst waere der Mehrspielereinstieg in `main.tsx` fuer
   * jeden Test tot, und eine Flagge, die im Test nie wahr ist, ist eine Verzweigung, die
   * niemand prueft. Was ausgeliefert wird, entscheidet der Bau und nicht diese Zeile —
   * gemessen am Erzeugnis (T-M38-05, `docs/reports/packaging-netfree.json`).
   */
  define: {
    __MULTIPLAYER__: JSON.stringify(process.env['WORLDWAR_MULTIPLAYER'] !== '0'),
  },
  resolve: {
    alias: {
      '@worldwar/shared': r('./packages/shared/src/index.ts'),
      '@worldwar/core': r('./packages/core/src/index.ts'),
      '@worldwar/ai': r('./packages/ai/src/index.ts'),
      '@worldwar/netplay': r('./packages/netplay/src/index.ts'),
      '@worldwar/testkit': r('./packages/testkit/src/index.ts'),
      '@worldwar/mapgen': r('./packages/mapgen/src/index.ts'),
    },
  },
  test: {
    include: ['{packages,apps,test}/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-mp/**', '**/*.slow.test.ts', '**/e2e/**'],
    environment: 'node',
    /**
     * Node >= 25 legt ein eigenes, experimentelles `localStorage` auf `globalThis` (ohne
     * `--localstorage-file` ist es `undefined`). Vitest uebernimmt jsdom-Globals nur, wo
     * `globalThis` den Namen nicht schon hat — also blieb `localStorage` in jedem jsdom-Test
     * `undefined` (23 rote Tests in apps/desktop auf Node 26.7). Der Schalter schaltet die
     * Node-Version ab, jsdom liefert dann sein eigenes Storage.
     * Nur setzen, wo Node den Schalter kennt: Node 20 (engines >=20) und 22.0-22.3 brechen sonst
     * die ganze Suite mit 'bad option' ab. Gemessen 2026-10-05: allowedNodeEnvironmentFlags.has(...)
     * ist true auf v24.18.1/v26.7.0, false auf v20.20.2. Ohne Schalter bleibt es beim Stand vor PR #22.
     */
    poolOptions: {
      forks: {
        execArgv: process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
          ? ['--no-experimental-webstorage']
          : [],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      // `main.tsx` stand hier bis zum 2026-09-06 (T-M14-08, Befund N5). Ausgerechnet die
      // Datei, die entscheidet, *was ausgeliefert wird*, war die einzige der Anwendung,
      // die die Abdeckungszahl nicht sehen konnte — und an ihr hingen sieben Befunde des
      // Audits, darunter der Speicher, der nie verdrahtet war.
      exclude: ['**/index.ts', '**/*.test.{ts,tsx}', '**/types.ts'],
    },
  },
})
