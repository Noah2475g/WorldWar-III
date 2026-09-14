import { useCallback, useEffect, useRef, useState } from 'react'
import type { Command, GameState, PlayerId } from '@worldwar/core'
import {
  NO_PAUSE,
  parseMessage,
  type DesyncReport,
  type Lockstep,
  type LockstepStatus,
  type NetMessage,
  type PauseState,
  type Transport,
} from '@worldwar/netplay'

/**
 * Der Gleichschritt treibt die Uhr der Oberfläche (T-M37-11, R-MP-03/04/05, D28.4).
 *
 * Im Einzelspieler bestimmt `requestAnimationFrame`, wann ein Tick läuft — so viele je
 * Sekunde, wie das eingestellte Tempo sagt. **Im Spiel zu zweit bestimmt es die Freigabe:**
 * ein Tick läuft, wenn beide Befehlslisten da sind, und sonst nicht. Damit synchronisiert
 * sich das Tempo von selbst, der Langsamere gibt es vor, und die „ehrliche Uhr" aus
 * T-M22-05 bekommt einen zweiten Grund, „warte" zu sagen.
 *
 * **Kein `requestAnimationFrame`.** Nicht aus Geschmack: ein verdecktes Fenster hält rAF
 * an, und im Mehrspieler hieße das, den Mitspieler mit anzuhalten. Der Takt kommt deshalb
 * aus `setInterval` — und die feste Rate ist ohnehin nur eine Obergrenze, denn die
 * Freigabe entscheidet.
 *
 * **Die Wanduhr wird hereingereicht.** Dreißig Sekunden für einen verfallenden
 * Pausenantrag und drei für den Vorlauf des Fortsetzens sind Wanduhrzeiten; ein Haken,
 * der selbst auf die Uhr sieht, lässt sich nicht in Millisekunden prüfen.
 */

/** Die laufende Partie zu zweit, so weit die Hülle sie kennt. */
export interface NetplaySession {
  lockstep: Lockstep
  transport: Transport
  /** Der Platz dieses Bildschirms. */
  seat: PlayerId
  /** Der Platz der Gegenseite — wessen Nachricht fehlt, wenn die Uhr steht. */
  peer: PlayerId
}

/** Was die Oberfläche vom Gleichschritt wissen muss. */
export interface NetplayView {
  /** Läuft eine Partie zu zweit? Im Einzelspieler ist alles darunter unbenutzt. */
  active: boolean
  status: LockstepStatus
  tick: number
  /**
   * Steht die Uhr seit mehr als zwei Sekunden, weil eine Liste fehlt?
   *
   * Nicht „steht gerade": zwischen zwei Ticks fehlt sie immer kurz, und eine Meldung,
   * die bei jedem Tick aufblitzt, ist keine Auskunft, sondern Flackern.
   */
  waiting: boolean
  /**
   * Steht die Uhr seit mehr als zehn Sekunden? (T-M38-09, R-MP-07/AK2, D28.8, Stufe 2.)
   *
   * Der Unterschied zu `waiting` ist nicht die Dauer, sondern die **Sorte Auskunft**: bis
   * zehn Sekunden ist es ein Haken, und der Gleichschritt wartet ohnehin; danach ist es
   * ein Zustand, über den der Spieler entscheiden muss — weiter warten oder Schluss.
   */
  lost: boolean
  pause: PauseState
  desync: DesyncReport | null
  requestPause: () => void
  answerPause: (accept: boolean) => void
  resume: () => void
  /** Einen Befehl in den Gleichschritt geben. Er gilt für `tick + 2`. */
  give: (command: Command) => void
}

/** Nach so viel Stille sagt die Kopfleiste, worauf sie wartet (wie STALL_AFTER_MS in App). */
export const WAIT_NOTICE_AFTER_MS = 2000

/**
 * So oft werden unbestätigte Listen noch einmal geschickt, solange die Uhr wartet
 * (T-M38-08, R-MP-07/AK1, D28.8).
 *
 * **Wiederholen statt Wiederverbinden erkennen.** Der Haken fragt den Transport nicht, ob
 * es einen Abriss gab — er könnte es bei einem Schleifendoppel gar nicht wissen, und bei
 * einer echten Leitung wäre die Antwort eine zweite Wahrheit neben dem, was die Gegenseite
 * tatsächlich hat. Stattdessen gilt die einfachere Regel: **wer wartet, wiederholt.** Das
 * deckt den Abriss ab, die verlorene Einzelnachricht und den Fall, in dem die Verbindung
 * genau zwischen Senden und Ankommen starb — und es kostet nichts, weil erneutes Senden
 * gefahrlos ist (`Lockstep.pending`, dieselbe Liste je Tick und Platz).
 */
