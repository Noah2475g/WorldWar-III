import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Ein Raum, zwei Plätze, kein Schiedsrichter (T-M38-07, R-MP-11, D28.10).
 *
 * Der Hostdienst ist **Briefträger und Dateiserver, sonst nichts**. Er kennt keine Regel,
 * keinen Spielstand und keinen Tick; er weiß, wer auf welchem Platz sitzt, und gibt weiter,
 * was ankommt — **unverändert**, ohne die Nachricht auch nur zu lesen.
 *
 * Das ist keine Sparsamkeit, sondern der Entwurf (D28.2): beim Gleichschritt rechnen beide
 * Seiten die ganze Partie selbst. Ein Dienst, der mitrechnete, wäre eine dritte Meinung
 * darüber, was gerade gilt — und die erste, die von den beiden anderen abweicht, ohne dass
 * jemand sie fragen könnte. Deshalb steht hier `string` und nicht `NetMessage`: was der
 * Raum nicht auspackt, kann er nicht falsch verstehen.
 *
 * Und deshalb ist diese Datei **ohne Netz**: sie kennt Plätze und Verbindungen, keine
 * Sockel. Der Netzteil steht in `server.ts`.
 *
 * **Seit T-M39-01 hat ein Raum ein Geheimnis** (R-MP-10, D28.10). Bis dahin war er über
 * seine blosse Kennung erreichbar — im privaten Tailnet ausreichend, als Einladung zu
 * wenig: eine Kennung, die einmal in einer Nachricht stand, ist keine Zugangsbedingung.
 * Das Geheimnis entsteht **hier**, in Node, und nicht im Browser: dort gäbe es über `http`
 * ohne sicheren Kontext keine brauchbare Quelle dafür (`crypto.randomUUID` und
 * `crypto.subtle` sind schlicht `undefined`), und `Math.random` ist keine.
 */

/** Die zwei Plätze eines Raumes. Mehr als zwei Menschen sind ausgeschlossen (§6). */
export const SEATS = ['p1', 'p2'] as const

export type SeatId = (typeof SEATS)[number]

/**
 * Wie viele Zufallsbytes das Geheimnis eines Raumes trägt.
 *
 * Sechzehn Bytes sind 128 Bit und als `base64url` 22 Zeichen — kurz genug für einen Link,
 * den man in einen Chat klebt, und weit jenseits dessen, was jemand raten könnte. Der
 * Vergleich unten prüft trotzdem in fester Zeit; nicht weil hier ein Angreifer mit einer
 * Stoppuhr sässe, sondern weil der teure Weg (`===`) und der billige gleich viel kosten.
 */
export const SECRET_BYTES = 16

/** Und so viele die Kennung: sie ist eine Adresse, kein Schutz. */
export const ROOM_ID_BYTES = 6

/**
 * Ein Geheimnis aus dem Zufallsgenerator des Betriebssystems.
 *
 * `base64url` und nicht `base64`: die Zeichen `+`, `/` und `=` müssten in einer Adresse
 * kodiert werden, und ein Link, den der Empfänger von Hand zusammensetzen muss, ist keiner.
 */
export function createSecret(bytes: number = SECRET_BYTES): string {
  return randomBytes(bytes).toString('base64url')
}

/** Eine Raumkennung — kurz, adressierbar, und ohne Bedeutung. */
export function createRoomId(bytes: number = ROOM_ID_BYTES): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Stimmt ein Geheimnis? Der Vergleich läuft in fester Zeit.
 *
 * `timingSafeEqual` verlangt gleiche Länge und wirft sonst — deshalb die Längenprüfung
 * davor, und deshalb steht sie zuerst: eine geworfene Ausnahme im Verbindungsaufbau wäre
 * ein Dienst, den eine falsche Adresse abschiesst.
 */
export function secretMatches(expected: string, given: string): boolean {
  if (expected.length === 0 || expected.length !== given.length) return false
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(given, 'utf8'))
}

