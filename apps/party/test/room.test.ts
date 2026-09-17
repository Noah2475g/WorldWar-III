import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseNetLink, seatOfRole, socketUrlOf } from '../../desktop/src/net/link.ts'
import {
  REFUSED_CLOSE_CODE,
  ROOM_ID_BYTES,
  Room,
  Rooms,
  SEAT_TAKEN,
  SECRET_BYTES,
  WRONG_SECRET,
  createRoomId,
  createSecret,
  inviteLink,
  secretMatches,
  type Connection,
} from '../src/room.ts'
import { createPartyServer, secretOf, seatOf, type PartyServer } from '../src/server.ts'
import { openClient, until } from './wsclient.ts'

/**
 * Der Raum, der Link und das Geheimnis (T-M39-01, R-MP-10, D28.10, MEHRSPIELER.md §3.7).
 *
 * **Was diese Datei belegt, und was sie ausdrücklich nicht kann.** Sie prüft zweierlei:
 * die Form des Links (reine Funktionen, in beide Richtungen — gebaut im Hostdienst,
 * gelesen im Browser) und die Wirkung des Geheimnisses am **laufenden Dienst**, über einen
 * echten TCP-Sockel. Sie kann nicht prüfen, dass ein Link durch ein Tailnet kommt; das ist
 * T-M39-05 und braucht am Ende zwei echte Rechner (AK-9).
 *
 * Der Rundlauf ist die wichtigere Hälfte: das Format des Links existiert an **zwei**
 * Stellen — `inviteLink` baut ihn in Node, `parseNetLink` liest ihn im Browser. Zwei Seiten
 * derselben Zeichenkette, die niemand zusammenhält, laufen auseinander, sobald einer von
 * beiden ein Feld umbenennt; deshalb baut dieser Lauf mit der einen Funktion und liest mit
 * der anderen, statt beide gegen eine abgeschriebene Beispieladresse zu halten.
 */

const stumm = (): Connection & { gesendet: string[]; geschlossen: { reason: string; code?: number }[] } => {
  const gesendet: string[] = []
  const geschlossen: { reason: string; code?: number }[] = []
  return {
    gesendet,
    geschlossen,
    send: (d) => gesendet.push(d),
    close: (reason, code) => geschlossen.push({ reason, ...(code === undefined ? {} : { code }) }),
  }
}

