import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { connect, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Room, Rooms, SEATS, ROOM_FULL, type Connection } from '../src/room.ts'
import {
  FrameReader,
  acceptKey,
  contentTypeOf,
  createPartyServer,
  encodeFrame,
  resolveStatic,
  roomIdOf,
  type PartyServer,
} from '../src/server.ts'

/**
 * Der Hostdienst (T-M38-07, R-MP-11, D28.10).
 *
 * **Ein grüner Einzeltest sagt nichts über das Spiel.** Die Hälfte hier prüft reine
 * Funktionen — Rahmen, Pfade, Plätze —, und die andere Hälfte startet den Dienst wirklich
 * auf einem freien Port und redet mit ihm über einen echten TCP-Sockel, mit einem von Hand
 * geschriebenen WebSocket-Client. Nur der zweite Teil kann sagen, dass eine Nachricht von
 * A wirklich bei B ankommt und dass ein dritter wirklich abgewiesen wird.
 *
 * Der Client hier ist absichtlich winzig und hat nichts mit dem Transport der Browserseite
 * zu tun: würde er ihn benutzen, prüfte der Lauf beide Seiten gegen dieselbe Annahme.
 */

const SERVER_TIMEOUT = 15_000

/** Ein Rahmen vom Client zum Server ist **maskiert** — das verlangt RFC 6455. */
function maskedFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = randomBytes(4)
  const head: number[] = [0x81]
  if (payload.length < 126) head.push(0x80 | payload.length)
  else head.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff)
  const maskiert = Buffer.from(payload)
  for (let i = 0; i < maskiert.length; i += 1) maskiert[i] = maskiert[i]! ^ mask[i % 4]!
  return Buffer.concat([Buffer.from(head), mask, maskiert])
}

interface Client {
  socket: Socket
  received: string[]
  closedWith: { code?: number; reason: string } | null
  send(text: string): void
  end(): void
}

/** Ein WebSocket-Client in vierzig Zeilen: Handschlag, Rahmen, sonst nichts. */
function openClient(port: number, path: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    const reader = new FrameReader()
    const received: string[] = []
    const client: Client = {
      socket,
      received,
      closedWith: null,
      send: (text) => socket.write(maskedFrame(text)),
      end: () => socket.destroy(),
    }
    let handshake = ''
    let stehend = false

    socket.on('error', reject)
    socket.on('connect', () => {
      const key = randomBytes(16).toString('base64')
      socket.write(
        `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      )
    })
    socket.on('data', (chunk: Buffer) => {
      if (!stehend) {
        handshake += chunk.toString('latin1')
        const ende = handshake.indexOf('\r\n\r\n')
        if (ende < 0) return
        const kopf = handshake.slice(0, ende)
        if (!kopf.startsWith('HTTP/1.1 101')) {
          reject(new Error(`Kein Handschlag: ${kopf.split('\r\n')[0]}`))
          return
        }
        stehend = true
        const rest = Buffer.from(handshake.slice(ende + 4), 'latin1')
        handshake = ''
        resolve(client)
        if (rest.length > 0) chunk = rest
        else return
      }
      for (const frame of reader.push(chunk)) {
        if (frame.kind === 'text') received.push(frame.data)
        else if (frame.kind === 'close') {
          client.closedWith = { reason: frame.data, ...(frame.code === undefined ? {} : { code: frame.code }) }
        }
      }
    })
  })
}

/** Eine einfache HTTP-Anfrage ohne Bibliothek — der Dienst soll eine Datei liefern. */
function httpGet(port: number, path: string): Promise<{ status: number; headers: string; body: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    let antwort = ''
    socket.on('error', reject)
    socket.on('connect', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`)
    })
    socket.on('data', (chunk: Buffer) => {
      antwort += chunk.toString('utf8')
    })
    socket.on('close', () => {
      const ende = antwort.indexOf('\r\n\r\n')
      const kopf = antwort.slice(0, ende)
      resolve({
        status: Number(/^HTTP\/1\.1 (\d+)/.exec(kopf)?.[1] ?? 0),
        headers: kopf,
        body: antwort.slice(ende + 4),
      })
    })
  })
}

