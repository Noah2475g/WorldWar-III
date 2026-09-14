import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createInitialState, type GameConfig, type GameState, type MapData, type PlayerId, type Rules } from '@worldwar/core'
import {
  PROBE_TICKS,
  acceptState,
  compareFingerprints,
  createLockstep,
  envelope,
  fingerprintOf,
  fingerprintOfWelcome,
  hello,
  probeMessage,
  resumeDecision,
  runProbeFrom,
  stateMessage,
  welcome,
  type NetMessage,
  type ProbeMessage,
  type ProbeOutcome,
  type Transport,
  type WelcomeMessage,
} from '@worldwar/netplay'
import type { NetplaySession } from './useNetplay.ts'
import { seatOfRole, seatsOfRole, socketUrlOf, type NetLink, type PartyRole } from './link.ts'

/**
 * Vom Link zur laufenden Partie (T-M39-02, T-M39-03, R-MP-10/11/12, D28.10).
 *
 * Zwischen „jemand hat einen Link geöffnet" und „der Gleichschritt treibt die Uhr" liegen
 * fünf Nachrichten, und dieser Haken ist die Stelle, an der sie in einer Reihenfolge
 * stehen. Danach übernimmt `useNetplay`, und dieses Modul schweigt.
 *
 * ```
 * Gast verbindet          -> hallo (ohne Namen)      die Anmeldung, und die Fassungspruefung
 * Host antwortet          -> willkommen              die Bedingungen: Karte, Nationen, Rate
 * Gast liest, traegt ein  -> hallo (mit Namen)       jetzt sieht der Host, wer wartet
 * Host startet            -> probe                   der Determinismus-Handschlag
 * Gast antwortet          -> probe                   beide vergleichen, dann laeuft es
 * ```
 *
 * **Warum `willkommen` vor dem benannten `hallo` steht.** §3.2 führt `hallo` als erste Art
 * auf, und so ist es auch: die **Anmeldung** kommt zuerst, sie trägt die Protokollfassung,
 * und ohne sie beginnt nichts. Der **Name** kommt später, weil §3.7 es so verlangt: „der
 * Beitrittsbildschirm zeigt, worauf man sich einlässt, bevor irgendetwas passiert. Dann
 * Name eintragen und beitreten." Die Bedingungen kennt nur der Host — also muss er sie
 * geschickt haben, bevor der Gast seinen Namen nennt. Die Alternative wäre, die Einladung
 * im Hostdienst abzulegen; dann wäre er nicht mehr Briefträger, sondern hielte Partiedaten
 * (D28.2). Der Entscheid steht in `DECISIONS.md`.
 *
 * **Kein `new WebSocket` in dieser Datei.** Die Leitung wird hereingereicht (`connect`) —
 * im Test ein Schleifendoppel, im Spiel `websocketTransport.ts`, und das ist die einzige
 * Stelle im ganzen Haus, die eine Leitung baut (R-MP-09/AK1).
 *
 * **Und kein sicherer Kontext.** Der Gast kommt über `http` im privaten Netz; deshalb steht
 * hier weder `crypto.randomUUID` noch `crypto.subtle`. Das Geheimnis erzeugt der Hostdienst
 * in Node (D28.10) — hier wird es nur weitergereicht.
 */

/** Wo eine Partie zu zweit gerade steht. */
export type PartyPhase =
  /** Kein Link im Fragment — das Spiel ist ein Einzelspieler wie immer. */
  | 'idle'
  /** Die Leitung steht (oder baut sich auf); gewartet wird auf den jeweils anderen. */
  | 'lobby'
  /** Der Handschlag läuft: beide rechnen ihre Probe und vergleichen. */
  | 'checking'
  /** Der Gleichschritt hat übernommen. */
  | 'playing'
  /** Abgewiesen oder abgebrochen — mit einem Grund, nie ohne. */
  | 'refused'

/**
 * Was der Gast vor dem Beitritt sieht (R-MP-12/AK1).
 *
 * Dieselben sechs Angaben wie die Einladung im Anlegedialog (`newGame.ts`), aber aus der
 * **Partiedefinition des Hosts** gerechnet und nicht aus einem Formular: der Gast hat kein
 * Formular, und eine zweite Rechnung wäre eine zweite Wahrheit.
 */
