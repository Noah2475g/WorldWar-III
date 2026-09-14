import {
  TransportClosedError,
  accept,
  encodeMessage,
  type NetMessage,
  type Transport,
} from '@worldwar/netplay'

/**
 * Die einzige Stelle im Spiel, die `new WebSocket` sagt (T-M38-06, R-MP-09/AK1, D28.9).
 *
 * `packages/netplay` kennt keine Leitung — das ist der Entwurf und kein Versehen: dadurch
 * blieb der ganze schwierige Teil (Gleichschritt, Reihenfolge, Prüfsummen, Pause) in einem
 * Prozess prüfbar, bevor ein einziges Paket über ein Netz ging. Hier endet die Naht, und
 * der Netz-Wächter hat dafür genau zwei benannte Ausnahmen statt einer Lücke:
 * `apps/desktop/src/net/**` und `apps/party/**` (T-M38-04).
 *
 * **Kein sicherer Kontext.** Der Gast erreicht den Host über `http` im privaten Netz
 * (Tailscale, D28.10). Deshalb steht hier **kein** `crypto.randomUUID` und **kein**
 * `crypto.subtle`: beide verlangen einen sicheren Kontext und sind über `http` schlicht
 * nicht da — nicht langsamer, nicht eingeschränkt, sondern `undefined`. Das Geheimnis
 * erzeugt der Hostdienst in Node, wo die Frage sich nicht stellt. Ein Test hält diese
 * Zeile fest, weil sie sonst erst beim ersten echten Gast auffiele.
 *
 * **Und dieselbe Vertragsreihe wie das Schleifendoppel.** Was hier versprochen wird, steht
 * in `packages/netplay/src/transportContract.ts` und gilt für beide Umsetzungen: eine
 * Schnittstelle mit nur einer Umsetzung ist eine Vermutung (die Lehre von `StoragePort`).
 */

/**
 * So viel von `WebSocket`, wie dieser Transport benutzt.
 *
 * Absichtlich eine eigene, schmale Form und nicht der DOM-Typ: so lässt sich im Test ein
 * Doppel einsetzen, ohne jsdom eine halbe Netzwerkschicht unterzuschieben — und die
 * Vertragsreihe läuft gegen dieselbe Naht wie im Spiel.
 */
export interface SocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code?: number; reason?: string }) => void) | null
  onerror: ((event?: unknown) => void) | null
}

/** Der Zustand einer Leitung, so wie `WebSocket` ihn zählt. */
export const SOCKET_OPEN = 1

/**
 * Die Abstände zwischen zwei Verbindungsversuchen, in Millisekunden.
 *
 * Wachsend, und nicht aus Höflichkeit gegenüber dem Server: der Hostdienst läuft auf Noahs
 * Rechner, und die häufigste Ursache eines Abrisses ist, dass der Deckel zu war. Ein
 * Wiederversuch alle 50 ms hielte die Maschine wach und fände dieselbe geschlossene Tür.
 * Nach dem letzten Eintrag gibt der Transport auf und sagt es — er versucht es nicht
 * ewig weiter, denn eine Verbindung, die nach einer Minute nicht steht, kommt nicht von
 * selbst zurück (D28.8, Stufe 3: dann übernimmt der verbleibende Spieler).
 */
export const RECONNECT_BACKOFF_MS: readonly number[] = [250, 500, 1000, 2000, 4000, 8000]

