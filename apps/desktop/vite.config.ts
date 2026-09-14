import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * The desktop build (T-M11-03).
 *
 * Relative base paths, because the packaged app is loaded from the file system rather
 * than from a server — an absolute /assets/ path would simply not resolve there.
 *
 * ## Die Bauflagge `WORLDWAR_MULTIPLAYER` (T-M39-04, R-MP-09/AK3, D28.9, Befund M38-5)
 *
 * Noahs dritte Festlegung vom 2026-09-12: **das ausgelieferte Programm bleibt netzfrei.**
 * Bis M38 galt das von selbst, weil kein Pfad von `main.tsx` zum WebSocket-Transport
 * führte — eine Zusage aus Unterlassung. Sobald der Beitrittsbildschirm ihn erreicht
 * (T-M39-02), stünde er im Tauri-Bündel, und die gemessene Zeile „kein `WebSocket` im
 * Bündel" wäre falsch geworden.
 *
 * Sie wird deshalb **nicht gestrichen, sondern tragfähig gemacht**: `__MULTIPLAYER__` ist
 * beim gewöhnlichen Bau ein literales `false`, der Rollup-Baum schneidet den Zweig samt
 * dynamischem Import heraus, und im Erzeugnis steht kein WebSocket. `pnpm mp:host` setzt
 * die Flagge und baut dasselbe Bündel **mit** Einstieg — das ist der Bau, den der
 * Hostdienst ausliefert und den beide Seiten der Partie bekommen (R-MP-11/AK2).
 *
 * Die Zusage, die unabhängig davon trägt, bleibt `connect-src 'none'` im kompilierten
 * Programm: sie verbietet die Verbindung, **gleich wer sie versucht**.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __MULTIPLAYER__: JSON.stringify(process.env['WORLDWAR_MULTIPLAYER'] === '1'),
  },
  resolve: {
    alias: {
      '@worldwar/shared': r('../../packages/shared/src/index.ts'),
      '@worldwar/core': r('../../packages/core/src/index.ts'),
      '@worldwar/ai': r('../../packages/ai/src/index.ts'),
      '@worldwar/netplay': r('../../packages/netplay/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // The world map alone is 0.9 MB of JSON; a warning about it every build is noise.
    chunkSizeWarningLimit: 2000,
  },
})