export interface PartyTerms {
  mapId: string
  /** Die Nation des Gastes — der Platz, auf dem er sitzt. */
  ownNation: string
  /** Die Nation des Gastgebers. */
  hostNation: string
  aiOpponents: number
  victory: 'points' | 'conquest'
  fixedSpeed: number
}

/** Der Anfang einer Partie: der Stand, aus dem beide Seiten losrechnen. */
export interface PartyStart {
  state: GameState
  mapId: string
  fixedSpeed: number
  seat: PlayerId
}

export interface PartyView {
  /** `false`, solange kein Link im Fragment stand — dann ist alles darunter unbenutzt. */
  active: boolean
  role: PartyRole
  phase: PartyPhase
  /** Der eigene Platz: `p1` für den Gastgeber, `p2` für den Gast. */
  seat: PlayerId
  /** Die Bedingungen der Partie — beim Gast erst, wenn der Host sie geschickt hat. */
  terms: PartyTerms | null
  /**
   * Der Name auf dem Gastplatz, so weit **diese** Seite ihn kennt.
   *
   * Beim Gastgeber: was der Gast in `hallo` genannt hat. Beim Gast: was er selbst
   * eingetragen hat — und damit zugleich die Antwort auf „bin ich schon beigetreten?".
   *
   * `null` heißt „niemand da", die **leere Zeichenkette** heißt „da, aber noch ohne
   * Namen". Der Unterschied ist der halbe Zweck dieses Bildschirms: der Gastgeber soll
   * sehen, dass jemand den Link geöffnet hat, bevor derjenige getippt hat.
   */
  guestName: string | null
  /** Hat der Gastgeber die Partie schon angelegt? Erst dann kann der Gast die Bedingungen sehen. */
  offered: boolean
  /** Warum es nicht weitergeht. `null`, solange nichts schiefgegangen ist. */
  reason: string | null
  /** Die laufende Partie — erst in `playing`. */
  session: NetplaySession | null
  /** Der Stand, mit dem die Hülle loslegt — einmal gesetzt, wenn `playing` beginnt. */
  start: PartyStart | null
  /**
   * Der Gastgeber legt die Partie an (T-M39-03) — oder setzt eine gespeicherte fort.
   *
   * `resume` ist der geladene Stand; ohne ihn beginnt die Partie beim Anfang. Er ist die
   * einzige Stelle, an der ein Zustand über die Leitung geht (D28.11), und auch das nur,
   * wenn der Gast einen anderen hat.
   */
  offer: (config: GameConfig, fixedSpeed: number, resume?: GameState | null) => void
  /** Der Gast nennt seinen Namen und tritt bei (T-M39-02). */
  join: (name: string) => void
  /** Der Gastgeber startet — erst das löst den Handschlag aus (R-MP-12/AK2). */
  begin: () => void
  /** Gehen. Die Gegenseite erfährt es, statt auf jemanden zu warten, der weg ist. */
  leave: () => void
}

export interface PartyOptions {
  /** Was im Fragment stand — `null` im Einzelspieler. */
  link: NetLink | null
  /**
   * Wie eine Leitung entsteht. `null` heißt: dieser Bau kennt den Mehrspieler nicht.
   *
   * Das ist der ausgelieferte Tauri-Bau (Bauflagge `WORLDWAR_MULTIPLAYER`, T-M39-04): dort
   * schneidet Rollup den Einstieg heraus, und im Erzeugnis steht kein `WebSocket`.
   */
  connect: ((url: string) => Transport) | null
  /** Der Ursprung, unter dem die Seite geladen wurde — daraus wird die Adresse der Leitung. */
  origin: string
  mapById: (id: string) => MapData
  rules: Rules
  /**
   * Der eigene gespeicherte Stand, falls es einen gibt (T-M39-06, R-MP-13/AK1).
   *
   * Beim Gast ist das die Hälfte des Vergleichs: stimmt er mit dem des Gastgebers
   * überein, geht es weiter, und **nichts** geht über die Leitung. `null` heißt „ich habe
   * keinen" — dann rechnet der Gast vom frischen Startzustand, und der Unterschied fällt
   * dem Gastgeber auf, wie jeder andere auch.
   */
  savedState?: GameState | null
}