export const RESEND_AFTER_MS = 1000

/**
 * Nach so langer Stille ist die Gegenseite nicht mehr langsam, sondern fort
 * (T-M38-09, R-MP-07/AK2, D28.8).
 *
 * Die drei Stufen aus MEHRSPIELER.md §3.6: **es hakt** (unter zehn Sekunden — die Uhr
 * steht, die Kopfleiste sagt, worauf sie wartet, nichts geht verloren), **es ist weg**
 * (darüber — Hinweis mit zwei Knöpfen), **er kommt nicht wieder** (die Übernahme, und die
 * ist ein bewusster Klick, T-M38-10).
 */
export const PEER_LOST_AFTER_MS = 10_000

/** Wie oft der Takt nachsieht, wenn keine Rate gesetzt ist. */
const DEFAULT_BEAT_MS = 100

const IDLE: NetplayView = {
  active: false,
  status: 'waiting',
  tick: 0,
  waiting: false,
  lost: false,
  pause: NO_PAUSE,
  desync: null,
  requestPause: () => undefined,
  answerPause: () => undefined,
  resume: () => undefined,
  give: () => undefined,
}

interface Snapshot {
  status: LockstepStatus
  tick: number
  waiting: boolean
  lost: boolean
  pause: PauseState
  desync: DesyncReport | null
}

export interface NetplayOptions {
  /** `null` im Einzelspieler — dann tut der Haken nichts und die alte Schleife bleibt. */
  session: NetplaySession | null
  /** Die feste Rate in Spielstunden je Sekunde; sie deckelt den Takt, mehr nicht. */
  speed: number
  /**
   * Ein gerechneter Tick: die Hülle schreibt den Stand fort.
   *
   * `applied` sind die Befehle, die dieser Tick angewandt hat — die Hülle nimmt daran die
   * Quittung vom Knopf (T-M22-05), sobald der Befehl wirklich gewirkt hat und nicht schon
   * beim nächsten Tick.
   */
  onTick: (state: GameState, applied: readonly Command[]) => void
  /** Die Wanduhr, für die Fristen der Pause. */
  now?: () => number
}

