import { fileURLToPath } from 'node:url'
import { createPartyServer } from './server.ts'

/**
 * Der Hostdienst, von Hand gestartet (T-M38-07, R-MP-11, D28.10).
 *
 * ```bash
 * node apps/party/src/index.ts [port] [ordner]
 * ```
 *
 * Voreinstellung: Port **7749** und `apps/desktop/dist` — der Ordner, den `vite build`
 * schreibt und den `tauri.conf.json` als `frontendDist` verpackt. Beide Seiten stammen
 * damit aus demselben Bau, und der Handschlag belegt es (R-MP-11/AK2).
 *
 * Ein Befehl daraus zu machen — bauen, starten, Link drucken — ist **T-M39-04**; der Link
 * mit Raum und Geheimnis ist T-M39-01. Hier steht nur, was M38 braucht: ein Dienst, den
 * man startet, und der wieder aufhört, ohne einen Prozess zurückzulassen.
 */

const DEFAULT_PORT = 7749
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export async function main(argv: readonly string[]): Promise<void> {
  const port = Number(argv[0] ?? DEFAULT_PORT)
  const root = argv[1] ?? `${ROOT}apps/desktop/dist`

  const dienst = createPartyServer({ root, port })
  const gehorcht = await dienst.listen()
  console.log(`WorldWar-Hostdienst auf Port ${gehorcht}, liefert aus: ${root}`)
  console.log('Beenden mit Strg+C.')

  // Ein Dienst, der sich nicht beenden laesst, ist der Fehler aus WORKFLOW §4 Falle 4:
  // einen langen Lauf abzubrechen beendet ihn nicht.
  const stop = (): void => {
    void dienst.close().then(() => process.exit(0))
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  void main(process.argv.slice(2))
}
