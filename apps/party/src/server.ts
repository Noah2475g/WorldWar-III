import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, normalize, resolve, sep } from 'node:path'
import type { Duplex } from 'node:stream'
import {
  REFUSED_CLOSE_CODE,
  ROOM_FULL,
  Rooms,
  SEATS,
  WRONG_SECRET,
  type Connection,
  type Invitation,
  type SeatId,
} from './room.ts'

/**
 * Der Hostdienst: Dateiserver und Briefträger (T-M38-07, R-MP-11, D28.10).
 *
 * Zwei Aufgaben, und keine dritte. Er liefert das **gebaute Bündel** aus — deshalb muss
 * der Gast nichts installieren und kann auch nichts Falsches installieren, denn beide
 * Seiten stammen zwangsläufig aus demselben Bau, und der Handschlag belegt es
 * (T-M38-02). Und er reicht Nachrichten von einem Platz zum anderen weiter, ohne sie zu
 * lesen (`room.ts`).
 *
 * **Keine Abhängigkeit.** Kein Paket, das Geld kostet, ein Konto verlangt oder nach außen
 * funkt (AGENT-EXECUTION §2). `node:http`, `node:crypto` und `node:fs` reichen; der
 * WebSocket-Handschlag ist ein SHA-1 über einen festen Text, und die Rahmen sind zwei
 * Dutzend Zeilen. Eine Bibliothek dafür wäre bequemer und brächte eine Lieferkette mit,
 * die niemand liest.
 *
 * **`node:crypto` ist hier kein Widerspruch zu D28.10.** Die Regel „kein sicherer
 * Kontext" gilt der **Browserseite**, wo `crypto.subtle` über `http` schlicht nicht da
 * ist. In Node stellt sich die Frage nicht — und genau deshalb erzeugt der Dienst später
 * auch das Geheimnis des Links (T-M39-01) und nicht der Browser.
 */

/** Der feste Text aus RFC 6455, mit dem der Handschlag beantwortet wird. */
const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** Die Antwort auf `Sec-WebSocket-Key`. Kein Geheimnis, nur ein Beweis des Verstehens. */
export function acceptKey(key: string): string {
  return createHash('sha1').update(`${key}${WEBSOCKET_GUID}`).digest('base64')
}

/** Welche Rahmenart ein Paket trägt. Mehr Arten braucht dieser Dienst nicht. */
export type FrameKind = 'text' | 'close' | 'ping' | 'pong'

export interface Frame {
  kind: FrameKind
  data: string
  /** Nur bei `close`: der Schließcode aus den ersten zwei Bytes der Nutzlast. */
  code?: number
}

const OPCODES: Record<number, FrameKind | 'continuation'> = {
  0x0: 'continuation',
  0x1: 'text',
  0x8: 'close',
  0x9: 'ping',
  0xa: 'pong',
}

/**
 * Ein Rahmen, wie der Server ihn schickt: **ohne Maske**.
 *
 * Der Client maskiert, der Server nicht — das steht so in RFC 6455 und ist keine Wahl:
 * ein maskierter Rahmen vom Server lässt jeden Browser die Verbindung abbrechen.
 */
export function encodeFrame(data: string, opcode = 0x1): Buffer {
  const payload = Buffer.from(data, 'utf8')
  const head: number[] = [0x80 | opcode]
  if (payload.length < 126) {
    head.push(payload.length)
  } else if (payload.length < 65_536) {
    head.push(126, (payload.length >> 8) & 0xff, payload.length & 0xff)
  } else {
    // Acht Bytes, groesse Zahl zuerst. Ein Spielstand von einem Viertelmegabyte geht
    // genau hier hindurch (D28.11) - ohne diesen Zweig waere die Wiederaufnahme still kaputt.
    head.push(127)
    const big = BigInt(payload.length)
    for (let shift = 56n; shift >= 0n; shift -= 8n) head.push(Number((big >> shift) & 0xffn))
  }
  return Buffer.concat([Buffer.from(head), payload])
}

/**
 * Ein Schließrahmen, wie RFC 6455 ihn verlangt: zwei Bytes Code, dann der Grund.
 *
 * `1000` heißt „ordentlich beendet". Ein Schließrahmen mit einem Grund, aber ohne Code,
 * ist ein Protokollfehler — und ein Browser beantwortet ihn nicht mit einer Meldung,
 * sondern mit einem Abbruch.
 */