describe('R-MP-10/AK1 Die Einladung ist ein Link', () => {
  const einladung = { id: 'abcdef', secret: 'streng-geheim' }

  it('traegt Raum und Geheimnis, und das Geheimnis hinter dem Rautezeichen', () => {
    const link = inviteLink('http://rechner.tailnet.ts.net:7749', einladung)

    expect(link).toBe('http://rechner.tailnet.ts.net:7749/#/beitreten?raum=abcdef&s=streng-geheim')

    // Die eigentliche Zusage: was der Browser BEIM LADEN DER SEITE hinausschickt, ist
    // alles vor dem Rautezeichen - und darin steht weder Raum noch Geheimnis.
    const [anfrage, fragment] = link.split('#')
    expect(anfrage, 'der Raum steht in der Anfragezeile').not.toContain('abcdef')
    expect(anfrage, 'das Geheimnis steht in der Anfragezeile').not.toContain('streng-geheim')
    expect(fragment).toContain('streng-geheim')
  })

  it('laesst sich von der Browserseite wieder auseinandernehmen — in beide Rollen', () => {
    for (const role of ['guest', 'host'] as const) {
      const link = inviteLink('http://rechner.tailnet.ts.net:7749', einladung, role)
      const gelesen = parseNetLink(new URL(link).hash)

      expect(gelesen, link).toEqual({ role, room: einladung.id, secret: einladung.secret })
    }
  })

  it('haelt auch ein Geheimnis aus, das Sonderzeichen traegt', () => {
    // base64url kennt keine, aber der Link darf nicht daran haengen, dass niemand je ein
    // anderes Alphabet waehlt: ein `+` in der Adresse ist ein Leerzeichen, wenn niemand
    // es kodiert.
    const heikel = { id: 'a+b/c', secret: 'x+y/z=' }
    const link = inviteLink('http://host:7749', heikel)

    expect(link).toContain('%2B')
    expect(parseNetLink(new URL(link).hash)).toEqual({ role: 'guest', ...{ room: heikel.id, secret: heikel.secret } })
  })

  it('liest nichts aus einem Fragment, das keine Einladung ist', () => {
    // `null` ist der Normalfall: das Spiel startet im Einzelspieler. Eine HALB gelesene
    // Einladung ist ebenfalls null und nicht „fast" - ein Beitritt mit leerem Geheimnis
    // wuerde abgewiesen, und der Gast suchte den Fehler bei sich.
    for (const fragment of ['', '#', '#/beitreten', '#/beitreten?raum=a', '#/beitreten?s=b', '#/irgendwo?raum=a&s=b']) {
      expect(parseNetLink(fragment), fragment).toBeNull()
    }
  })

  it('macht aus dem Ursprung die Adresse der Leitung, mit demselben Schloss', () => {
    const { id, secret } = einladung
    expect(socketUrlOf('http://host:7749', id, secret)).toBe('ws://host:7749/raum/abcdef?s=streng-geheim')
    expect(socketUrlOf('https://host:7749/', id, secret)).toBe('wss://host:7749/raum/abcdef?s=streng-geheim')
    expect(socketUrlOf('http://host:7749', id, secret, 'p2')).toContain('&platz=p2')
  })

  it('gibt jeder Rolle ihren Platz, und nicht der Reihenfolge des Eintreffens', () => {
    expect(seatOfRole('host')).toBe('p1')
    expect(seatOfRole('guest')).toBe('p2')
  })

  it('erzeugt das Geheimnis im Node-Dienst, mit genug Zufall', () => {
    // D28.10: im Browser gaebe es ohne sicheren Kontext keine brauchbare Quelle dafuer,
    // und Math.random ist keine. Gemessen wird, was zaehlt: Laenge, Alphabet und dass
    // tausend Ziehungen tausend verschiedene Werte sind.
    const geheimnisse = new Set(Array.from({ length: 1000 }, () => createSecret()))

    expect(geheimnisse.size, 'zwei gleiche Geheimnisse in tausend Ziehungen').toBe(1000)
    for (const geheimnis of geheimnisse) {
      expect(geheimnis).toMatch(/^[A-Za-z0-9_-]+$/)
      // 16 Bytes sind als base64url 22 Zeichen - ohne die Fuellzeichen von base64.
      expect(geheimnis).toHaveLength(Math.ceil((SECRET_BYTES * 8) / 6))
    }
    expect(createRoomId()).toHaveLength(Math.ceil((ROOM_ID_BYTES * 8) / 6))
  })

  it('vergleicht Geheimnisse, ohne sich von Laenge oder Leere taeuschen zu lassen', () => {
    expect(secretMatches('geheim', 'geheim')).toBe(true)
    expect(secretMatches('geheim', 'Geheim')).toBe(false)
    expect(secretMatches('geheim', 'geheimer')).toBe(false)
    // Der gefaehrliche Fall: ein Raum ohne Geheimnis darf nicht jeden hereinlassen.
    expect(secretMatches('', '')).toBe(false)
  })
})

describe('R-MP-10/AK2 Ohne gueltiges Geheimnis kein Beitritt', () => {
  it('kennt nur Raeume, die dieser Dienst eroeffnet hat', () => {
    const raeume = new Rooms()
    const einladung = raeume.open()

    expect(raeume.admits(einladung.id, einladung.secret)).toBe(true)
    expect(raeume.admits(einladung.id, `${einladung.secret}x`), 'falsches Geheimnis').toBe(false)
    expect(raeume.admits(einladung.id, ''), 'gar kein Geheimnis').toBe(false)
    // Eine unbekannte Kennung wird genauso beantwortet wie ein falsches Geheimnis - wer
    // beide Faelle unterscheidet, verraet, welche Raeume es gibt.
    expect(raeume.admits('erfunden', einladung.secret)).toBe(false)
  })

  it('liest das Geheimnis und den Wunschplatz aus der Verbindungsadresse', () => {
    expect(secretOf('/raum/abc?s=geheim')).toBe('geheim')
    expect(secretOf('/raum/abc')).toBe('')
    expect(secretOf('/raum/abc?platz=p2&s=ge%2Bheim')).toBe('ge+heim')
    expect(seatOf('/raum/abc?s=x&platz=p2')).toBe('p2')
    expect(seatOf('/raum/abc?s=x&platz=p9'), 'ein Platz, den es nicht gibt').toBeNull()
    expect(seatOf('/raum/abc?s=x')).toBeNull()
  })

  it('gibt jeder Rolle ihren Platz, gleich wer zuerst da ist', () => {
    // Der Gast kommt zuerst und bekommt trotzdem p2: sonst haenge die Nation daran, wer
    // schneller geklickt hat, und die Partie liefe mit vertauschten Rollen an.
    const raum = new Room('abc')
    expect(raum.join(stumm(), { seat: 'p2' })).toEqual({ ok: true, seat: 'p2' })
    expect(raum.join(stumm(), { seat: 'p1' })).toEqual({ ok: true, seat: 'p1' })
    expect(raum.seated.map((o) => o.seat)).toEqual(['p1', 'p2'])
  })

  it('weist einen zweiten Gastgeber ab, statt ihm den freien Gastplatz zu geben', () => {
    const raum = new Room('abc')
    raum.join(stumm(), { seat: 'p1' })
    const zweiter = stumm()

    expect(raum.join(zweiter, { seat: 'p1' })).toEqual({ ok: false, reason: SEAT_TAKEN })
    expect(zweiter.geschlossen).toEqual([{ reason: SEAT_TAKEN, code: REFUSED_CLOSE_CODE }])
  })
})

