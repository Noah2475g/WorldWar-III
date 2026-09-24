import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION, envelope, type NetMessage } from '@worldwar/netplay'
// Relativ und nicht ueber den Paketnamen: `transportContract.ts` importiert `vitest` und
// steht deshalb bewusst NICHT im Sammelexport von @worldwar/netplay - ueber index.ts zoege
// jeder App-Import den Testlaeufer in das ausgelieferte Buendel (T-M38-01, T-M38-05).
import {
  testMessage,
  transportContract,
  type TransportPair,
} from '../../../../packages/netplay/src/transportContract'
import {
  RECONNECT_BACKOFF_MS,
  REFUSAL_CLOSE_CODE_FROM,
  createWebSocketTransport,
  type SocketLike,
} from './websocketTransport'

/**
 * Der WebSocket-Transport im Browser (T-M38-06, R-MP-06, R-MP-09/AK1, D28.9).
 *
 * Zwei Dinge werden hier belegt, und das erste ist das wichtigere: **dieselbe
 * Vertragsreihe wie das Schleifendoppel**. Eine Schnittstelle mit nur einer Umsetzung ist
 * eine Vermutung — das ist die Lehre von `StoragePort`, der drei Meilensteine lang eine
 * „Reihe gegen alle drei Umsetzungen" versprach, die es nie gab.
 *
 * Das zweite ist die einzige echte technische Falle dieses Meilensteins: der Gast kommt
 * über `http` im privaten Netz, also **ohne sicheren Kontext**. `crypto.randomUUID` und
 * `crypto.subtle` sind dort nicht langsamer oder eingeschränkt, sondern `undefined`. Eine
 * Zeile, die sie benutzt, fällt in keinem Test auf, der über `https` oder `localhost`
 * läuft — und beim ersten echten Gast sofort.
 */

/** Ein Doppel der WebSocket-Schnittstelle: zwei Enden, eine Schlange, kein Netz. */
class FakeSocket implements SocketLike {
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null
  onerror: ((event?: unknown) => void) | null = null
  peer: FakeSocket | null = null
  /** Mit welchem Grund das Ende geschlossen wurde — fuer die Zusicherungen unten. */
  closedWith: { code?: number; reason?: string } | null = null

  constructor(private readonly queue: (() => void)[]) {}

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('Das Doppel ist nicht offen.')
    const peer = this.peer
    this.queue.push(() => peer?.onmessage?.({ data }))
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.closedWith = { code, reason }
    this.queue.push(() => this.onclose?.({ code, reason }))
    const peer = this.peer
    if (peer && peer.readyState !== 3) {
      peer.readyState = 3
      this.queue.push(() => peer.onclose?.({ code, reason }))
    }
  }

  /** Was eine echte Leitung tut, wenn sie steht. */
  openUp(): void {
    this.queue.push(() => {
      if (this.readyState === 3) return
      this.readyState = 1
      this.onopen?.()
    })
  }
}

/** Eine Leitung aus zwei Enden, wie der Hostdienst sie zwischen zwei Gästen aufspannt. */
function socketPair(queue: (() => void)[]): { a: FakeSocket; b: FakeSocket } {
  const a = new FakeSocket(queue)
  const b = new FakeSocket(queue)
  a.peer = b
  b.peer = a
  a.openUp()
  b.openUp()
  return { a, b }
}

/** Die Schlange leeren, bis nichts mehr nachkommt — das Doppel von „die Zeit vergeht". */
function drain(queue: (() => void)[]): void {
  let schutz = 0
  while (queue.length > 0) {
    queue.shift()!()
    schutz += 1
    if (schutz > 10_000) throw new Error('Die Schlange leert sich nicht.')
  }
}

/**
 * Der Vertrag, gegen die echte Umsetzung.
 *
 * Ohne Wiederversuch: ein Abriss in dieser Reihe ist ein Ende, kein Aussetzer. Was der
 * Wiederaufbau verspricht, steht darunter in eigenen Zusicherungen.
 */