export function encodeCloseFrame(reason: string, code = 1000): Buffer {
  const grund = Buffer.from(reason, 'utf8')
  const payload = Buffer.concat([Buffer.from([(code >> 8) & 0xff, code & 0xff]), grund])
  const head = payload.length < 126 ? [0x88, payload.length] : [0x88, 126, (payload.length >> 8) & 0xff, payload.length & 0xff]
  return Buffer.concat([Buffer.from(head), payload])
}

/**
 * Rahmen einsammeln, bis sie vollständig sind.
 *
 * TCP kennt keine Nachrichten, nur Bytes: ein Paket kann zwei Rahmen enthalten oder einen
 * halben. Dieser Leser hält den Rest und gibt nur heraus, was ganz da ist — und setzt
 * fortgesetzte Rahmen (`opcode 0`) wieder zusammen, statt sie einzeln auszuliefern.
 */
export class FrameReader {
  private rest = Buffer.alloc(0)
  private partial: { kind: FrameKind; parts: Buffer[] } | null = null

  push(chunk: Buffer): Frame[] {
    this.rest = Buffer.concat([this.rest, chunk])
    const out: Frame[] = []

    for (;;) {
      const gelesen = this.readOne()
      if (!gelesen) return out
      if (gelesen.frame) out.push(gelesen.frame)
    }
  }

  private readOne(): { frame: Frame | null } | null {
    const buffer = this.rest
    if (buffer.length < 2) return null

    const first = buffer[0]!
    const second = buffer[1]!
    const fin = (first & 0x80) !== 0
    const art = OPCODES[first & 0x0f]
    const maskiert = (second & 0x80) !== 0
    let laenge = second & 0x7f
    let at = 2

    if (laenge === 126) {
      if (buffer.length < at + 2) return null
      laenge = buffer.readUInt16BE(at)
      at += 2
    } else if (laenge === 127) {
      if (buffer.length < at + 8) return null
      laenge = Number(buffer.readBigUInt64BE(at))
      at += 8
    }

    const maskAt = at
    if (maskiert) at += 4
    if (buffer.length < at + laenge) return null

    const payload = Buffer.from(buffer.subarray(at, at + laenge))
    if (maskiert) {
      for (let i = 0; i < payload.length; i += 1) payload[i] = payload[i]! ^ buffer[maskAt + (i % 4)]!
    }
    this.rest = buffer.subarray(at + laenge)

    if (art === undefined) {
      // Eine unbekannte Rahmenart wird verworfen und nicht geraten - dieselbe Richtung
      // wie im Protokoll daneben.
      return { frame: null }
    }
    if (art === 'close') {
      // Die Nutzlast eines Schliessrahmens ist zwei Bytes Code und danach der Grund.
      // Wer den Grund als Ganzes liest, bekommt zwei Steuerzeichen vorangestellt - und
      // ein Browser, der einen Rahmen ohne gueltigen Code bekommt, bricht ab.
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : undefined
      const grund = payload.length > 2 ? payload.subarray(2).toString('utf8') : ''
      return { frame: { kind: 'close', data: grund, ...(code === undefined ? {} : { code }) } }
    }
    if (art === 'continuation' || !fin) {
      const kind = art === 'continuation' ? this.partial?.kind : art
      if (!kind) return { frame: null }
      const parts = [...(this.partial?.parts ?? []), payload]
      if (!fin) {
        this.partial = { kind, parts }
        return { frame: null }
      }
      this.partial = null
      return { frame: { kind, data: Buffer.concat(parts).toString('utf8') } }
    }
    return { frame: { kind: art, data: payload.toString('utf8') } }
  }
}

/** Wonach ein Browser eine Datei fragt, und was sie ist. */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function contentTypeOf(path: string): string {
  const punkt = path.lastIndexOf('.')
  return (punkt >= 0 ? CONTENT_TYPES[path.slice(punkt).toLowerCase()] : undefined) ?? 'application/octet-stream'
}

/**
 * Welche Datei eine Adresse meint — oder `null`, wenn sie aus dem Ordner hinauszeigt.
 *
 * Der Dienst liegt im privaten Netz und wird von einem Freund benutzt; trotzdem wird der
 * Pfad geprüft. `/../../.ssh/id_rsa` ist keine theoretische Adresse, sondern die erste,
 * die jeder ausprobiert — und ein Dienst, der sie beantwortet, verschenkt den Rechner.
 *
 * **Die Wurzel wird zuerst aufgelöst, und daran hing der ganze Dienst** (Befund MP-1,
 * Sichtprüfung 2026-09-14). `join` normalisiert die Trenner, der Vergleich davor nicht:
 * unter Windows ergab die Wurzel `…\WorldWar\apps/desktop/dist` (so setzt `index.ts` sie
 * aus `fileURLToPath` und einem Schrägstrich-Rest zusammen) ein `ziel` mit lauter
 * Rückstrichen — und `startsWith` sagte „zeigt hinaus". `pnpm mp:host` antwortete deshalb
 * auf **jede** Adresse mit 404, auch auf `/index.html`. Der Test sah es nicht, weil
 * `mkdtempSync(join(tmpdir(), …))` immer eine normalisierte Wurzel liefert.
 */