/** Wer einen Link öffnet: der Gastgeber oder sein Gast. */
export type PartyRole = 'host' | 'guest'

/** Die Wege hinter dem Rautezeichen — beide Seiten derselben Partie. */
export const ROLE_PATHS: Readonly<Record<PartyRole, string>> = {
  guest: '/beitreten',
  host: '/gastgeben',
}

/** Was ein Raum ist, sobald jemand ihn eröffnet hat: eine Adresse und ein Geheimnis. */
export interface Invitation {
  id: string
  secret: string
}

/**
 * Der Link, und mehr muss Noah nicht verschicken (R-MP-10/AK1, MEHRSPIELER.md §3.7).
 *
 * ```
 * http://<rechner>.<tailnet>.ts.net:7749/#/beitreten?raum=<id>&s=<geheimnis>
 * ```
 *
 * **Das Geheimnis steht hinter dem Rautezeichen.** Was dort steht, schickt der Browser
 * beim Laden der Seite **nicht** an den Server: das Fragment bleibt im Browser, es steht
 * in keiner Anfragezeile und damit in keinem Zugriffsprotokoll. Geprüft wird es erst beim
 * Verbindungsaufbau der Partie, wo es zwangsläufig über die Leitung muss.
 *
 * **Der Link ist kurz**, weil der Host die Partiedefinition ohnehin kennt; sie muss nicht
 * mitreisen. Gebaut wird er an genau dieser Stelle, damit das Format **einmal** existiert
 * — die Gegenseite (`apps/desktop/src/net/link.ts`) liest es, und ein Rundlauf-Test hält
 * beide zusammen.
 */
export function inviteLink(origin: string, invitation: Invitation, role: PartyRole = 'guest'): string {
  const ohneSchraegstrich = origin.replace(/\/+$/, '')
  const raum = encodeURIComponent(invitation.id)
  const geheimnis = encodeURIComponent(invitation.secret)
  return `${ohneSchraegstrich}/#${ROLE_PATHS[role]}?raum=${raum}&s=${geheimnis}`
}

/**
 * Der Schliesscode einer **Abweisung** (T-M39-01).
 *
 * Aus dem privaten Bereich von RFC 6455 (4000–4999), und er hat eine Aufgabe: der
 * Transport im Browser baut eine abgerissene Leitung mit wachsendem Abstand wieder auf
 * (T-M38-06). Bei einem falschen Geheimnis oder einem vollen Raum wäre das sechsmal
 * dieselbe verschlossene Tür und sechzehn Sekunden, in denen der Gast nicht erfährt, was
 * los ist. Ein Code über 4000 heisst deshalb: **nicht wiederversuchen, das ist kein
 * Netzfehler, sondern eine Antwort.**
 */
export const REFUSED_CLOSE_CODE = 4001

/** Was der Raum von einer Verbindung braucht — mehr nicht. */
export interface Connection {
  send(data: string): void
  /** `code` folgt RFC 6455; ohne Angabe ein ordentliches Ende (1000). */
  close(reason: string, code?: number): void
}

export interface Occupant {
  seat: SeatId
  connection: Connection
  /** Der Name, den der Gast im Beitritt genannt hat. Nur zur Anzeige beim Host (M39). */
  name: string
}

export type JoinResult =
  | { ok: true; seat: SeatId }
  | { ok: false; reason: string }

/** Warum ein dritter abgewiesen wird. Ein Satz für einen Menschen, keine Kennung. */
export const ROOM_FULL = 'Dieser Raum ist voll: er hat zwei Plaetze, und beide sind besetzt.'

/** Warum ein Link ohne gültiges Geheimnis nichts öffnet (R-MP-10/AK2). */
export const WRONG_SECRET =
  'Dieser Link passt zu keiner Partie auf diesem Rechner. Bitte den Gastgeber um einen neuen.'

