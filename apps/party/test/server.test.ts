import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  REFUSED_CLOSE_CODE,
  Room,
  Rooms,
  SEATS,
  ROOM_FULL,
  type Connection,
} from '../src/room.ts'
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
import {
  DEFAULT_PORT,
  hostLines,
  isTailscaleAddress,
  localAddresses,
  parseArgs,
} from '../src/index.ts'
import { httpGet, maskedFrame, openClient, until } from './wsclient.ts'

/** Die Wurzel des Repos — fuer die zwei Zusicherungen, die Quelltext lesen. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

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
    raeume.open('eins', 'geheim')
    raeume.of('eins').join(stumm())
    expect(raeume.count).toBe(1)
    raeume.of('eins').leave('p1')
    raeume.forgetIfEmpty('eins')
    expect(raeume.count).toBe(0)
    // Die EINLADUNG bleibt: ein Link, der tot ist, sobald beide Seiten fuer zehn Sekunden
    // die Verbindung verlieren, waere keiner (T-M39-01).
    expect(raeume.admits('eins', 'geheim')).toBe(true)
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

/**
 * Die Raeume, die dieser Dienst eroeffnet (T-M39-01).
 *
 * Feste Kennungen und feste Geheimnisse, damit die Zusicherungen lesbar bleiben. Im
 * Betrieb erzeugt beides `Rooms.open()` aus `randomBytes` — und ein Dienst, der jeden
 * erfundenen Raumnamen annaehme, haette kein Geheimnis, sondern eine Formalitaet.
 */
const RAEUME = [
  { id: 'partie', secret: 'geheim-partie' },
  { id: 'voll', secret: 'geheim-voll' },
  { id: 'wiederkehr', secret: 'geheim-wiederkehr' },
  { id: 'platzwahl', secret: 'geheim-platzwahl' },
]

/** Ein Ordner mit einer index.html - so wenig Buendel, wie ein Dienst braucht. */
const dienstWurzel = mkdtempSync(join(tmpdir(), 'worldwar-dist-'))
writeFileSync(join(dienstWurzel, 'index.html'), '<!doctype html><title>WorldWar</title>')
writeFileSync(join(dienstWurzel, 'world.json'), JSON.stringify({ id: 'world', provinces: [{ id: 'de-1' }] }))