export interface WebSocketTransportOptions {
  url: string
  /**
   * Wer die Leitung baut. Ohne Angabe `new WebSocket` — im Test ein Doppel.
   *
   * Die Vorgabe ist der Grund, warum diese Datei in der Ausnahmeliste des Netz-Wächters
   * steht, und sie ist die einzige Zeile darin, die das Netz wirklich anfasst.
   */
  open?: (url: string) => SocketLike
  /** Vorgabe: `RECONNECT_BACKOFF_MS`. Eine leere Liste heißt: kein Wiederversuch. */
  backoffMs?: readonly number[]
  /** Vorgabe: `setTimeout`. Hereingereicht, damit die Abstände messbar bleiben. */
  schedule?: (run: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

/** Was eine verworfene Nachricht hinterlässt (R-MP-06/AK3): nie geraten, immer gemeldet. */
export interface TransportProblem {
  reason: string
  raw: unknown
}

export interface WebSocketTransport extends Transport {
  /** Wie oft die Leitung neu aufgebaut wurde. Für die Anzeige und für die Messung. */
  readonly reconnects: number
  /** Steht die Leitung gerade? `false` heißt „es hakt", nicht „es ist vorbei". */
  readonly connected: boolean
  /** Auf verworfene Nachrichten hören — verworfen wird auch ohne Hörer. */
  onProblem(listener: (problem: TransportProblem) => void): () => void
}

const defaultOpen = (url: string): SocketLike =>
  // Die eine Zeile. Sie steht hier und nirgends sonst im Spiel (R-MP-09/AK1).
  new WebSocket(url) as unknown as SocketLike

export function createWebSocketTransport(options: WebSocketTransportOptions): WebSocketTransport {
  const open = options.open ?? defaultOpen
  const backoff = options.backoffMs ?? RECONNECT_BACKOFF_MS
  const schedule = options.schedule ?? ((run, ms) => setTimeout(run, ms))
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  const listeners = new Set<(message: NetMessage) => void>()
  const closeListeners = new Set<(reason: string) => void>()
  const problemListeners = new Set<(problem: TransportProblem) => void>()
  /**
   * Was hinaus soll, aber noch nicht konnte (T-M38-01, Vertrag).
   *
   * Zwei Gründe, und beide sind echt: die Leitung ist beim ersten `send` noch im Aufbau,
   * und nach einem Abriss wartet hier, was in der Zwischenzeit gegeben wurde. Ohne diese
   * Schlange wäre jeder Wiederaufbau ein Befehlsverlust — und im Gleichschritt ist ein
   * verlorener Befehl kein Schluckauf, sondern ein Stillstand.
   */
  const outbox: string[] = []
  /** Was ankam, bevor jemand zuhörte — dieselbe Zusage wie im Schleifendoppel. */
  const inbox: NetMessage[] = []

  let socket: SocketLike | null = null
  let shut = false
  /** Will diese Seite die Verbindung noch? Nach `close()` nicht mehr. */
  let wanted = true
  let attempt = 0
  let reconnects = 0
  let timer: unknown = null

  const report = (reason: string, raw: unknown): void => {
    for (const listener of problemListeners) listener({ reason, raw })
  }

  const finish = (reason: string): void => {
    if (shut) return
    shut = true
    wanted = false
    if (timer !== null) cancel(timer)
    timer = null
    for (const listener of closeListeners) listener(reason)
  }

  const deliver = (message: NetMessage): void => {
    if (listeners.size === 0) {
      inbox.push(message)
      return
    }
    for (const listener of listeners) listener(message)
  }

  const flush = (): void => {
    const live = socket
    if (!live || live.readyState !== SOCKET_OPEN) return
    while (outbox.length > 0) live.send(outbox.shift()!)
  }

  const connect = (): void => {
    const live = open(options.url)
    socket = live

    live.onopen = () => {
      // Ein erfolgreicher Aufbau setzt die Abstaende zurueck: die naechste Stoerung ist
      // eine neue Stoerung und nicht die Fortsetzung der alten.
      attempt = 0
      flush()
    }

    live.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        report('Die Nachricht ist kein gueltiges JSON.', raw)
        return
      }
      const result = accept(parsed)
      if (!result.ok) {
        // Verworfen und gemeldet, nie geraten (R-MP-06/AK3). Eine halb verstandene
        // Nachricht ist der kuerzeste Weg zu zwei verschiedenen Welten.
        report(result.reason, parsed)
        return
      }
      deliver(result.message)
    }

    live.onerror = () => {
      // Ein Fehler ohne Schliessung ist eine Meldung und kein Ende: der Browser feuert
      // `error` auch, wenn der Aufbau scheitert, und schickt `close` gleich hinterher.
      report('Die Verbindung hat einen Fehler gemeldet.', null)
    }

    live.onclose = (event) => {
      socket = null
      if (!wanted) {
        finish(event.reason ?? 'geschlossen')
        return
      }
      const wartezeit = backoff[attempt]
      if (wartezeit === undefined) {
        finish(event.reason && event.reason.length > 0 ? event.reason : 'Die Verbindung ist fort.')
        return
      }
      attempt += 1
      reconnects += 1
      timer = schedule(() => {
        timer = null
        if (wanted && !shut) connect()
      }, wartezeit)
    }
  }

  connect()

  return {
    get closed(): boolean {
      return shut
    },
    get connected(): boolean {
      return socket !== null && socket.readyState === SOCKET_OPEN
    },
    get reconnects(): number {
      return reconnects
    },
    send(message: NetMessage): void {
      if (shut) throw new TransportClosedError('diese Seite wurde geschlossen')
      outbox.push(encodeMessage(message))
      flush()
    },
    onMessage(listener) {
      listeners.add(listener)
      // Was wartete, bekommt der erste Hoerer — in der Reihenfolge, in der es ankam.
      const nachzureichen = inbox.splice(0, inbox.length)
      for (const message of nachzureichen) listener(message)
      return () => {
        listeners.delete(listener)
      }
    },
    onClose(listener) {
      closeListeners.add(listener)
      return () => {
        closeListeners.delete(listener)
      }
    },
    onProblem(listener) {
      problemListeners.add(listener)
      return () => {
        problemListeners.delete(listener)
      }
    },
    close(reason = 'geschlossen'): void {
      if (shut) return
      wanted = false
      const live = socket
      socket = null
      live?.close(1000, reason)
      finish(reason)
    },
  }
}
