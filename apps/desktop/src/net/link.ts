/**
 * Der Link, von der Seite des Browsers gelesen (T-M39-01, R-MP-10, D28.10).
 *
 * ```
 * http://<rechner>.<tailnet>.ts.net:7749/#/beitreten?raum=<id>&s=<geheimnis>
 * ```
 *
 * Gebaut wird dieses Format **einmal**, im Hostdienst (`apps/party/src/room.ts`,
 * `inviteLink`); hier steht die Gegenrichtung. Dass beide dasselbe meinen, hält kein
 * Kommentar zusammen, sondern ein Rundlauf-Test in `apps/party/test/room.test.ts`: er baut
 * mit der einen Funktion und liest mit der anderen.
 *
 * **Kein sicherer Kontext.** Der Gast erreicht den Host über `http` im privaten Netz.
 * Deshalb steht hier keine Schnittstelle, die einen verlangt — kein `crypto.randomUUID`,
 * kein `crypto.subtle`; beide sind über `http` nicht langsamer oder eingeschränkt, sondern
 * `undefined`. Diese Datei rechnet nichts aus, sie liest: das Geheimnis **erzeugt** der
 * Hostdienst in Node, wo die Frage sich nicht stellt.
 *
 * **Und sie kennt keine Leitung.** Sie liegt unter `apps/desktop/src/net/`, weil sie zum
 * Netzteil gehört, aber sie fasst keinen Sockel an — `new WebSocket` steht genau einmal
 * im Spiel, in `websocketTransport.ts`.
 */

/** Wer einen Link öffnet: der Gastgeber oder sein Gast. */
export type PartyRole = 'host' | 'guest'

/**
 * Die Wege hinter dem Rautezeichen.
 *
 * Zwei und nicht einer: der Gastgeber legt die Partie an und bekommt den Platz `p1`, der
 * Gast tritt bei und bekommt `p2`. Stünde nur ein Weg da, entschiede die Reihenfolge des
 * Eintreffens darüber, wer welche Nation spielt — und die hängt daran, wer schneller
 * geklickt hat.
 */
export const ROLE_PATHS: Readonly<Record<PartyRole, string>> = {
  guest: '/beitreten',
  host: '/gastgeben',
}

/** Was ein Link sagt: welche Rolle, welcher Raum, welches Geheimnis. */
export interface NetLink {
  role: PartyRole
  room: string
  secret: string
}

/**
 * Was hinter dem Rautezeichen steht — oder `null`, wenn dort keine Einladung steht.
 *
 * `null` ist der Normalfall und keine Störung: das Spiel startet im Einzelspieler, und
 * der Anlegedialog ist der erste Bildschirm. Eine halb gelesene Einladung — Raum ohne
 * Geheimnis, Geheimnis ohne Raum — ist ebenfalls `null` und nicht „fast": ein Beitritt,
 * der mit einem leeren Geheimnis losliefe, würde vom Hostdienst abgewiesen, und der Gast
 * suchte den Fehler bei sich.
 */
export function parseNetLink(hash: string): NetLink | null {
  const ohneRaute = hash.startsWith('#') ? hash.slice(1) : hash
  const fragezeichen = ohneRaute.indexOf('?')
  if (fragezeichen < 0) return null

  const pfad = ohneRaute.slice(0, fragezeichen)
  const rolle = (Object.keys(ROLE_PATHS) as PartyRole[]).find((role) => ROLE_PATHS[role] === pfad)
  if (!rolle) return null

  const felder = new URLSearchParams(ohneRaute.slice(fragezeichen + 1))
  const room = felder.get('raum') ?? ''
  const secret = felder.get('s') ?? ''
  if (room.length === 0 || secret.length === 0) return null

  return { role: rolle, room, secret }
}

/**
 * Die Adresse der Leitung zu diesem Raum.
 *
 * Aus `http://…` wird `ws://…`, aus `https://…` wird `wss://…` — dasselbe Schloss, dieselbe
 * Regel. Das Geheimnis reist hier **doch** mit, und das ist kein Widerspruch zu D28.10: im
 * Fragment steht es, damit es beim **Laden der Seite** nicht hinausgeht; geprüft werden
 * muss es beim Verbindungsaufbau, und dorthin muss es zwangsläufig.
 */
export function socketUrlOf(origin: string, room: string, secret: string, seat?: string): string {
  const leitung = origin.replace(/^http/, 'ws').replace(/\/+$/, '')
  const platz = seat ? `&platz=${encodeURIComponent(seat)}` : ''
  return `${leitung}/raum/${encodeURIComponent(room)}?s=${encodeURIComponent(secret)}${platz}`
}

/**
 * Der Platz, den eine Rolle verlangt (R-MP-12, T-M37-01).
 *
 * Der Gastgeber ist die erste Macht der Partiedefinition, der Gast die zweite — so baut
 * `toConfig` sie, und so sortiert `orderCommands` die Befehle. Eine zweite Übersetzung
 * zwischen „Rolle" und „Platz" wäre eine zweite Stelle, an der sich die beiden Seiten
 * uneinig werden können.
 */
export function seatOfRole(role: PartyRole): 'p1' | 'p2' {
  return role === 'host' ? 'p1' : 'p2'
}
