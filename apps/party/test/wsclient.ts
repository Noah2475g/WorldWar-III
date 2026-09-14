import { randomBytes } from 'node:crypto'
import { connect, type Socket } from 'node:net'
import { FrameReader } from '../src/server.ts'

/**
 * Ein WebSocket-Client in vierzig Zeilen — für die Prüfläufe gegen den echten Dienst
 * (T-M38-07, T-M39-01).
 *
 * **Absichtlich winzig und absichtlich nicht der Transport der Browserseite.** Würde hier
 * `websocketTransport.ts` stehen, prüften beide Seiten des Laufs dieselbe Annahme: ein
 * Fehler im Rahmenformat wäre auf beiden Seiten derselbe und fiele nie auf. Dieser Client
 * schreibt die Rahmen von Hand, maskiert wie RFC 6455 es vom Client verlangt, und liest
 * die Antwort mit dem `FrameReader` des Dienstes.
 *
 * Herausgezogen aus `server.test.ts`, damit `room.test.ts` daneben dieselbe Leitung
 * benutzt statt einer zweiten Nachbildung.
 */

/** Ein Rahmen vom Client zum Server ist **maskiert** — das verlangt RFC 6455. */
export function maskedFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = randomBytes(4)
  const head: number[] = [0x81]
  if (payload.length < 126) head.push(0x80 | payload.length)
  else head.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff)
  const maskiert = Buffer.from(payload)
  for (let i = 0; i < maskiert.length; i += 1) maskiert[i] = maskiert[i]! ^ mask[i % 4]!
  return Buffer.concat([Buffer.from(head), mask, maskiert])
}

export interface Client {
  socket: Socket
  received: string[]
  closedWith: { code?: number; reason: string } | null
  send(text: string): void
  end(): void
}

export function openClient(port: number, path: string): Promise<Client> {
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
export function httpGet(
  port: number,
  path: string,
  host = '127.0.0.1',
): Promise<{ status: number; headers: string; body: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, host)
    let antwort = ''
    socket.on('error', reject)
    socket.on('connect', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`)
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
export async function until(bedingung: () => boolean, was: string): Promise<void> {
  for (let versuch = 0; versuch < 400; versuch += 1) {
    if (bedingung()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Hat nicht stattgefunden: ${was}`)
}