export function resolveStatic(root: string, urlPath: string): string | null {
  const basis = resolve(root)
  const ohneQuery = urlPath.split('?')[0]!.split('#')[0]!
  const entschluesselt = decodeURIComponent(ohneQuery)
  const relativ = normalize(entschluesselt === '/' ? '/index.html' : entschluesselt).replace(/^[/\\]+/, '')
  if (relativ.split(/[/\\]/).includes('..')) return null

  const ziel = join(basis, relativ)
  if (!ziel.startsWith(basis.endsWith(sep) ? basis : `${basis}${sep}`)) return null
  if (!existsSync(ziel) || !statSync(ziel).isFile()) return null
  return ziel
}

/** Der Raum, den eine Verbindungsadresse meint: `/raum/<id>`. */
export function roomIdOf(urlPath: string): string | null {
  const treffer = /^\/raum\/([A-Za-z0-9_-]{1,64})$/.exec(urlPath.split('?')[0] ?? '')
  return treffer?.[1] ?? null
}

/**
 * Das Geheimnis aus der Verbindungsadresse: `/raum/<id>?s=<geheimnis>` (T-M39-01).
 *
 * **Hier und nicht beim Laden der Seite.** Im Link steht das Geheimnis hinter dem
 * Rautezeichen und geht deshalb nie an den Dateiserver (D28.10); beim Aufbau der Partie
 * muss es hinaus, denn irgendwo muss es geprüft werden. Der Dienst schreibt kein
 * Zugriffsprotokoll — er hat keine Zeile dafür —, und das ist die zweite Hälfte der Zusage.
 */
export function secretOf(urlPath: string): string {
  const frage = urlPath.indexOf('?')
  if (frage < 0) return ''
  return new URLSearchParams(urlPath.slice(frage + 1)).get('s') ?? ''
}

/** Welchen Platz eine Verbindungsadresse verlangt — `null` heisst „den ersten freien". */
export function seatOf(urlPath: string): SeatId | null {
  const frage = urlPath.indexOf('?')
  if (frage < 0) return null
  const gewuenscht = new URLSearchParams(urlPath.slice(frage + 1)).get('platz') ?? ''
  return (SEATS as readonly string[]).includes(gewuenscht) ? (gewuenscht as SeatId) : null
}


export interface PartyServerOptions {
  /** Der Ordner mit dem gebauten Bündel — `apps/desktop/dist` im Betrieb. */
  root: string
  /** `0` heißt „such dir einen freien Port" — im Test das Einzige, was nicht hängt. */
  port?: number
  /**
   * Voreinstellung `0.0.0.0`: im Tailnet ist der Dienst sonst unerreichbar, und das fällt
   * erst am Abend auf (T-M39-05 misst es).
   */
  host?: string
  /**
   * Welche Räume dieser Dienst eröffnet (T-M39-01).
   *
   * Ohne Angabe **genau einer**, mit frischer Kennung und frischem Geheimnis — der Raum,
   * dessen Link `pnpm mp:host` druckt. Ein Dienst, der jeden erfundenen Raumnamen
   * annähme, hätte kein Geheimnis, sondern eine Formalität.
   */
  rooms?: readonly Invitation[]
}

export interface PartyServer {
  readonly server: Server
  readonly rooms: Rooms
  /** Die eröffneten Räume samt Geheimnis — daraus entsteht der Link (T-M39-01). */
  readonly invitations: readonly Invitation[]
  /** Der Port, auf dem wirklich gehorcht wird. Erst nach `listen` gültig. */
  readonly port: number
  listen(): Promise<number>
  close(): Promise<void>
}

