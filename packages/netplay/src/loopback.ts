import { decodeMessage, encodeMessage, type NetMessage } from './protocol'
import { TransportClosedError, type Transport } from './transport'

/**
 * Zwei Enden im selben Prozess (T-M37-08, D28.9).
 *
 * Das Testdoppel hinter der Transportschnittstelle: was das eine Ende sendet, bekommt das
 * andere. Damit ist der ganze schwierige Teil des Mehrspielers — Gleichschritt,
 * Reihenfolge, Prüfsummen, Pause — ohne eine einzige Leitung prüfbar, und genau darauf
 * beruht T-M37-08: zwei vollständige Simulationen laufen zweihundert Ticks gegeneinander
 * und halten dieselbe Prüfsumme.
 *
 * **Die Nachrichten gehen wirklich durch JSON.** Ein Doppel, das die Gegenstände nur
 * weiterreicht, beweist zu wenig: es verschwiege, dass etwas im Zustand steckt, was den
 * Weg über eine Leitung nicht überlebt — eine `Map`, ein `undefined`, eine Klasse. Der
 * Umweg kostet im Test nichts und ist die halbe Zusage.
 */

interface LoopbackOptions {
  /**
   * Den Umweg über JSON auslassen. Nur für Messungen, in denen die Serialisierung selbst
   * das Messobjekt verfälschen würde — im Zweifel bleibt er an.
   */
  raw?: boolean
}

class LoopbackEnd implements Transport {
  /** Wird direkt nach dem Bauen gesetzt; ohne Gegenüber gäbe es kein Doppel. */
  peer: LoopbackEnd | null = null

  private readonly listeners = new Set<(message: NetMessage) => void>()
  private readonly closeListeners = new Set<(reason: string) => void>()
  private shut = false

  constructor(private readonly options: LoopbackOptions) {}

  get closed(): boolean {
    return this.shut
  }

  send(message: NetMessage): void {
    if (this.shut) throw new TransportClosedError('dieses Ende wurde geschlossen')
    const peer = this.peer
    if (!peer || peer.closed) throw new TransportClosedError('die Gegenseite ist fort')
    peer.deliver(this.options.raw === true ? message : roundTrip(message))
  }

  onMessage(listener: (message: NetMessage) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onClose(listener: (reason: string) => void): () => void {
    this.closeListeners.add(listener)
    return () => {
      this.closeListeners.delete(listener)
    }
  }

  close(reason = 'geschlossen'): void {
    if (this.shut) return
    this.shut = true
    for (const listener of this.closeListeners) listener(reason)
    // Ein Ende zu schliessen schliesst die Verbindung: die Gegenseite erfaehrt es,
    // statt in einen Brunnen zu senden.
    this.peer?.close(reason)
  }

  private deliver(message: NetMessage): void {
    if (this.shut) return
    for (const listener of this.listeners) listener(message)
  }
}

/**
 * Der Weg über die Leitung, nachgestellt: schreiben, lesen, prüfen.
 *
 * Eine Nachricht, die den Weg nicht übersteht, ist hier ein Fehler und keine Meldung —
 * im Doppel kann sie nur aus einem Fehler im Programm stammen, und ein Fehler, der als
 * verworfene Nachricht durchgeht, kostet eine Sitzung.
 */
function roundTrip(message: NetMessage): NetMessage {
  const result = decodeMessage(encodeMessage(message))
  if (!result.ok) throw new Error(`Das Schleifendoppel hat eine unzustellbare Nachricht: ${result.reason}`)
  return result.message
}

export interface LoopbackPair {
  a: Transport
  b: Transport
}

/** Zwei verbundene Enden. Was `a` sendet, hört `b` — und umgekehrt. */
export function createLoopback(options: LoopbackOptions = {}): LoopbackPair {
  const a = new LoopbackEnd(options)
  const b = new LoopbackEnd(options)
  a.peer = b
  b.peer = a
  return { a, b }
}