/** Warum ein bestimmter Platz nicht zu haben ist. */
export const SEAT_TAKEN = 'Dieser Platz ist besetzt.'

/** Was ein Beitritt mitbringt. Alles daran ist freiwillig — der Raum ergänzt den Rest. */
export interface JoinRequest {
  /** Der Name, den der Gast genannt hat. Er erreicht den Host über `hallo`, nicht hierüber. */
  name?: string
  /**
   * Der gewünschte Platz — `p1` für den Gastgeber, `p2` für den Gast.
   *
   * **Nicht die Reihenfolge des Eintreffens.** Der Platz ist die Kennung, mit der die
   * Oberfläche alles betrachtet (`viewerId`, T-M37-01), und er steht in `playerOrder`,
   * nach der beide Seiten die Befehle sortieren (T-M37-07). Wer ihn dem Zufall überliesse,
   * liesse ihn davon abhängen, wer schneller geklickt hat: der Gast bekäme die Nation des
   * Gastgebers, und die Partie liefe mit vertauschten Rollen an.
   */
  seat?: SeatId
}

export class Room {
  readonly id: string
  private readonly occupants = new Map<SeatId, Occupant>()

  constructor(id: string) {
    this.id = id
  }

  /** Wer gerade sitzt, in der Reihenfolge der Plätze. */
  get seated(): readonly Occupant[] {
    return SEATS.map((seat) => this.occupants.get(seat)).filter((o): o is Occupant => o !== undefined)
  }

  get full(): boolean {
    return this.occupants.size >= SEATS.length
  }

  get empty(): boolean {
    return this.occupants.size === 0
  }

  /**
   * Einen Platz geben — den gewünschten, sonst den ersten freien.
   *
   * **Fest und nicht zufällig:** der Platz ist die Kennung, mit der die Oberfläche alles
   * betrachtet (`viewerId`, T-M37-01), und er steht in `playerOrder`, nach der beide Seiten
   * die Befehle sortieren (T-M37-07). Ein Raum, der Plätze durcheinander vergäbe, würde
   * dieselbe Partie auf zwei Rechnern verschieden sortieren lassen.
   *
   * Seit T-M39-01 darf eine Seite ihren Platz **nennen**: der Gastgeber kommt über
   * `#/gastgeben` und will `p1`, der Gast über `#/beitreten` und will `p2`. Ohne diesen
   * Wunsch bleibt es beim ersten freien — das ist der Weg, den M38 gegangen ist, und der
   * Raum vergisst ihn nicht.
   */
  join(connection: Connection, request: JoinRequest = {}): JoinResult {
    const gewuenscht = request.seat
    if (gewuenscht && this.occupants.has(gewuenscht)) {
      connection.close(SEAT_TAKEN, REFUSED_CLOSE_CODE)
      return { ok: false, reason: SEAT_TAKEN }
    }
    const frei = gewuenscht ?? SEATS.find((seat) => !this.occupants.has(seat))
    if (!frei) {
      // Abgewiesen wird mit einer Erklaerung und nicht mit einem stillen Abbruch: eine
      // Verbindung, die ohne Grund endet, sieht fuer den Gast aus wie ein Fehler im Netz.
      connection.close(ROOM_FULL, REFUSED_CLOSE_CODE)
      return { ok: false, reason: ROOM_FULL }
    }
    this.occupants.set(frei, { seat: frei, connection, name: request.name ?? '' })
    return { ok: true, seat: frei }
  }

  /** Einen Platz räumen. Zweimal räumen ist erlaubt und tut beim zweiten Mal nichts. */
  leave(seat: SeatId): void {
    this.occupants.delete(seat)
  }