/** Was der Gast aus der Partiedefinition des Hosts liest (R-MP-12/AK1). */
export function termsOf(message: WelcomeMessage): PartyTerms {
  const spieler = message.config.players
  const eigener = spieler.findIndex((_, index) => `p${index + 1}` === message.seat)
  const host = spieler[0]
  return {
    mapId: message.config.mapId,
    ownNation: spieler[eigener]?.nation ?? '',
    hostNation: host?.nation ?? '',
    aiOpponents: spieler.filter((player) => player.kind === 'ai').length,
    victory: message.config.victory.condition === 'conquest' ? 'conquest' : 'points',
    fixedSpeed: message.fixedSpeed,
  }
}

/**
 * Die Partiedefinition eines gespeicherten Standes (T-M39-06, R-MP-13, D28.11).
 *
 * Zum Fortsetzen braucht der Gast beides: die **Bedingungen** (Karte, Nationen, Rate —
 * sie stehen in `willkommen` und damit in einer `GameConfig`) und den **Stand** selbst.
 * Ein geladener Spielstand trägt keine Partiedefinition mit sich; er trägt aber alles,
 * woraus sie besteht. Die Felder werden deshalb hier zurückgelesen, statt den Zustand um
 * eine zweite Wahrheit zu erweitern — der Kern wird nicht angefasst (D28.1).
 *
 * **Sie erzeugt nicht denselben Zustand wieder.** Wer `createInitialState` damit aufruft,
 * bekommt den Anfang der Partie und nicht ihren dreißigsten Tag; der Stand selbst geht als
 * `zustand` über die Leitung. Diese Definition ist für die **Anzeige** und für den
 * Handschlag da.
 */
export function configOfState(state: GameState): GameConfig {
  return {
    seed: state.seed,
    mapId: state.mapId,
    rulesId: state.rulesId,
    players: state.playerOrder.map((id) => {
      const player = state.players[id]!
      return {
        name: player.name,
        kind: player.kind,
        nation: player.nation,
        color: player.color,
        ...(player.difficulty ? { difficulty: player.difficulty } : {}),
      }
    }),
    victory: {
      condition: state.victory.condition,
      pointsShareToWin: state.victory.pointsShareToWin,
      dayLimit: state.victory.dayLimit,
    },
  }
}

/** Die Plätze, die je Tick eine Nachricht schicken — die menschlichen, in Zustandsreihenfolge. */
export function humanSeats(state: GameState): PlayerId[] {
  return state.playerOrder.filter((id) => state.players[id]?.kind === 'human')
}

interface Snapshot {
  phase: PartyPhase
  terms: PartyTerms | null
  guestName: string | null
  offered: boolean
  reason: string | null
  session: NetplaySession | null
  start: PartyStart | null
}

const RUHT: Snapshot = {
  phase: 'idle',
  terms: null,
  guestName: null,
  offered: false,
  reason: null,
  session: null,
  start: null,
}