export function createPartyServer(options: PartyServerOptions): PartyServer {
  const rooms = new Rooms()
  if (options.rooms && options.rooms.length > 0) {
    for (const invitation of options.rooms) rooms.open(invitation.id, invitation.secret)
  } else {
    rooms.open()
  }
  const sockets = new Set<Duplex>()

  const server = createServer((request, response) => {
    const datei = resolveStatic(options.root, request.url ?? '/')
    if (!datei) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Nicht gefunden.')
      return
    }
    const inhalt = readFileSync(datei)
    response.writeHead(200, {
      'content-type': contentTypeOf(datei),
      'content-length': String(inhalt.length),
      // Der Gast holt das Buendel einmal je Partie; ein Zwischenspeicher, der eine alte
      // Fassung ausliefert, macht aus zwei gleichen Bauten zwei verschiedene.
      'cache-control': 'no-store',
    })
    response.end(inhalt)
  })

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const raumId = roomIdOf(request.url ?? '')
    const key = request.headers['sec-websocket-key']
    if (!raumId || typeof key !== 'string') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      return
    }

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
    )
    sockets.add(socket)

    const reader = new FrameReader()
    const connection: Connection = {
      send: (data) => {
        if (!socket.destroyed) socket.write(encodeFrame(data))
      },
      close: (reason, code) => {
        if (socket.destroyed) return
        socket.write(encodeCloseFrame(reason, code))
        socket.end()
      },
    }

    // Das Geheimnis wird HIER geprueft und nicht beim Laden der Seite (R-MP-10/AK2,
    // D28.10): im Link steht es hinter dem Rautezeichen und geht dort nie an den Server.
    // Eine unbekannte Kennung wird genauso beantwortet wie ein falsches Geheimnis — wer
    // beide Faelle unterscheidet, verraet, welche Raeume es gibt.
    if (!rooms.admits(raumId, secretOf(request.url ?? ''))) {
      socket.write(encodeCloseFrame(WRONG_SECRET, REFUSED_CLOSE_CODE))
      socket.end()
      sockets.delete(socket)
      return
    }

    const raum = rooms.of(raumId)
    const platz = raum.join(connection, {
      name: String(request.headers['x-player-name'] ?? ''),
      ...(seatOf(request.url ?? '') ? { seat: seatOf(request.url ?? '')! } : {}),
    })
    if (!platz.ok) {
      // Der dritte bekommt seinen Grund und dann die Tuer; der Raum bleibt unberuehrt.
      sockets.delete(socket)
      return
    }
    const seat: SeatId = platz.seat

    socket.on('data', (chunk: Buffer) => {
      for (const frame of reader.push(chunk)) {
        if (frame.kind === 'text') raum.relay(seat, frame.data)
        else if (frame.kind === 'ping') connection.send(frame.data)
        else if (frame.kind === 'close') connection.close('Auf Wiedersehen.')
      }
    })

    /**
     * Der Platz wird frei, sobald die Gegenseite fort ist — und `end` ist der Ernstfall.
     *
     * **Gemessen am 2026-09-14:** ein Sockel aus `server.on('upgrade')` feuert `end` nach
     * rund 65 ms, wenn der Gast seine Verbindung wegwirft — und `close` **nie**. Die
     * HTTP-Schicht reicht den Sockel halb offen heraus: die Leseseite ist zu, die
     * Schreibseite bleibt stehen, bis jemand sie schließt. Ein Dienst, der nur auf `close`
     * hört, behält den Platz für immer besetzt, und der zweite Gast findet einen vollen
     * Raum, in dem niemand sitzt. Deshalb wird hier auf `end` reagiert **und** der Sockel
     * selbst beendet; `close` und `error` bleiben als zweite und dritte Tür.
     */
    const abgang = (): void => {
      raum.leave(seat)
      rooms.forgetIfEmpty(raumId)
      sockets.delete(socket)
      if (!socket.destroyed) socket.destroy()
    }
    socket.on('end', abgang)
    socket.on('close', abgang)
    socket.on('error', abgang)

    if (head.length > 0) {
      for (const frame of reader.push(head)) {
        if (frame.kind === 'text') raum.relay(seat, frame.data)
      }
    }
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  let port = options.port ?? 0

  return {
    server,
    rooms,
    get invitations(): readonly Invitation[] {
      return rooms.invitations
    },
    get port(): number {
      return port
    },
    listen(): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(options.port ?? 0, options.host ?? '0.0.0.0', () => {
          const adresse = server.address()
          port = typeof adresse === 'object' && adresse !== null ? adresse.port : 0
          resolve(port)
        })
      })
    },
    close(): Promise<void> {
      // Erst die Gaeste, dann die Sockel, dann der Server: ein offener Sockel haelt
      // `close()` sonst ewig auf, und der Prozess bleibt nach dem Abbruch stehen
      // (WORKFLOW §4 Falle 4).
      rooms.closeAll('Der Dienst faehrt herunter.')
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

export { REFUSED_CLOSE_CODE, ROOM_FULL, WRONG_SECRET }
