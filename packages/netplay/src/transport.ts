import type { NetMessage } from './protocol'

/**
 * Die Naht zwischen Gleichschritt und Leitung (T-M37-05, D28.9).
 *
 * Drei Funktionen — senden, empfangen, schließen. Dahinter steht im Test ein Doppel im
 * selben Prozess (`loopback.ts`) und im Spiel später eine echte Verbindung. **Hier steht
 * keine**: dieses Paket kennt kein Netz, und genau deshalb ist der ganze schwierige Teil
 * ohne eine Leitung prüfbar.
 *
 * Die vollständige Vertragstestreihe, die jede Umsetzung erfüllen muss, baut T-M38-01;
 * sie läuft dann gegen das Doppel **und** gegen die echte Verbindung. Muster dafür ist
 * `StoragePort` aus M8, dessen gleiche Zusage erst in M16 eingelöst wurde — und dessen
 * Lehre lautet: eine Schnittstelle ohne zweite Umsetzung ist eine Vermutung.
 */
export interface Transport {
  /** Eine Nachricht an die Gegenseite. Nach dem Schließen ein Fehler, nicht ein Nichts. */
  send(message: NetMessage): void
  /**
   * Auf Nachrichten hören. Der Rückgabewert meldet den Hörer wieder ab — ein Hörer, den
   * niemand abmelden kann, überlebt die Partie, an der er hängt.
   */
  onMessage(listener: (message: NetMessage) => void): () => void
  /** Auf das Ende der Verbindung hören, gleich von welcher Seite es kommt. */
  onClose(listener: (reason: string) => void): () => void
  /** Schließen. Zweimal schließen ist erlaubt und tut beim zweiten Mal nichts. */
  close(reason?: string): void
  /** Ist die Verbindung zu? Eine Frage, die eine Zustandsmaschine stellen können muss. */
  readonly closed: boolean
}

/** Der Fehler, den ein geschlossener Transport wirft, statt still zu schlucken. */
export class TransportClosedError extends Error {
  constructor(reason: string) {
    super(`Die Verbindung ist geschlossen (${reason}) — es geht nichts mehr hinaus.`)
    this.name = 'TransportClosedError'
  }
}