export function useNetplay(options: NetplayOptions): NetplayView {
  const { session, speed, onTick } = options
  const now = options.now ?? Date.now

  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'waiting',
    tick: session?.lockstep.tick ?? 0,
    waiting: false,
    lost: false,
    pause: NO_PAUSE,
    desync: null,
  })

  // Über Refs, nicht über Abhängigkeiten: der Takt darf nicht bei jedem Tick neu
  // gebunden werden — genau daran hing bis T-M41-04 die Uhr des Einzelspielers, deren
  // Effekt sich bei jedem Zustandswechsel neu aufsetzte und dabei Ticks verlor.
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick
  const nowRef = useRef(now)
  nowRef.current = now
  /** Für welchen Tick die eigene Nachricht schon hinaus ist. */
  const emittedFor = useRef<number | null>(null)
  /** Wann zuletzt wirklich gerechnet wurde — für „warte auf Mitspieler". */
  const lastTickAt = useRef(0)
  /** Wann zuletzt nachgeliefert wurde (T-M38-08) — nicht bei jedem Schlag. */
  const lastResendAt = useRef(0)

  const send = useCallback(
    (message: NetMessage) => {
      if (!session || session.transport.closed) return
      session.transport.send(message)
    },
    [session],
  )

  /** Eine eingehende Nachricht einsortieren — geprüft, nie geraten (D28.9). */
  useEffect(() => {
    if (!session) return
    const ab = session.transport.onMessage((message) => {
      const geprueft = parseMessage(message)
      if (!geprueft.ok) return
      const gueltig = geprueft.message
      if (gueltig.kind === 'befehle') session.lockstep.receive(session.peer, gueltig)
      else if (gueltig.kind === 'pause') session.lockstep.receivePause(session.peer, gueltig, nowRef.current())
      else if (gueltig.kind === 'ende') session.lockstep.receiveEnd(session.peer, gueltig)
    })
    return ab
  }, [session])

  /**
   * Der Takt. Er schickt, was zu schicken ist, und rechnet, was freigegeben ist — in
   * dieser Reihenfolge, damit die Gegenseite nicht auf eine Nachricht wartet, die erst
   * beim nächsten Schlag hinausginge.
   */
  useEffect(() => {
    if (!session) return
    const { lockstep } = session
    emittedFor.current = null
    lastTickAt.current = nowRef.current()
    lastResendAt.current = nowRef.current()

    const schicken = (): void => {
      if (emittedFor.current === lockstep.tick) return
      emittedFor.current = lockstep.tick
      send(lockstep.emit())
    }

    /**
     * Ein Auseinanderlaufen wird EINMAL angesagt (R-MP-04/AK1).
     *
     * Wer es zuerst merkt, hoert auf zu rechnen und damit auch auf zu senden — ohne diese
     * Nachricht bliebe die Gegenseite bei „warte auf Mitspieler" stehen und erfuehre nie,
     * was geschehen ist.
     */
    let angesagt = false
    const ansagen = (): void => {
      if (angesagt || !lockstep.desync) return
      angesagt = true
      send(lockstep.endMessage())
    }

    const schlag = (): void => {
      const jetzt = nowRef.current()
      lockstep.pollClock(jetzt)

      if (lockstep.status === 'desynced') ansagen()

      if (lockstep.status !== 'desynced' && lockstep.status !== 'finished') {
        schicken()
        // Wer wartet, wiederholt (T-M38-08). Nach einem Abriss ist die Rueckkehr damit ein
        // Nachliefern und kein Neuanfang - und der Fall, in dem die Leitung genau zwischen
        // Senden und Ankommen starb, heilt von selbst.
        if (
          lockstep.status === 'waiting' &&
          jetzt - lastTickAt.current > RESEND_AFTER_MS &&
          jetzt - lastResendAt.current >= RESEND_AFTER_MS
        ) {
          lastResendAt.current = jetzt
          for (const message of lockstep.pending()) send(message)
        }
        if (lockstep.canStep()) {
          const ergebnis = lockstep.step()
          if (!ergebnis.ran) ansagen()
          if (ergebnis.ran) {
            lastTickAt.current = jetzt
            onTickRef.current(lockstep.state, ergebnis.applied)
            // Sofort die naechste Nachricht, nicht erst beim naechsten Schlag: sonst
            // kostete jeder Tick einen ganzen Takt mehr, als er muss.
            schicken()
          }
        }
      }

      setSnapshot((alt) => {
        const stille = jetzt - lastTickAt.current
        const neu: Snapshot = {
          status: lockstep.status,
          tick: lockstep.tick,
          waiting: lockstep.status === 'waiting' && stille > WAIT_NOTICE_AFTER_MS,
          // „Es ist weg" statt „es hakt" (T-M38-09): dieselbe Lage, eine andere Auskunft.
          lost: lockstep.status === 'waiting' && stille > PEER_LOST_AFTER_MS,
          pause: lockstep.pause,
          desync: lockstep.desync,
        }
        const gleich =
          alt.status === neu.status &&
          alt.tick === neu.tick &&
          alt.waiting === neu.waiting &&
          alt.lost === neu.lost &&
          alt.pause === neu.pause &&
          alt.desync === neu.desync
        return gleich ? alt : neu
      })
    }

    // Die feste Rate deckelt den Takt; ohne Rate sieht er zehnmal je Sekunde nach, damit
    // eine verabredete Pause und ein verfallener Antrag nicht liegen bleiben.
    const abstand = speed > 0 ? Math.max(1, Math.round(1000 / speed)) : DEFAULT_BEAT_MS
    schlag()
    const id = setInterval(schlag, abstand)
    return () => clearInterval(id)
  }, [session, speed, send])

  const requestPause = useCallback(() => {
    if (session) send(session.lockstep.requestPause(nowRef.current()))
  }, [session, send])

  const answerPause = useCallback(
    (accept: boolean) => {
      if (session) send(session.lockstep.answerPause(accept, nowRef.current()))
    },
    [session, send],
  )

  const resume = useCallback(() => {
    if (session) send(session.lockstep.resume(nowRef.current()))
  }, [session, send])

  const give = useCallback(
    (command: Command) => {
      session?.lockstep.give(command)
    },
    [session],
  )

  if (!session) return IDLE

  return {
    active: true,
    status: snapshot.status,
    tick: snapshot.tick,
    waiting: snapshot.waiting,
    lost: snapshot.lost,
    pause: snapshot.pause,
    desync: snapshot.desync,
    requestPause,
    answerPause,
    resume,
    give,
  }
}