/** Warten, bis eine Bedingung eintritt — ohne feste Schlafzeit, die mal zu kurz ist. */
async function until(bedingung: () => boolean, was: string): Promise<void> {
  for (let versuch = 0; versuch < 400; versuch += 1) {
    if (bedingung()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Hat nicht stattgefunden: ${was}`)
}

describe('R-MP-11 Der Raum nimmt genau zwei Plaetze', () => {
  const stumm = (): Connection & { gesendet: string[]; geschlossen: string[] } => {
    const gesendet: string[] = []
    const geschlossen: string[] = []
    return { gesendet, geschlossen, send: (d) => gesendet.push(d), close: (r) => geschlossen.push(r) }
  }

  it('vergibt die Plaetze in fester Reihenfolge', () => {
    // Fest und nicht zufaellig: der Platz ist die Kennung, nach der beide Seiten die
    // Befehle sortieren (T-M37-07).
    const raum = new Room('abc')
    expect(raum.join(stumm())).toEqual({ ok: true, seat: 'p1' })
    expect(raum.join(stumm())).toEqual({ ok: true, seat: 'p2' })
    expect(raum.seated.map((o) => o.seat)).toEqual([...SEATS])
  })

  it('weist den dritten ab und sagt ihm, warum', () => {
    const raum = new Room('abc')
    raum.join(stumm())
    raum.join(stumm())
    const dritter = stumm()
    const result = raum.join(dritter)

    expect(result).toEqual({ ok: false, reason: ROOM_FULL })
    expect(dritter.geschlossen, 'eine Verbindung, die ohne Grund endet, sieht aus wie ein Netzfehler').toEqual([
      ROOM_FULL,
    ])
    expect(raum.seated).toHaveLength(2)
  })

  it('gibt den Platz wieder frei, wenn jemand geht', () => {
    const raum = new Room('abc')
    raum.join(stumm())
    raum.join(stumm())
    raum.leave('p1')
    raum.leave('p1')

    expect(raum.full).toBe(false)
    expect(raum.join(stumm())).toEqual({ ok: true, seat: 'p1' })
  })

  it('reicht unveraendert weiter und nur an den anderen Platz', () => {
    // Der Dienst liest die Nachricht nicht. Was er nicht auspackt, kann er nicht falsch
    // verstehen - und eine Nachricht, die zum Absender zurueckkaeme, zaehlte im
    // Gleichschritt als zweite Freigabe desselben Ticks.
    const raum = new Room('abc')
    const a = stumm()
    const b = stumm()
    raum.join(a)
    raum.join(b)
    const roh = '{"kind":"befehle","version":1,"tick":7,"commands":[],"hash":"abc"}'

    expect(raum.relay('p1', roh)).toEqual(['p2'])
    expect(b.gesendet).toEqual([roh])
    expect(a.gesendet).toEqual([])
  })

  it('vergisst einen Raum, sobald niemand mehr darin sitzt', () => {
    // Kein Zustand ueber die Partie hinaus (MEHRSPIELER.md §6).
    const raeume = new Rooms()
    raeume.of('eins').join(stumm())
    expect(raeume.count).toBe(1)
    raeume.of('eins').leave('p1')
    raeume.forgetIfEmpty('eins')
    expect(raeume.count).toBe(0)
  })
})

describe('R-MP-11 Der WebSocket-Handschlag und die Rahmen', () => {
  it('beantwortet den Schluessel wie RFC 6455 es vorrechnet', () => {
    // Das Beispiel aus dem Papier selbst - eine Zahl, die nicht aus dieser Umsetzung
    // stammt, sondern von aussen kommt.
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
  })

  it('schreibt und liest einen Rahmen wieder', () => {
    const reader = new FrameReader()
    expect(reader.push(encodeFrame('Hallo Welt'))).toEqual([{ kind: 'text', data: 'Hallo Welt' }])
  })

  it('kommt mit Nutzlasten ueber 125 und ueber 65535 Bytes zurecht', () => {
    // Die drei Laengenformen von RFC 6455. Der dritte Zweig traegt spaeter den
    // Spielstand der Wiederaufnahme (D28.11, gemessen 249 KB) - ohne ihn waere sie
    // still kaputt.
    const reader = new FrameReader()
    for (const laenge of [126, 1000, 70_000]) {
      const text = 'x'.repeat(laenge)
      expect(reader.push(encodeFrame(text))[0]).toEqual({ kind: 'text', data: text })
    }
  })

  it('setzt einen Rahmen zusammen, der in zwei Paketen ankommt', () => {
    // TCP kennt keine Nachrichten, nur Bytes.
    const ganz = encodeFrame('zweigeteilt')
    const reader = new FrameReader()

    expect(reader.push(ganz.subarray(0, 4))).toEqual([])
    expect(reader.push(ganz.subarray(4))).toEqual([{ kind: 'text', data: 'zweigeteilt' }])
  })

  it('liest zwei Rahmen aus einem Paket', () => {
    const reader = new FrameReader()
    const beide = Buffer.concat([encodeFrame('eins'), encodeFrame('zwei')])

    expect(reader.push(beide).map((f) => f.data)).toEqual(['eins', 'zwei'])
  })

  it('demaskiert, was ein Client schickt', () => {
    const reader = new FrameReader()
    expect(reader.push(maskedFrame('vom Gast'))).toEqual([{ kind: 'text', data: 'vom Gast' }])
  })

  it('setzt fortgesetzte Rahmen wieder zusammen', () => {
    const reader = new FrameReader()
    const erst = Buffer.concat([Buffer.from([0x01, 3]), Buffer.from('abc')])
    const dann = Buffer.concat([Buffer.from([0x80, 3]), Buffer.from('def')])

    expect(reader.push(erst)).toEqual([])
    expect(reader.push(dann)).toEqual([{ kind: 'text', data: 'abcdef' }])
  })
})

describe('R-MP-11 Die Auslieferung', () => {
  const wurzel = mkdtempSync(join(tmpdir(), 'worldwar-party-'))

  it('loest die Wurzel auf index.html auf', () => {
    writeFileSync(join(wurzel, 'index.html'), '<!doctype html>')
    expect(resolveStatic(wurzel, '/')).toBe(join(wurzel, 'index.html'))
    expect(resolveStatic(wurzel, '/index.html')).toBe(join(wurzel, 'index.html'))
  })

  it('beantwortet keinen Pfad, der aus dem Ordner hinauszeigt', () => {
    // Nicht theoretisch: `/../../.ssh/id_rsa` ist die erste Adresse, die jemand probiert.
    for (const pfad of ['/../geheim', '/..%2Fgeheim', '/a/../../weg', '/%2e%2e/%2e%2e/weg']) {
      expect(resolveStatic(wurzel, pfad), pfad).toBeNull()
    }
  })

  it('sagt nichts ueber eine Datei, die es nicht gibt', () => {
    expect(resolveStatic(wurzel, '/gibtsnicht.js')).toBeNull()
  })

  it('nennt die Art der Datei, statt alles als Bytes zu schicken', () => {
    expect(contentTypeOf('a/b/index.html')).toMatch(/text\/html/)
    expect(contentTypeOf('assets/index-abc.js')).toMatch(/javascript/)
    expect(contentTypeOf('data/maps/world.json')).toMatch(/json/)
    expect(contentTypeOf('etwas.unbekannt')).toBe('application/octet-stream')
  })

  it('liest den Raum aus der Adresse — und nur einen zulaessigen', () => {
    expect(roomIdOf('/raum/abc123')).toBe('abc123')
    expect(roomIdOf('/raum/abc?x=1')).toBe('abc')
    for (const schlecht of ['/raum/', '/raum/mit/schraegstrich', '/anderswo', '/raum/' + 'x'.repeat(65)]) {
      expect(roomIdOf(schlecht), schlecht).toBeNull()
    }
  })
})

describe('R-MP-11/AK1 Der Dienst laeuft wirklich', () => {
  let dienst: PartyServer
  let port = 0
  let wurzel = ''

  beforeAll(async () => {
    wurzel = mkdtempSync(join(tmpdir(), 'worldwar-dist-'))
    writeFileSync(join(wurzel, 'index.html'), '<!doctype html><title>WorldWar</title>')
    writeFileSync(join(wurzel, 'world.json'), JSON.stringify({ id: 'world', provinces: [{ id: 'de-1' }] }))
    dienst = createPartyServer({ root: wurzel, host: '127.0.0.1' })
    port = await dienst.listen()
  }, SERVER_TIMEOUT)

  afterAll(async () => {
    await dienst.close()
    rmSync(wurzel, { recursive: true, force: true })
  })

  it('liefert index.html und die Kartendatei aus', async () => {
    const seite = await httpGet(port, '/')
    const karte = await httpGet(port, '/world.json')

    expect(seite.status).toBe(200)
    expect(seite.body).toContain('WorldWar')
    expect(seite.headers).toMatch(/content-type: text\/html/i)
    expect(karte.status).toBe(200)
    expect(JSON.parse(karte.body)).toMatchObject({ id: 'world' })
  })

  it('antwortet auf eine Datei, die es nicht gibt, mit 404', async () => {
    expect((await httpGet(port, '/gibtsnicht.js')).status).toBe(404)
  })

  it('reicht eine Nachricht von A unveraendert an B weiter', async () => {
    const a = await openClient(port, '/raum/partie')
    const b = await openClient(port, '/raum/partie')
    await until(() => dienst.rooms.of('partie').full, 'beide Plaetze besetzt')

    const roh = '{"kind":"befehle","version":1,"tick":3,"commands":[],"hash":"5ed264a0fea05076"}'
    a.send(roh)
    await until(() => b.received.length > 0, 'die Nachricht kommt bei B an')

    expect(b.received).toEqual([roh])
    expect(a.received, 'der Absender bekommt seine eigene Nachricht nicht zurueck').toEqual([])
    a.end()
    b.end()
    await until(() => dienst.rooms.count === 0, 'der leere Raum verschwindet')
  }, SERVER_TIMEOUT)

  it('weist den dritten Verbindungsversuch ab und sagt, warum', async () => {
    const a = await openClient(port, '/raum/voll')
    const b = await openClient(port, '/raum/voll')
    await until(() => dienst.rooms.of('voll').full, 'beide Plaetze besetzt')

    const c = await openClient(port, '/raum/voll')
    await until(() => c.closedWith !== null, 'der dritte bekommt seinen Grund')

    expect(c.closedWith?.reason).toBe(ROOM_FULL)
    expect(c.closedWith?.code, 'ein Schliessrahmen ohne Code ist ein Protokollfehler').toBe(1000)
    expect(dienst.rooms.of('voll').seated).toHaveLength(2)
    a.end()
    b.end()
    c.end()
  }, SERVER_TIMEOUT)

  it('gibt den Platz eines Gastes frei, der einfach verschwindet', async () => {
    // Der teuerste Befund dieses Meilensteins, gemessen am 2026-09-14: ein Sockel aus
    // `server.on('upgrade')` meldet `end` nach rund 65 ms und `close` NIE - die
    // HTTP-Schicht reicht ihn halb offen heraus. Ein Dienst, der nur auf `close` hoert,
    // behaelt den Platz fuer immer besetzt, und der naechste Gast findet einen vollen
    // Raum, in dem niemand sitzt. Genau das wird hier gemessen, und zwar am Ergebnis:
    // der dritte bekommt den Platz des ersten.
    const a = await openClient(port, '/raum/wiederkehr')
    const b = await openClient(port, '/raum/wiederkehr')
    await until(() => dienst.rooms.of('wiederkehr').full, 'beide Plaetze besetzt')

    a.end()
    await until(() => dienst.rooms.of('wiederkehr').seated.length === 1, 'der Platz wird frei')

    const c = await openClient(port, '/raum/wiederkehr')
    await until(() => dienst.rooms.of('wiederkehr').full, 'der neue Gast sitzt')

    expect(c.closedWith, 'der neue Gast wurde abgewiesen — der Platz war nie frei').toBeNull()
    expect(dienst.rooms.of('wiederkehr').seated.map((o) => o.seat)).toEqual(['p1', 'p2'])
    b.end()
    c.end()
  }, SERVER_TIMEOUT)

  it('nimmt keine Verbindung ohne Raum an', async () => {
    await expect(openClient(port, '/irgendwo')).rejects.toThrow(/Kein Handschlag/)
  }, SERVER_TIMEOUT)
})
