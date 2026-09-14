import { spawnSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { inviteLink, type Invitation } from './room.ts'
import { createPartyServer } from './server.ts'

/**
 * Ein Befehl, keine Anleitung mit sieben Schritten (T-M39-04, R-MP-11, D28.10).
 *
 * ```bash
 * pnpm mp:host              # baut das Buendel, startet den Dienst, druckt den Link
 * pnpm mp:host --no-build   # ohne Bau, wenn dist schon steht
 * pnpm mp:host --port 7749
 * ```
 *
 * Drei Dinge in dieser Reihenfolge, und die Reihenfolge ist der ganze Punkt:
 *
 * 1. **Bauen.** `vite build` mit `WORLDWAR_MULTIPLAYER=1`. Ohne diese Flagge schneidet der
 *    Bau den Mehrspielereinstieg heraus — genau das hält das ausgelieferte Tauri-Programm
 *    netzfrei (Noahs dritte Festlegung, Z3, T-M38-05). Der Dienst liefert also **nicht**
 *    dasselbe Bündel aus wie das Programm, das Noah weitergibt, und das ist Absicht: die
 *    Zusage ist `connect-src 'none'` im Erzeugnis, nicht „niemand hat den Einstieg gebaut".
 * 2. **Starten.** Auf allen Schnittstellen (`0.0.0.0`) — im Tailnet ist ein Dienst, der nur
 *    auf `localhost` horcht, unerreichbar, und das fällt erst am Abend auf (T-M39-05).
 * 3. **Drucken.** Zwei Links aus einem Raum: den eigenen (`#/gastgeben`) und den, den Noah
 *    verschickt (`#/beitreten`). Beide tragen dasselbe Geheimnis, und beide tragen es
 *    hinter dem Rautezeichen.
 *
 * **Die Umgebungsvariable wird hier gesetzt und nicht im Skripteintrag.** `VAR=1 pnpm …`
 * ist eine Schreibweise der POSIX-Schale; `pnpm run` startet auf Windows `cmd.exe`, und
 * dort ist dieselbe Zeile ein Fehler. Ein Startbefehl, der auf dem Rechner des Gastgebers
 * nicht läuft, ist keiner.
 */

/** Der Port, unter dem der Link in `MEHRSPIELER.md` §3.7 steht. */
export const DEFAULT_PORT = 7749

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export interface HostOptions {
  port: number
  /** `false` überspringt den Bau — für den zweiten Start, wenn `dist` schon steht. */
  build: boolean
  root: string
}

/**
 * Die Befehlszeile, als reine Funktion.
 *
 * Unbekannte Angaben werden **abgewiesen und nicht geraten**: wer `--pport 7749` tippt,
 * soll es erfahren, statt eine Partie auf einem Port zu eröffnen, den niemand kennt.
 */
export function parseArgs(argv: readonly string[]): HostOptions | { error: string } {
  const options: HostOptions = { port: DEFAULT_PORT, build: true, root: `${ROOT}apps/desktop/dist` }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === '--no-build') options.build = false
    else if (arg === '--port') {
      const wert = Number(argv[++i])
      if (!Number.isInteger(wert) || wert < 0 || wert > 65_535) return { error: `Kein Port: ${argv[i]}` }
      options.port = wert
    } else if (arg === '--root') {
      const wert = argv[++i]
      if (!wert) return { error: 'Nach --root fehlt der Ordner.' }
      options.root = wert
    } else if (/^\d+$/.test(arg)) {
      // Die alte Form aus M38: `node index.ts 7749`. Sie bleibt, weil sie in Kommentaren steht.
      options.port = Number(arg)
    } else return { error: `Unbekannte Angabe: ${arg}` }
  }
  return options
}

/**
 * Der Adressbereich, in dem Tailscale seine Adressen vergibt (T-M39-05).
 *
 * `100.64.0.0/10` ist der Bereich für „Carrier-Grade NAT" aus RFC 6598, und Tailscale
 * benutzt ihn für das ganze Tailnet. Das ist **keine Vermutung über den Rechner des
 * Gastgebers**, sondern die dokumentierte Wahl des Anbieters — und sie ist der Grund,
 * warum dieser Dienst den richtigen Link von den falschen unterscheiden kann, ohne
 * Tailscale zu fragen.
 *
 * Was diese Funktion **nicht** kann: sagen, ob das Tailnet gerade steht. Eine
 * Tailscale-Schnittstelle ohne Anmeldung trägt eine `169.254.x.x`-Adresse und keine aus
 * diesem Bereich — dann findet sie nichts, und die Ausgabe sagt das, statt einen Link zu
 * drucken, der nirgends hinführt.
 */