transportContract('WebSocket-Transport', (): TransportPair => {
  const queue: (() => void)[] = []
  const enden = socketPair(queue)
  const a = createWebSocketTransport({ url: 'ws://host:7749/raum', open: () => enden.a, backoffMs: [] })
  const b = createWebSocketTransport({ url: 'ws://host:7749/raum', open: () => enden.b, backoffMs: [] })
  return { a, b, settle: async () => drain(queue) }
})

describe('R-MP-06 Der WebSocket-Transport, ueber den Vertrag hinaus', () => {
  it('haelt zurueck, was vor dem Verbindungsaufbau gegeben wurde', () => {
    // Der Aufbau dauert; ein Befehl, der in dieser Zeit gegeben wird, darf nicht
    // verlorengehen, und die Reihenfolge muss stehen.
    const queue: (() => void)[] = []
    const enden = socketPair(queue)
    const a = createWebSocketTransport({ url: 'ws://x', open: () => enden.a, backoffMs: [] })
    const b = createWebSocketTransport({ url: 'ws://x', open: () => enden.b, backoffMs: [] })
    const angekommen: NetMessage[] = []
    b.onMessage((message) => angekommen.push(message))

    expect(a.connected, 'die Leitung steht noch nicht').toBe(false)
    a.send(testMessage(1))
    a.send(testMessage(2))
    drain(queue)

    expect(a.connected).toBe(true)
    expect(angekommen.map((m) => (m as { tick: number }).tick)).toEqual([1, 2])
  })

  it('verwirft eine unverstaendliche Nachricht und meldet sie, statt zu raten', () => {
    // R-MP-06/AK3 an der Leitung: was hier durchkaeme, waere der kuerzeste Weg zu zwei
    // verschiedenen Welten.
    const queue: (() => void)[] = []
    const enden = socketPair(queue)
    const a = createWebSocketTransport({ url: 'ws://x', open: () => enden.a, backoffMs: [] })
    const gemeldet: string[] = []
    const angekommen: NetMessage[] = []
    a.onProblem((problem) => gemeldet.push(problem.reason))
    a.onMessage((message) => angekommen.push(message))
    drain(queue)

    enden.a.onmessage?.({ data: 'kein JSON' })
    enden.a.onmessage?.({ data: JSON.stringify({ kind: 'schummeln', version: PROTOCOL_VERSION }) })
    enden.a.onmessage?.({
      data: JSON.stringify({ ...envelope('probe'), ticks: 24, hash: 'gut', fromHash: 'start' }),
    })
    drain(queue)

    expect(gemeldet).toHaveLength(2)
    expect(gemeldet[0]).toMatch(/JSON/)
    expect(gemeldet[1]).toMatch(/schummeln/)
    expect(angekommen).toHaveLength(1)
  })
})

