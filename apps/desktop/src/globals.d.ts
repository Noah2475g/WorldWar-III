/**
 * Die Bauflagge des Mehrspielers (T-M39-04, R-MP-09/AK3, D28.9).
 *
 * Kein Wert zur Laufzeit, sondern eine **Ersetzung beim Bauen**: `vite.config.ts` setzt
 * `define.__MULTIPLAYER__` auf ein literales `true` oder `false`, und Rollup schneidet den
 * falschen Zweig samt seinem dynamischen Import aus dem Bündel.
 *
 * Genau darauf beruht die Zusage „das ausgelieferte Programm bleibt netzfrei": ohne die
 * Flagge steht im Tauri-Bündel kein `WebSocket`, und das wird am Erzeugnis gemessen
 * (T-M38-05, `docs/reports/packaging-netfree.json`) — nicht am Quelltext.
 */
declare const __MULTIPLAYER__: boolean
