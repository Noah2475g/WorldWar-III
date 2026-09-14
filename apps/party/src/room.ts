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
 */

/** Die zwei Plätze eines Raumes. Mehr als zwei Menschen sind ausgeschlossen (§6). */
export const SEATS = ['p1', 'p2'] as const

export type SeatId = (typeof SEATS)[number]

/** Was der Raum von einer Verbindung braucht — mehr nicht. */
export interface Connection {
  send(data: string): void
  close(reason: string): void
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
   * Einen Platz geben — den ersten freien, in fester Reihenfolge.
   *
   * **Fest und nicht zufällig:** der Platz ist die Kennung, mit der die Oberfläche alles
   * betrachtet (`viewerId`, T-M37-01), und er steht in `playerOrder`, nach der beide Seiten
   * die Befehle sortieren (T-M37-07). Ein Raum, der Plätze durcheinander vergäbe, würde
   * dieselbe Partie auf zwei Rechnern verschieden sortieren lassen.
   */
  join(connection: Connection, name = ''): JoinResult {
    const frei = SEATS.find((seat) => !this.occupants.has(seat))
    if (!frei) {
      // Abgewiesen wird mit einer Erklaerung und nicht mit einem stillen Abbruch: eine
      // Verbindung, die ohne Grund endet, sieht fuer den Gast aus wie ein Fehler im Netz.
      connection.close(ROOM_FULL)
      return { ok: false, reason: ROOM_FULL }
    }
    this.occupants.set(frei, { seat: frei, connection, name })
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

  get count(): number {
    return this.rooms.size
  }

  of(id: string): Room {
    const vorhanden = this.rooms.get(id)
    if (vorhanden) return vorhanden
    const neu = new Room(id)
    this.rooms.set(id, neu)
    return neu
  }

  /** Einen Raum vergessen, sobald niemand mehr darin sitzt. */
  forgetIfEmpty(id: string): void {
    const raum = this.rooms.get(id)
    if (raum?.empty) this.rooms.delete(id)
  }

  closeAll(reason: string): void {
    for (const raum of this.rooms.values()) raum.closeAll(reason)
    this.rooms.clear()
  }
}