export function useParty(options: PartyOptions): PartyView {
  const { link, connect, origin, mapById, rules } = options
  const [snapshot, setSnapshot] = useState<Snapshot>(RUHT)

  const transportRef = useRef<Transport | null>(null)
  /** Was der Gastgeber anzubieten hat — erst gesetzt, wenn er die Partie angelegt hat. */
  const offerRef = useRef<{ config: GameConfig; fixedSpeed: number; resume: GameState | null } | null>(null)
  /** Beim Gast: die Willkommensnachricht, aus der Zustand und Bedingungen entstehen. */
  const welcomeRef = useRef<WelcomeMessage | null>(null)
  /** Die Probe der Gegenseite — beim Gast der Startabdruck, gegen den ein `zustand` prüft. */
  const otherProbeRef = useRef<ProbeMessage | null>(null)
  const savedRef = useRef<GameState | null>(options.savedState ?? null)
  savedRef.current = options.savedState ?? null
  /** Die eigene Probe — erst nach ihr darf verglichen werden. */
  const probeRef = useRef<ProbeOutcome | null>(null)
  /** Sitzt die Gegenseite im Raum? Beim Host: hat schon jemand `hallo` gesagt? */
  const peerRef = useRef(false)
  const mapByIdRef = useRef(mapById)
  mapByIdRef.current = mapById
  const rulesRef = useRef(rules)
  rulesRef.current = rules
  /**
   * Die Leitungsquelle liegt in einem Merker und nicht in den Abhängigkeiten.
   *
   * **Gemessen am 2026-09-14:** ein Aufrufer, der `connect` als frische Funktion und
   * `link` als frisches Objekt hereingibt — die naheliegendste Schreibweise —, ließ den
   * Effekt bei jedem Bild neu laufen. Jeder Lauf baute eine Leitung, schickte `hallo` und
   * rief `setSnapshot`; das nächste Bild tat es wieder. Der Testlauf endete mit
   * „JavaScript heap out of memory" nach 160 Sekunden. Ein Haken, der nur bei stabilen
   * Eigenschaften funktioniert, ist eine Falle für seinen nächsten Benutzer.
   */
  const connectRef = useRef(connect)
  connectRef.current = connect

  const role: PartyRole = link?.role ?? 'host'
  // Beide Kennungen kommen aus der einen Stelle, die sie vergibt (`link.ts`). „Wenn ich
  // p1 bin, ist der andere p2" waere eine zweite Rechnung - genau die Annahme, die
  // T-M37-01 aus der Oberflaeche entfernt hat.
  const { seat, peer } = seatsOfRole(role)

  const send = useCallback((message: NetMessage): void => {
    const leitung = transportRef.current
    if (!leitung || leitung.closed) return
    leitung.send(message)
  }, [])

  /** Abbrechen und sagen, warum. Ein Ende ohne Grund ist für den Spieler ein Absturz. */
  const abbrechen = useCallback((reason: string, sagen: boolean): void => {
    if (sagen) send({ ...envelope('ende'), reason: 'fassungsstreit', tick: 0 })
    setSnapshot((alt) => ({ ...alt, phase: 'refused', reason }))
  }, [send])

  /**
   * Der Handschlag ist durch: aus der Partiedefinition wird der Startzustand, und der
   * Gleichschritt übernimmt.
   *
   * **Beide Seiten rechnen ihn selbst** — es geht kein Zustand über die Leitung (D28.2).
   * Dass dabei bitgleich dasselbe herauskommt, hat die Probe gerade gemessen; deshalb steht
   * sie davor und nicht daneben.
   */
  const beginnen = useCallback(
    (config: GameConfig, fixedSpeed: number, state: GameState): void => {
      const map = mapByIdRef.current(config.mapId)
      const ctx = { map, rules: rulesRef.current }
      const lockstep = createLockstep({ seat, seats: humanSeats(state), state, ctx })
      const leitung = transportRef.current
      if (!leitung) return
      setSnapshot((alt) => ({
        ...alt,
        phase: 'playing',
        reason: null,
        session: { lockstep, transport: leitung, seat, peer },
        start: { state, mapId: config.mapId, fixedSpeed, seat },
      }))
    },
    [seat, peer],
  )

  // Die drei Felder des Links statt des Objekts: ein frisches Objekt mit denselben Werten
  // ist fuer React ein anderes, und ein Effekt, der daran haengt, baut bei jedem Bild eine
  // neue Leitung.
  const room = link?.room ?? ''
  const secret = link?.secret ?? ''
  const linkRole = link?.role ?? null
  const hatLeitung = connect !== null

  useEffect(() => {
    const bauen = connectRef.current
    if (!linkRole || !bauen || !hatLeitung) return
    const leitung = bauen(socketUrlOf(origin, room, secret, seatOfRole(linkRole)))
    transportRef.current = leitung
    peerRef.current = false
    setSnapshot({ ...RUHT, phase: 'lobby' })

    const abmelden = leitung.onMessage((message) => {
      if (linkRole === 'host') {
        if (message.kind === 'hallo') {
          // Zweimal hallo ist Absicht: die Anmeldung beim Verbinden (ohne Namen) und der
          // Beitritt (mit Namen). Der Host soll sehen, DASS jemand da ist, bevor derjenige
          // getippt hat - „da, aber noch ohne Namen" ist eine Auskunft, „niemand da" waere
          // eine falsche.
          peerRef.current = true
          setSnapshot((alt) => ({ ...alt, guestName: message.name }))
          const angebot = offerRef.current
          if (angebot) {
            const abdruck = fingerprintOf(rulesRef.current, mapByIdRef.current(angebot.config.mapId))
            send(welcome(angebot.config, peer, abdruck, PROBE_TICKS, angebot.fixedSpeed))
          }
        } else if (message.kind === 'probe') {
          const eigene = probeRef.current
          const angebot = offerRef.current
          if (!eigene || !angebot) return
          const eigenerStand =
            angebot.resume ??
            createInitialState(angebot.config, {
              map: mapByIdRef.current(angebot.config.mapId),
              rules: rulesRef.current,
            })
          const entscheid = resumeDecision(eigene, message)
          if (entscheid.kind === 'abort') {
            // Derselbe Stand, zwei Ergebnisse: das ist ein Rechenfehler und kein Fall
            // fuer eine Uebertragung (R-MP-13/AK1, T-M39-06).
            abbrechen(entscheid.reason, true)
            return
          }
          if (entscheid.kind === 'transfer') {
            // Die EINZIGE Stelle, an der ein Zustand ueber die Leitung geht (D28.11).
            // Gemessen: 92 KB am Anfang, 263 KB nach dreissig Spieltagen.
            send(stateMessage(eigenerStand))
          }
          beginnen(angebot.config, angebot.fixedSpeed, eigenerStand)
        } else if (message.kind === 'ende') {
          // Der Gast ist gegangen. Der Platz im Raum wird ohnehin frei (T-M38-07); hier
          // wird der Bildschirm wieder ehrlich, statt einen Namen stehen zu lassen.
          peerRef.current = false
          setSnapshot((alt) =>
            alt.phase === 'playing' ? alt : { ...alt, guestName: null, phase: 'lobby', reason: null },
          )
        }
        return
      }

      if (message.kind === 'willkommen') {
        const abdruck = fingerprintOf(rulesRef.current, mapByIdRef.current(message.config.mapId))
        const vergleich = compareFingerprints(abdruck, fingerprintOfWelcome(message))
        if (!vergleich.ok) {
          abbrechen(vergleich.reason, true)
          return
        }
        welcomeRef.current = message
        setSnapshot((alt) => ({ ...alt, offered: true, terms: termsOf(message), reason: null }))
      } else if (message.kind === 'probe') {
        // Der Host hat gestartet (R-MP-12/AK2). Erst jetzt rechnet der Gast seine Probe -
        // vorher gibt es keine Partiedefinition, gegen die er sie halten koennte.
        const willkommen = welcomeRef.current
        if (!willkommen) return
        otherProbeRef.current = message
        setSnapshot((alt) => ({ ...alt, phase: 'checking' }))
        const map = mapByIdRef.current(willkommen.config.mapId)
        const ctx = { map, rules: rulesRef.current }
        // Der eigene Ausgangspunkt: der gespeicherte Stand, wenn er zu DIESER Karte
        // gehoert, sonst der frische Anfang. Ein Stand einer anderen Karte waere kein
        // aelterer Stand derselben Partie, sondern eine andere Partie.
        const eigenerStand =
          savedRef.current && savedRef.current.mapId === willkommen.config.mapId
            ? savedRef.current
            : createInitialState(willkommen.config, ctx)
        const eigene = runProbeFrom(eigenerStand, ctx, message.ticks)
        probeRef.current = eigene
        send(probeMessage(eigene))

        const entscheid = resumeDecision(eigene, message)
        if (entscheid.kind === 'abort') {
          abbrechen(entscheid.reason, true)
          return
        }
        // Bei `transfer` wird NICHT begonnen: der Stand des Gastgebers ist unterwegs, und
        // mit dem eigenen loszurechnen hiesse, zwei Welten nebeneinander zu fuehren.
        if (entscheid.kind === 'continue') beginnen(willkommen.config, willkommen.fixedSpeed, eigenerStand)
      } else if (message.kind === 'zustand') {
        // Der uebertragene Stand (T-M39-06, R-MP-13/AK2). Geprueft wird gegen das, was der
        // Gastgeber ANGEKUENDIGT hat, nicht gegen das, was ankam.
        const willkommen = welcomeRef.current
        const angekuendigt = otherProbeRef.current?.fromHash
        if (!willkommen || !angekuendigt) return
        const genommen = acceptState(message, angekuendigt)
        if (!genommen.ok) {
          abbrechen(genommen.reason, true)
          return
        }
        beginnen(willkommen.config, willkommen.fixedSpeed, genommen.state)
      } else if (message.kind === 'ende') {
        setSnapshot((alt) =>
          alt.phase === 'playing'
            ? alt
            : { ...alt, phase: 'refused', reason: 'Der Gastgeber hat die Partie beendet.' },
        )
      }
    })

    const abmeldenSchluss = leitung.onClose((reason) => {
      setSnapshot((alt) => (alt.phase === 'playing' ? alt : { ...alt, phase: 'refused', reason }))
    })

    // Die Anmeldung, und sie steht vor allem anderen: sie traegt die Protokollfassung, und
    // verschiedene Fassungen reden nicht miteinander (R-MP-06/AK1). Der Name folgt beim
    // Beitritt - vorher weiss der Gast nicht, worauf er sich einliesse.
    if (linkRole === 'guest') leitung.send(hello('', ''))

    return () => {
      abmelden()
      abmeldenSchluss()
      leitung.close('Die Seite wurde verlassen.')
      transportRef.current = null
    }
  }, [linkRole, hatLeitung, room, secret, origin, peer, send, abbrechen, beginnen])

  const offer = useCallback(
    (config: GameConfig, fixedSpeed: number, resume: GameState | null = null) => {
      offerRef.current = { config, fixedSpeed, resume }
      setSnapshot((alt) => ({ ...alt, offered: true, terms: null }))
      // Wartet schon jemand, bekommt er die Bedingungen sofort; sonst beim `hallo`.
      if (peerRef.current) {
        const abdruck = fingerprintOf(rulesRef.current, mapByIdRef.current(config.mapId))
        send(welcome(config, peer, abdruck, PROBE_TICKS, fixedSpeed))
      }
    },
    [peer, send],
  )

  const join = useCallback(
    (name: string) => {
      const willkommen = welcomeRef.current
      if (!willkommen) return
      const eigene = willkommen.config.players.find((_, index) => `p${index + 1}` === willkommen.seat)
      send(hello(name, eigene?.nation ?? ''))
      // Auch beim Gast steht der Name jetzt auf dem Gastplatz: er ist zugleich die
      // Antwort auf „bin ich schon beigetreten?" und ersetzt ein zweites Merkfeld.
      setSnapshot((alt) => ({ ...alt, guestName: name }))
    },
    [send],
  )

  /**
   * Der Gastgeber startet (R-MP-12/AK2).
   *
   * Die Partie beginnt, wenn der Host es sagt, **nicht wenn eine Verbindung steht**. Sein
   * `probe` ist zugleich der Startschuss und die erste Hälfte des Determinismus-Handschlags
   * — eine eigene „los"-Nachricht wäre eine achte Art für etwas, das eine der sieben schon
   * kann.
   */
  const begin = useCallback(() => {
    const angebot = offerRef.current
    if (!angebot) return
    setSnapshot((alt) => ({ ...alt, phase: 'checking' }))
    const ctx = { map: mapByIdRef.current(angebot.config.mapId), rules: rulesRef.current }
    // Der Ausgangspunkt ist der geladene Stand, wenn es einen gibt - sonst der Anfang.
    // Die Probe rechnet von DORT los und nennt ihn; ohne diesen Abdruck haelte die
    // Gegenseite einen anderen Stand fuer einen Rechenfehler (T-M39-06, R-MP-13).
    const start = angebot.resume ?? createInitialState(angebot.config, ctx)
    const eigene = runProbeFrom(start, ctx, PROBE_TICKS)
    probeRef.current = eigene
    send(probeMessage(eigene))
  }, [send])

  const leave = useCallback(() => {
    send({ ...envelope('ende'), reason: 'abbruch', tick: 0 })
    transportRef.current?.close('Diese Seite hat die Partie verlassen.')
    setSnapshot((alt) => ({ ...alt, phase: 'refused', reason: 'Die Partie wurde verlassen.' }))
  }, [send])

  return useMemo(
    (): PartyView => ({
      active: linkRole !== null && hatLeitung,
      role,
      phase: linkRole !== null && hatLeitung ? snapshot.phase : 'idle',
      seat,
      terms: snapshot.terms,
      guestName: snapshot.guestName,
      offered: snapshot.offered,
      reason: snapshot.reason,
      session: snapshot.session,
      start: snapshot.start,
      offer,
      join,
      begin,
      leave,
    }),
    [linkRole, hatLeitung, role, seat, snapshot, offer, join, begin, leave],
  )
}