  /**
   * Weitergeben, was ankam — **unverändert** und nur an den anderen Platz.
   *
   * Nicht an alle: eine Nachricht, die zum Absender zurückkäme, träfe im Gleichschritt auf
   * eine Maschine, die ihre eigene Liste schon hat, und zählte als zweite Freigabe
   * desselben Ticks.
   */
  relay(from: SeatId, data: string): SeatId[] {
    const erreicht: SeatId[] = []
    for (const occupant of this.seated) {
      if (occupant.seat === from) continue
      occupant.connection.send(data)
      erreicht.push(occupant.seat)
    }
    return erreicht
  }

  /** Alle hinauswerfen — beim Herunterfahren des Dienstes. */
  closeAll(reason: string): void {
    for (const occupant of this.seated) occupant.connection.close(reason)
    this.occupants.clear()
  }
}

/**
 * Die Räume des Dienstes. Ein leerer Raum verschwindet.
 *
 * **Kein Zustand über die Partie hinaus** (§6: „Wiederverbinden über eine neue Adresse"
 * wird ausdrücklich nicht gebaut). Was der Dienst hält, ist wer gerade sitzt — sonst
 * nichts, und nach dem letzten Abgang nicht einmal das.
 */
export class Rooms {
  private readonly rooms = new Map<string, Room>()
  /**
   * Die eröffneten Räume: Kennung zu Geheimnis (T-M39-01).
   *
   * **Getrennt von den Räumen selbst, und das ist der Punkt.** Ein Raum verschwindet,
   * sobald niemand mehr darin sitzt (§6: kein Zustand über die Partie hinaus) — die
   * Einladung darf das nicht, sonst wäre der Link tot, sobald beide Seiten für zehn
   * Sekunden die Verbindung verlieren. Was hier steht, ist eine Adresse und ein
   * Geheimnis; was im Raum steht, ist, wer gerade sitzt.
   */
  private readonly invited = new Map<string, string>()

  get count(): number {
    return this.rooms.size
  }

  /**
   * Einen Raum eröffnen — die einzige Stelle, an der eine Partie adressierbar wird.
   *
   * Ohne Angaben entstehen Kennung und Geheimnis hier, in Node (D28.10). Mit Angaben ist
   * es der Weg für einen Test, der eine feste Adresse braucht.
   */
  open(id: string = createRoomId(), secret: string = createSecret()): Invitation {
    this.invited.set(id, secret)
    return { id, secret }
  }

  /** Die eröffneten Räume, in der Reihenfolge ihrer Eröffnung. */
  get invitations(): readonly Invitation[] {
    return [...this.invited].map(([id, secret]) => ({ id, secret }))
  }

  /**
   * Darf jemand mit diesem Geheimnis in diesen Raum (R-MP-10/AK2)?
   *
   * Ein Raum, den dieser Dienst nie eröffnet hat, sagt **nein** — und zwar auf demselben
   * Weg wie ein falsches Geheimnis. Wer eine unbekannte Kennung anders beantwortet als ein
   * falsches Geheimnis, verrät, welche Kennungen es gibt.
   */
  admits(id: string, secret: string): boolean {
    const erwartet = this.invited.get(id)
    return erwartet !== undefined && secretMatches(erwartet, secret)
  }

  of(id: string): Room {
    const vorhanden = this.rooms.get(id)
    if (vorhanden) return vorhanden
    const neu = new Room(id)
    this.rooms.set(id, neu)
    return neu
  }

  /** Den Raum ansehen, ohne ihn anzulegen — `null`, wenn gerade niemand darin sitzt. */
  at(id: string): Room | null {
    return this.rooms.get(id) ?? null
  }

  /** Einen Raum vergessen, sobald niemand mehr darin sitzt. Die Einladung bleibt. */
  forgetIfEmpty(id: string): void {
    const raum = this.rooms.get(id)
    if (raum?.empty) this.rooms.delete(id)
  }

  closeAll(reason: string): void {
    for (const raum of this.rooms.values()) raum.closeAll(reason)
    this.rooms.clear()
    this.invited.clear()
  }
}