export function isTailscaleAddress(address: string): boolean {
  const teile = address.split('.').map(Number)
  if (teile.length !== 4 || teile.some((zahl) => !Number.isInteger(zahl))) return false
  return teile[0] === 100 && teile[1]! >= 64 && teile[1]! <= 127
}

export interface Address {
  name: string
  address: string
  tailscale: boolean
}

/** Die IPv4-Adressen dieses Rechners, ohne die Rückschleife, Tailscale zuerst. */
export function localAddresses(interfaces = networkInterfaces()): Address[] {
  const out: Address[] = []
  for (const [name, list] of Object.entries(interfaces)) {
    for (const entry of list ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      out.push({ name, address: entry.address, tailscale: isTailscaleAddress(entry.address) })
    }
  }
  // Die Tailscale-Adresse zuerst: sie ist die einzige, die der Gast von aussen erreicht.
  return out.sort((a, b) => Number(b.tailscale) - Number(a.tailscale))
}

/**
 * Was der Gastgeber auf dem Bildschirm sieht.
 *
 * Getrennt vom Drucken, damit sich prüfen lässt, **was** dort steht — ein `console.log`
 * mitten im Ablauf ist eine Aussage, die kein Test lesen kann.
 */
export function hostLines(
  invitation: Invitation,
  port: number,
  addresses: readonly Address[],
): string[] {
  const zeilen = [`WorldWar-Hostdienst auf Port ${port}. Beenden mit Strg+C.`, '']
  const tailnet = addresses.filter((entry) => entry.tailscale)

  if (tailnet.length === 0) {
    zeilen.push(
      'Keine Tailscale-Adresse gefunden (erwartet wird 100.64.0.0/10).',
      'Ohne Tailnet erreicht der Gast diesen Rechner nicht — das ist keine Stoerung,',
      'sondern der Zweck: es gibt keinen oeffentlichen Endpunkt. Siehe docs/ANLEITUNG.md.',
      '',
    )
  }

  for (const entry of addresses) {
    const woher = entry.tailscale ? `${entry.name}, im Tailnet` : `${entry.name}, nur im lokalen Netz`
    zeilen.push(`Fuer dich  (${woher}): ${inviteLink(`http://${entry.address}:${port}`, invitation, 'host')}`)
    zeilen.push(`Fuer deinen Gast:      ${inviteLink(`http://${entry.address}:${port}`, invitation, 'guest')}`)
    zeilen.push('')
  }
  return zeilen
}

/**
 * Das Bündel bauen — mit der Flagge, die den Mehrspielereinstieg hineinnimmt.
 *
 * `stdio: 'inherit'`, damit der Gastgeber den Bau sieht: ein Befehl, der eine Minute lang
 * nichts sagt, sieht aus wie einer, der hängt.
 */
export function buildBundle(): { ok: boolean; status: number | null } {
  const result = spawnSync('pnpm', ['desktop:build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, WORLDWAR_MULTIPLAYER: '1' },
  })
  return { ok: result.status === 0, status: result.status }
}

export async function main(argv: readonly string[]): Promise<void> {
  const options = parseArgs(argv)
  if ('error' in options) {
    console.error(`${options.error}\nAufruf: pnpm mp:host [--port <n>] [--no-build]`)
    process.exitCode = 2
    return
  }

  if (options.build) {
    console.log('Baue das Buendel mit Mehrspielereinstieg (WORLDWAR_MULTIPLAYER=1) …')
    const bau = buildBundle()
    if (!bau.ok) {
      console.error(`Der Bau ist fehlgeschlagen (Status ${bau.status}). Der Dienst startet nicht.`)
      process.exitCode = 1
      return
    }
  }

  const dienst = createPartyServer({ root: options.root, port: options.port })
  const gehorcht = await dienst.listen()
  const einladung = dienst.invitations[0]!
  for (const zeile of hostLines(einladung, gehorcht, localAddresses())) console.log(zeile)
  console.log(`Ausgeliefert wird: ${options.root}`)

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
