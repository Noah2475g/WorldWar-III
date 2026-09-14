import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, fixture, productionFiles, scan, type Hit } from './scan'

/**
 * Product goal Z3: the game runs offline, without an account, and never phones home.
 * Tauri permissions enforce this at runtime (T-M11-03); this guard catches it at source level.
 *
 * **Seit T-M38-04 hat die Regel eine Grenze statt einer Lücke (R-MP-09, D28.9).** Bis zum
 * Mehrspieler durfte im ganzen Haus kein Netzzugriff stehen, und das war leicht zu prüfen,
 * weil es keinen gab. Eine Partie zu zweit braucht genau zwei Stellen: den Transport im
 * Browser und den Hostdienst in Node. Beide sind **benannt** — und benannt heißt: der
 * Wächter bleibt für alles andere scharf, statt abgeschaltet zu werden.
 *
 * Z3 bleibt damit wörtlich wahr für das Programm, das Noah weitergibt: das ausgelieferte
 * Tauri-Bündel führt `connect-src 'none'` und keine Netzberechtigung (T-M38-05). Verboten
 * ist, was das Spiel **von sich aus** tut; der Mehrspieler ist etwas, das ein Spieler
 * ausdrücklich veranlasst, und er läuft über den Browser.
 */
const NETWORK_CALLS =
  /\b(fetch\s*\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon|axios|node:https?|require\(['"]https?['"]\))/

/**
 * Die zwei Stellen, an denen Netzcode stehen darf (R-MP-09/AK1, MEHRSPIELER.md §3.1).
 *
 * Zwei benannte Ausnahmen, keine Lücke: `apps/desktop/src/net/` ist die einzige Stelle im
 * Spiel, die `new WebSocket` sagt, `apps/party/` der Hostdienst, der ausliefert und
 * weiterreicht. Wer eine dritte braucht, ändert diese Liste — und erklärt im selben Zug,
 * warum.
 */
export const NETWORK_ALLOWED = ['apps/party/', 'apps/desktop/src/net/'] as const

/**
 * Und die vier, an denen auch die Ausnahme nicht gilt (R-MP-09/AK2).
 *
 * Das Protokoll selbst kennt kein Netz. Der Satz klingt nach einer Geschmacksfrage und ist
 * die Grundlage des ganzen Meilensteins: nur weil `packages/netplay` ohne Leitung
 * auskommt, ließ sich der schwierige Teil — Gleichschritt, Reihenfolge, Prüfsummen,
 * Pause — vollständig in einem Prozess belegen, bevor ein einziges Paket über ein Netz
 * ging. Diese Liste **sticht die Ausnahmeliste**: wer eines dieser Verzeichnisse eines
 * Tages oben einträgt, hat den Wächter nicht überzeugt, sondern nur zweimal geschrieben.
 */
export const NETWORK_NEVER = [
  'packages/core/',
  'packages/ai/',
  'packages/shared/',
  'packages/netplay/',
] as const

/**
 * Welche Treffer jenseits der Grenze liegen — die eine Regel, in einer reinen Funktion.
 *
 * `allowed` ist ein Parameter und keine Konstante, damit die Gegenprobe zu AK2 wirklich
 * beißen kann: sie reicht eine Liste herein, die `packages/netplay/` erlaubt, und der
 * Treffer dort muss **trotzdem** gemeldet werden. Ohne diesen Weg bliebe „auch der
 * erlaubte Fall ist dort verboten" ein Satz, den kein Test von der Wirklichkeit trennt.
 */
export function outsideTheBorder(
  hits: readonly Hit[],
  allowed: readonly string[] = NETWORK_ALLOWED,
): Hit[] {
  return hits.filter((hit) => {
    const path = hit.file.replaceAll('\\', '/')
    if (NETWORK_NEVER.some((dir) => path.startsWith(dir))) return true
    return !allowed.some((dir) => path.startsWith(dir))
  })
}

/** Ein erfundener Treffer — für die Fälle, die es im Baum (hoffentlich) nie gibt. */
const hitAt = (file: string): Hit => ({ file, line: 1, text: 'const socket = new WebSocket(url)' })

describe('R-FREE-04 keine Netzwerkzugriffe im Produktcode', () => {
  it('findet ausgehende Verbindungen nur an den zwei benannten Stellen', () => {
    const strays = outsideTheBorder(scan(NETWORK_CALLS))
    expect(
      strays,
      `Netzwerkzugriffe ausserhalb von ${NETWORK_ALLOWED.join(' und ')}:\n${strays
        .map((h) => `${h.file}:${h.line}  ${h.text}`)
        .join('\n')}`,
    ).toEqual([])
  })

  it('schlaegt bei der hinterlegten Verstoss-Fixture an', () => {
    const offending = fixture('network')
      .split(/\r?\n/)
      .filter((line) => NETWORK_CALLS.test(line))
    expect(offending.length).toBeGreaterThan(0)
  })
})

describe('R-MP-09/AK1 Netzcode liegt an genau zwei Stellen', () => {
  it('durchsucht ueberhaupt etwas — sonst bewacht der Waechter das Nichts', () => {
    // Die Lehre vom 2026-09-05 (N1): „fuer jedes X gilt Y" ist wahr, wenn es kein X gibt.
    expect(productionFiles().length).toBeGreaterThan(100)
  })

  it('laesst den Transport und den Hostdienst durch', () => {
    const erlaubt = [
      hitAt('apps/desktop/src/net/websocketTransport.ts'),
      hitAt('apps/party/src/server.ts'),
    ]
    expect(outsideTheBorder(erlaubt)).toEqual([])
  })

  it('meldet denselben Aufruf zwei Ordner weiter', () => {
    // Der Unterschied zwischen einer Grenze und einer Abschaltung: es ist nicht der
    // Aufruf, der verboten ist, sondern seine Adresse.
    const daneben = hitAt('apps/desktop/src/game/peers.ts')
    expect(outsideTheBorder([daneben])).toEqual([daneben])
  })

  it('findet den Aufruf in der Verstoss-Fixture am falschen Ort', () => {
    // Die zweite Fixture (T-M38-04). Die erste belegt, dass die Regel ueberhaupt greift;
    // diese belegt, dass sie den ERLAUBTEN Aufruf am falschen Ort findet — ein Waechter,
    // der nur seine Ausnahme kennt, ist keiner. Gelesen wird die Datei mit demselben
    // `scan`, das auch den echten Baum liest, damit hier nichts nachgestellt wird.
    const datei = join(ROOT, 'test/guards/fixtures/violating/network-wrong-place.txt')
    const treffer = scan(NETWORK_CALLS, [datei])

    expect(treffer.length, 'die Fixture traegt keinen Netzaufruf mehr').toBeGreaterThan(0)
    expect(outsideTheBorder(treffer)).toEqual(treffer)
  })
})

describe('R-MP-09/AK2 Die Pakete kennen kein Netz, auch nicht als Ausnahme', () => {
  it('findet in core, ai, shared und netplay keinen einzigen Treffer', () => {
    const inPaketen = scan(NETWORK_CALLS).filter((hit) =>
      NETWORK_NEVER.some((dir) => hit.file.replaceAll('\\', '/').startsWith(dir)),
    )
    expect(
      inPaketen,
      `Netzzugriff in einem Paket, das keines haben darf:\n${inPaketen
        .map((h) => `${h.file}:${h.line}  ${h.text}`)
        .join('\n')}`,
    ).toEqual([])
  })

  it('meldet den Treffer auch, wenn jemand das Paket auf die Ausnahmeliste setzt', () => {
    // Die Gegenprobe, die wirklich beisst: `packages/netplay/` steht hier ausdruecklich
    // unter den erlaubten Orten — und der Treffer wird trotzdem gemeldet, weil die
    // Verbotsliste die Ausnahmeliste sticht.
    const drin = hitAt('packages/netplay/src/transport.ts')
    expect(outsideTheBorder([drin], ['packages/netplay/'])).toEqual([drin])
  })

  it('sticht die Ausnahme fuer jedes der vier Pakete', () => {
    const treffer = NETWORK_NEVER.map((dir) => hitAt(`${dir}src/irgendwo.ts`))
    expect(outsideTheBorder(treffer, NETWORK_NEVER)).toEqual(treffer)
  })
})
