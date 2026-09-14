/**
 * Protokoll und Gleichschritt einer Partie zu zweit (M37–M39, D28, MEHRSPIELER.md).
 *
 * **Dieses Paket kennt keine Leitung** — kein Netzzugriff, keine Adresse, keine
 * Verbindung. Das ist der Entwurf und kein Versehen (D28.9): dadurch bleibt der Wächter
 * `test/guards/no-network.test.ts` für alles scharf, und der ganze schwierige Teil bleibt
 * in einem Prozess prüfbar.
 */
export * from './protocol'
export * from './transport'