describe('R-MP-07 Die Leitung kommt mit wachsendem Abstand zurueck', () => {
  /**
   * Ein Aufbau, der jedes Mal ein frisches Ende liefert — wie ein echter Wiederversuch.
   *
   * `opens` entscheidet, ob der Versuch gelingt, und der Unterschied trägt zwei der
   * Zusicherungen unten: ein **gelungener** Aufbau setzt die Abstände zurück, ein
   * **misslungener** treibt sie weiter. Nur im zweiten Fall wächst die Liste überhaupt,
   * und nur dort geht ihr irgendwann der Atem aus. Der erste Aufbau gelingt immer — ein
   * Transport, der nie eine Verbindung hatte, ist ein anderer Fall.
   */
  function reconnecting(backoffMs: readonly number[], opens = true) {
    const queue: (() => void)[] = []
    const sockets: FakeSocket[] = []
    const abstaende: number[] = []
    const faellig: (() => void)[] = []
    const transport = createWebSocketTransport({
      url: 'ws://host:7749/raum',
      backoffMs,
      open: () => {
        const ende = new FakeSocket(queue)
        if (opens || sockets.length === 0) ende.openUp()
        sockets.push(ende)
        return ende
      },
      schedule: (run, ms) => {
        abstaende.push(ms)
        faellig.push(run)
        return faellig.length
      },
      cancel: () => undefined,
    })
    return { transport, queue, sockets, abstaende, faellig }
  }

  it('baut nach einem Abriss neu auf, mit wachsendem Abstand', () => {
    // Der Host ist wirklich weg: jeder Versuch scheitert, und die Abstaende wachsen.
    const { transport, queue, sockets, abstaende, faellig } = reconnecting([250, 500, 1000], false)
    drain(queue)

    for (let versuch = 0; versuch < 3; versuch += 1) {
      sockets[sockets.length - 1]!.close(1006, '')
      drain(queue)
      faellig.pop()!()
      drain(queue)
    }

    expect(abstaende).toEqual([250, 500, 1000])
    expect(sockets).toHaveLength(4)
    expect(transport.reconnects).toBe(3)
    expect(transport.closed, 'ein Aussetzer ist kein Ende').toBe(false)
  })

  it('liefert nach, was waehrend des Abrisses gegeben wurde', () => {
    // Der Punkt der ganzen Uebung: ein Befehl, der in die Luecke faellt, ist im
    // Gleichschritt kein Schluckauf, sondern ein Stillstand.
    const { transport, queue, sockets, faellig } = reconnecting([250])
    drain(queue)
    sockets[0]!.close(1006, '')
    drain(queue)

    transport.send(testMessage(42))
    expect(transport.connected, 'die Leitung ist gerade fort').toBe(false)

    faellig.pop()!()
    const angekommen: string[] = []
    sockets[1]!.peer = null
    sockets[1]!.send = (data: string) => angekommen.push(data)
    drain(queue)

    expect(angekommen).toHaveLength(1)
    expect(JSON.parse(angekommen[0]!)).toMatchObject({ kind: 'befehle', tick: 42 })
  })

  it('gibt nach dem letzten Abstand auf und sagt es genau einmal', () => {
    const { transport, queue, sockets, faellig } = reconnecting([250], false)
    drain(queue)
    const gruende: string[] = []
    transport.onClose((reason) => gruende.push(reason))

    sockets[0]!.close(1006, '')
    drain(queue)
    faellig.pop()!()
    drain(queue)
    sockets[1]!.close(1006, '')
    drain(queue)

    expect(gruende).toHaveLength(1)
    expect(gruende[0]).toMatch(/fort/)
    expect(transport.closed).toBe(true)
  })

  it('versucht es nach einem gewollten Schliessen nicht wieder', () => {
    // Der Unterschied zwischen „die Leitung ist weg" und „ich bin fertig".
    const { transport, queue, sockets, abstaende } = reconnecting([250, 500])
    drain(queue)

    transport.close('Feierabend')
    drain(queue)

    expect(abstaende, 'nach einem gewollten Schliessen wird nicht neu aufgebaut').toEqual([])
    expect(sockets[0]!.closedWith).toEqual({ code: 1000, reason: 'Feierabend' })
    expect(transport.closed).toBe(true)
  })

  it('faengt die Abstaende nach einem erfolgreichen Aufbau von vorn an', () => {
    // Die naechste Stoerung ist eine neue Stoerung und nicht die Fortsetzung der alten.
    const { queue, sockets, abstaende, faellig } = reconnecting([250, 500, 1000])
    drain(queue)

    sockets[0]!.close(1006, '')
    drain(queue)
    faellig.pop()!()
    drain(queue)
    sockets[1]!.close(1006, '')
    drain(queue)

    expect(abstaende).toEqual([250, 250])
  })

  /**
   * Befund MP-3 (Sichtpruefung 2026-09-14, an zwei Fenstern desselben Rechners).
   *
   * Der Dienst weist **nach** dem 101-Handschlag ab: der Browser feuert erst `open`, dann
   * `close` mit `4001`. `open` setzte die Abstaende zurueck — also versuchte es der
   * Transport ewig weiter, gemessen **77 Mal in 20 Sekunden**, und auf dem Bildschirm
   * stand die ganze Zeit „Der Gastgeber legt die Partie gerade an."
   */
  it('gibt bei einer Abweisung sofort auf und nennt den Grund', () => {
    const { transport, queue, sockets, abstaende } = reconnecting([250, 500, 1000])
    drain(queue)
    const gruende: string[] = []
    transport.onClose((reason) => gruende.push(reason))

    // Genau das, was der Hostdienst tut: erst 101, dann 4001 mit einem Satz.
    sockets[0]!.close(4001, 'Dieser Platz ist besetzt.')
    drain(queue)

    expect(abstaende, 'eine Abweisung ist kein Netzfehler und wird nicht wiederholt').toEqual([])
    expect(sockets, 'es wurde eine zweite Leitung aufgebaut').toHaveLength(1)
    expect(gruende).toEqual(['Dieser Platz ist besetzt.'])
    expect(transport.closed).toBe(true)
  })

  it('nennt auch eine Abweisung ohne Text', () => {
    const { transport, queue, sockets } = reconnecting([250])
    drain(queue)
    const gruende: string[] = []
    transport.onClose((reason) => gruende.push(reason))

    sockets[0]!.close(REFUSAL_CLOSE_CODE_FROM, '')
    drain(queue)

    expect(gruende).toHaveLength(1)
    expect(gruende[0], 'ein Ende ohne Grund ist fuer den Spieler ein Absturz').not.toBe('')
    expect(transport.closed).toBe(true)
  })

  it('hat eine Vorgabeliste, die wirklich waechst', () => {
    const wachsend = RECONNECT_BACKOFF_MS.every(
      (ms, index) => index === 0 || ms > RECONNECT_BACKOFF_MS[index - 1]!,
    )
    expect(wachsend, `${RECONNECT_BACKOFF_MS.join(', ')} waechst nicht`).toBe(true)
    expect(RECONNECT_BACKOFF_MS.length).toBeGreaterThan(3)
  })
})