describe('R-MP-11/AK1 Der Dienst laeuft wirklich', () => {
  let dienst: PartyServer
  let port = 0

  beforeAll(async () => {
    dienst = createPartyServer({ root: dienstWurzel, host: '127.0.0.1', rooms: RAEUME })
    port = await dienst.listen()
  }, SERVER_TIMEOUT)

  afterAll(async () => {
    await dienst.close()
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
    const a = await openClient(port, '/raum/partie?s=geheim-partie')
    const b = await openClient(port, '/raum/partie?s=geheim-partie')
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
    const a = await openClient(port, '/raum/voll?s=geheim-voll')
    const b = await openClient(port, '/raum/voll?s=geheim-voll')
    await until(() => dienst.rooms.of('voll').full, 'beide Plaetze besetzt')

    const c = await openClient(port, '/raum/voll?s=geheim-voll')
    await until(() => c.closedWith !== null, 'der dritte bekommt seinen Grund')

    expect(c.closedWith?.reason).toBe(ROOM_FULL)
    // Seit T-M39-01 ist es ein ABWEISUNGS-Code (4001) und nicht mehr 1000: der Transport
    // im Browser baut eine abgerissene Leitung sonst sechsmal neu auf und findet sechsmal
    // denselben vollen Raum (T-M38-06, RECONNECT_BACKOFF_MS).
    expect(c.closedWith?.code, 'ein Schliessrahmen ohne Code ist ein Protokollfehler').toBe(
      REFUSED_CLOSE_CODE,
    )
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
    const a = await openClient(port, '/raum/wiederkehr?s=geheim-wiederkehr')
    const b = await openClient(port, '/raum/wiederkehr?s=geheim-wiederkehr')
    await until(() => dienst.rooms.of('wiederkehr').full, 'beide Plaetze besetzt')

    a.end()
    await until(() => dienst.rooms.of('wiederkehr').seated.length === 1, 'der Platz wird frei')

    const c = await openClient(port, '/raum/wiederkehr?s=geheim-wiederkehr')
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

/**
 * Ein Startbefehl fuer den Host (T-M39-04, R-MP-11, D28.10).
 *
 * `pnpm mp:host` baut das Buendel, startet den Dienst und druckt den Link. Was hier
 * geprueft wird, sind die Teile, die eine Aussage tragen: die Befehlszeile, die Adressen
 * und die zwei Links. Der Bau selbst wird NICHT hier gefahren - `vite build` gehoert nicht
 * in eine Pruefkette, die nach jedem Commit laeuft; dass er die Flagge setzt, steht als
 * Zusicherung am Quelltext.
 */
describe('R-MP-11 Ein Befehl, keine Anleitung mit sieben Schritten', () => {
  it('liest die Befehlszeile und weist Unbekanntes ab, statt es zu raten', () => {
    expect(parseArgs([])).toMatchObject({ port: DEFAULT_PORT, build: true })
    expect(parseArgs(['--no-build'])).toMatchObject({ build: false })
    expect(parseArgs(['--port', '8080'])).toMatchObject({ port: 8080 })
    // Die alte Form aus M38 bleibt: `node index.ts 7749` steht in Kommentaren.
    expect(parseArgs(['7749'])).toMatchObject({ port: 7749 })
    // Wer `--pport` tippt, soll es erfahren, statt eine Partie auf einem Port zu
    // eroeffnen, den niemand kennt.
    expect(parseArgs(['--pport', '1'])).toEqual({ error: 'Unbekannte Angabe: --pport' })
    expect(parseArgs(['--port', 'abc'])).toMatchObject({ error: expect.stringContaining('Kein Port') })
    expect(parseArgs(['--port', '99999'])).toMatchObject({ error: expect.stringContaining('Kein Port') })
  })

  it('setzt die Bauflagge im Prozess und nicht im Skripteintrag', () => {
    // `VAR=1 pnpm ...` ist eine Schreibweise der POSIX-Schale; `pnpm run` startet auf
    // Windows cmd.exe, und dort ist dieselbe Zeile ein Fehler. Gebunden wird der
    // Quelltext, weil ein echter Bau hier Sekunden kostete.
    const quelle = readFileSync(join(ROOT, 'apps/party/src/index.ts'), 'utf8')
    expect(quelle).toContain("WORLDWAR_MULTIPLAYER: '1'")

    const skripte = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(skripte.scripts['mp:host']).toBe('node apps/party/src/index.ts')
    expect(skripte.scripts['mp:host'], 'eine Zuweisung, die cmd.exe nicht kennt').not.toContain('=')
  })

  it('druckt zwei Links aus einem Raum — den eigenen und den fuer den Gast', () => {
    const zeilen = hostLines({ id: 'raum1', secret: 'geheim' }, 7749, [
      { name: 'Tailscale', address: '100.101.102.103', tailscale: true },
    ]).join('\n')

    expect(zeilen).toContain('http://100.101.102.103:7749/#/gastgeben?raum=raum1&s=geheim')
    expect(zeilen).toContain('http://100.101.102.103:7749/#/beitreten?raum=raum1&s=geheim')
    expect(zeilen).toContain('7749')
  })

  it('startet nach einem sauberen Ende wieder auf demselben Port', async () => {
    // FALLE aus M12: einen langen Lauf abzubrechen beendet ihn nicht. Gemessen wird am
    // Ergebnis - ein zweites `listen` auf demselben Port gelingt nur, wenn das erste den
    // Sockel wirklich losgelassen hat.
    const eins = createPartyServer({ root: dienstWurzel, host: '127.0.0.1' })
    const port = await eins.listen()
    await eins.close()

    const zwei = createPartyServer({ root: dienstWurzel, host: '127.0.0.1', port })
    expect(await zwei.listen()).toBe(port)
    await zwei.close()
  }, SERVER_TIMEOUT)
})

/**
 * Die letzte Meile ueber Tailscale (T-M39-05, R-MP-10, D28.10).
 *
 * **Was hier gemessen wird, und was ausdruecklich nicht.** Geprueft ist, dass der Dienst
 * auf ALLEN Schnittstellen horcht und von einer Adresse dieses Rechners erreichbar ist,
 * die nicht die Rueckschleife ist - genau der Fehler, der erst am Abend auffiele. Und
 * geprueft ist, dass der Dienst eine Tailscale-Adresse als solche erkennt.
 *
 * NICHT geprueft ist, dass ein Gast in einem anderen Netz ankommt: dazu braucht es ein
 * angemeldetes Tailnet und einen zweiten Menschen. Gemessen am 2026-09-14 auf dieser
 * Maschine: Tailscale 1.102.2 ist installiert, aber nicht angemeldet - `tailscale ip -4`
 * meldet "no current Tailscale IPs; state: NoState", und die Tailscale-Schnittstelle
 * traegt 169.254.83.107 statt einer Adresse aus 100.64.0.0/10. Der Rest ist AK-9 und
 * steht als ausdruecklicher Schritt in docs/ANLEITUNG.md.
 */
describe('R-MP-10 Die letzte Meile: der Dienst horcht nicht nur auf localhost', () => {
  it('erkennt eine Tailscale-Adresse an ihrem Bereich, und sonst keine', () => {
    // 100.64.0.0/10 ist der Bereich aus RFC 6598, den Tailscale fuer das Tailnet benutzt.
    for (const ja of ['100.64.0.1', '100.101.102.103', '100.127.255.254']) {
      expect(isTailscaleAddress(ja), ja).toBe(true)
    }
    for (const nein of ['100.63.255.255', '100.128.0.1', '192.168.178.93', '127.0.0.1', 'keine']) {
      expect(isTailscaleAddress(nein), nein).toBe(false)
    }
    // Der gemessene Fall dieser Maschine: Tailscale installiert, nicht angemeldet - die
    // Schnittstelle traegt eine APIPA-Adresse und keine aus dem Tailnet.
    expect(isTailscaleAddress('169.254.83.107')).toBe(false)
  })

  it('laesst die Rueckschleife weg und stellt das Tailnet nach vorn', () => {
    const adressen = localAddresses({
      'Wi-Fi': [{ family: 'IPv4', address: '192.168.178.93', internal: false }],
      Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      Tailscale: [{ family: 'IPv4', address: '100.101.102.103', internal: false }],
    } as never)

    expect(adressen.map((a) => a.address)).toEqual(['100.101.102.103', '192.168.178.93'])
    expect(adressen[0]!.tailscale).toBe(true)
  })

  it('sagt es, wenn es kein Tailnet gibt, statt einen Link ins Leere zu drucken', () => {
    const zeilen = hostLines({ id: 'r', secret: 'g' }, 7749, [
      { name: 'Wi-Fi', address: '192.168.178.93', tailscale: false },
    ]).join('\n')

    expect(zeilen).toContain('100.64.0.0/10')
    expect(zeilen, 'der Hinweis fehlt, dass das kein Fehler ist').toContain('keine Stoerung')
    expect(zeilen).toContain('nur im lokalen Netz')
  })

  it('ist von einer Adresse erreichbar, die nicht die Rueckschleife ist', async () => {
    // Die eigentliche Zusage, und sie wird am laufenden Dienst gemessen: ohne sie ist der
    // Dienst im Tailnet unerreichbar. Voreinstellung ist 0.0.0.0 - kein `host` gesetzt.
    const aussen = localAddresses().find((entry) => !entry.address.startsWith('169.254.'))
    expect(aussen, 'diese Maschine hat keine Adresse ausser der Rueckschleife').toBeTruthy()

    const dienst = createPartyServer({ root: dienstWurzel })
    const port = await dienst.listen()
    try {
      const antwort = await httpGet(port, '/', aussen!.address)
      expect(antwort.status, `nicht erreichbar ueber ${aussen!.address}`).toBe(200)
      expect(antwort.body).toContain('WorldWar')
    } finally {
      await dienst.close()
    }
  }, SERVER_TIMEOUT)
})