/**
 * Und dasselbe am laufenden Dienst (R-MP-10/AK2).
 *
 * Ein grüner Einzeltest sagt nichts über das Spiel: die Zusicherungen darüber prüfen
 * Funktionen, diese prüft, dass der Dienst eine Verbindung mit falschem Geheimnis
 * **wirklich** nicht annimmt — über einen echten Sockel, mit einem von Hand geschriebenen
 * Client.
 */
describe('R-MP-10/AK2 Der laufende Dienst laesst niemanden ohne Geheimnis herein', () => {
  let dienst: PartyServer
  let port = 0
  let wurzel = ''
  const einladung = { id: 'partie39', secret: 'das-geheimnis-des-raums' }

  beforeAll(async () => {
    wurzel = mkdtempSync(join(tmpdir(), 'worldwar-m39-'))
    writeFileSync(join(wurzel, 'index.html'), '<!doctype html><title>WorldWar</title>')
    dienst = createPartyServer({ root: wurzel, host: '127.0.0.1', rooms: [einladung] })
    port = await dienst.listen()
  }, 15_000)

  afterAll(async () => {
    await dienst.close()
    rmSync(wurzel, { recursive: true, force: true })
  })

  it('nennt seine Einladung, damit ein Link daraus werden kann', () => {
    expect(dienst.invitations).toEqual([einladung])
  })

  it('nimmt eine Verbindung mit dem richtigen Geheimnis an', async () => {
    const gast = await openClient(port, `/raum/${einladung.id}?s=${einladung.secret}&platz=p2`)
    await until(() => dienst.rooms.at(einladung.id)?.seated.length === 1, 'der Gast sitzt')

    expect(gast.closedWith).toBeNull()
    expect(dienst.rooms.at(einladung.id)?.seated.map((o) => o.seat)).toEqual(['p2'])
    gast.end()
    await until(() => dienst.rooms.at(einladung.id) === null, 'der leere Raum verschwindet')
  }, 15_000)

  it('weist ein falsches und ein fehlendes Geheimnis ab — mit demselben Satz', async () => {
    for (const adresse of [`/raum/${einladung.id}?s=falsch`, `/raum/${einladung.id}`, '/raum/erfunden?s=falsch']) {
      const versuch = await openClient(port, adresse)
      await until(() => versuch.closedWith !== null, `abgewiesen: ${adresse}`)

      expect(versuch.closedWith?.reason, adresse).toBe(WRONG_SECRET)
      // Ein Abweisungs-Code und nicht 1000: der Transport im Browser baut sonst sechsmal
      // dieselbe verschlossene Tuer wieder auf (T-M38-06, RECONNECT_BACKOFF_MS).
      expect(versuch.closedWith?.code, adresse).toBe(REFUSED_CLOSE_CODE)
      expect(dienst.rooms.at(einladung.id), 'ein Abgewiesener hat einen Raum angelegt').toBeNull()
      versuch.end()
    }
  }, 15_000)

  it('haelt die Einladung fest, auch wenn der Raum zwischendurch leer war', async () => {
    // Ein Link, der tot ist, sobald beide Seiten fuer zehn Sekunden die Verbindung
    // verlieren, waere keiner. Der RAUM verschwindet (kein Zustand ueber die Partie
    // hinaus, §6), die EINLADUNG bleibt.
    const erst = await openClient(port, `/raum/${einladung.id}?s=${einladung.secret}`)
    await until(() => dienst.rooms.at(einladung.id) !== null, 'der Raum entsteht')
    erst.end()
    await until(() => dienst.rooms.at(einladung.id) === null, 'der Raum verschwindet')

    const wieder = await openClient(port, `/raum/${einladung.id}?s=${einladung.secret}`)
    await until(() => dienst.rooms.at(einladung.id)?.seated.length === 1, 'derselbe Link traegt wieder')

    expect(wieder.closedWith).toBeNull()
    wieder.end()
  }, 15_000)
})