describe('R-MP-06 Kein sicherer Kontext beim Gast', () => {
  const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

  /** Jede Quelldatei der Browserseite — Tests und Sprachdateien eingeschlossen. */
  function browserSources(): string[] {
    const out: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', 'src-tauri'].includes(entry.name)) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry.name)) out.push(full)
      }
    }
    walk(join(ROOT, 'apps/desktop/src'))
    return out
  }

  it('benutzt nirgends eine Schnittstelle, die einen sicheren Kontext verlangt', () => {
    // `crypto.randomUUID` und `crypto.subtle` sind ueber http nicht eingeschraenkt,
    // sondern `undefined`. Das Geheimnis erzeugt der Hostdienst in Node (D28.10).
    const verboten = /\bcrypto\s*\.\s*(randomUUID|subtle)|\bisSecureContext\b/ // GUARD-ALLOW: die Regel selbst
    const treffer = browserSources()
      .flatMap((datei) =>
        readFileSync(datei, 'utf8')
          .split('\n')
          .map((zeile, index) => ({ datei, zeile, nummer: index + 1 }))
          .filter(
            (eintrag) =>
              verboten.test(eintrag.zeile) &&
              // Eine Zeile, die die Regel erklaert, verletzt sie nicht - dieselbe
              // Notbremse wie in `test/guards/scan.ts`. Ein Kommentar wird ausgelassen:
              // er wird nicht ausgefuehrt, und diese Datei nennt die beiden Namen oft.
              !/^\s*(\/\/|\*|\/\*)/.test(eintrag.zeile) &&
              !/GUARD-ALLOW/.test(eintrag.zeile),
          ),
      )
      .map((eintrag) => `${eintrag.datei.slice(ROOT.length)}:${eintrag.nummer}`)

    expect(treffer, `sicherer Kontext verlangt in:\n${treffer.join('\n')}`).toEqual([])
  })

  it('durchsucht ueberhaupt Dateien — und die Regel wuerde beissen', () => {
    // Ein Waechter ueber einer leeren Menge ist immer gruen (Lehre N1 vom 2026-09-05).
    expect(browserSources().length).toBeGreaterThan(40)
    const verboten = /\bcrypto\s*\.\s*(randomUUID|subtle)|\bisSecureContext\b/ // GUARD-ALLOW: die Regel selbst
    expect(verboten.test('const id = crypto.randomUUID()')).toBe(true) // GUARD-ALLOW: Gegenprobe
    expect(verboten.test('await crypto.subtle.digest("SHA-256", data)')).toBe(true) // GUARD-ALLOW: Gegenprobe
    expect(verboten.test('const zufall = Math.random()')).toBe(false)
  })
})
