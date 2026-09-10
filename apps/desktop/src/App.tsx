import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  RESOURCE_KEYS,
  canApply,
  eventsFor,
  worldEventsIn,
  publicView,
  type Command,
  type GameState,
  type MapData,
  type Rules,
  type FastForwardTarget,
  type GameEvent,
  type StopReason,
  type StoragePort,
} from '@worldwar/core'
import { advance } from './game/advance.ts'
import { fastForwardChunk } from './game/fastForward.ts'
import {
  armyActions,
  buildActions,
  cancelActions,
  capitalAction,
  diplomacyActions,
  ownArmiesIn,
  planArrival,
  recruitActions,
  targetAction,
  tradePreview,
  unitCounts,
  type ActionContext,
  type ActionSpec,
} from './game/actions.ts'
import { describeRejection } from './game/rejections.ts'
import { t } from './i18n/text.ts'
import { INITIAL_UI, loadSettings, saveSettings, uiReducer, type Settings } from './state/uiState.ts'
import { MapCanvas, type ArmyMarker } from './map/MapCanvas.tsx'
import { dominantIcon, stackSummary, type BuildingsByProvince } from './map/markers.ts'
import { anchorsFor } from './map/anchors.ts'
import { relationKindFor, strengthByProvince } from './map/modes.ts'
import { boundsOf, centreOn, clampView, zoomAt } from './map/picking.ts'
import { Header } from './ui/Header.tsx'
import {
  ArmyPanel,
  DiplomacyPanel,
  EconomyPanel,
  EventLog,
  MarketPanel,
  ProvincePanel,
  ProvincePicker,
  type Action,
  type ActionGroupSpec,
  type DayReportDelta,
  type EventEntry,
  type Targeting,
} from './ui/Panels.tsx'
import {
  DebugPanel,
  KeyboardHelp,
  MenuDialog,
  NewGameDialog,
  SavesDialog,
  SettingsDialog,
  fontScaleStyle,
  type DebugInfo,
} from './ui/Dialogs.tsx'
import { DEFAULT_NEW_GAME, aiBonusPercent, startGame, type NewGameOptions } from './game/newGame.ts'
import { PAN_STEP, ZOOM_STEP, isTypingTarget, resolveKey } from './keyboard.ts'
import { dayExpenses, dayReportBody, dayReportDeltas, describeEvent } from './game/events.ts'
import { advanceWithTrace } from './game/advance.ts'
import { durationDative } from './ui/format.ts'
import { createStorage } from './storage/createStorage'
import { UNIT_ICONS } from './ui/icons.tsx'
import type { IconItem } from './ui/IconRow.tsx'
import { Tutorial } from './ui/Tutorial.tsx'
import { Legend } from './ui/Legend.tsx'
import { StandingsPanel, VictoryDialog } from './ui/Standings.tsx'
import { Alerts, alertsFor } from './ui/Alerts.tsx'
import { cueForEvents, play } from './ui/sound.ts'
import {
  TUTORIAL_OFF,
  TUTORIAL_STORAGE_KEY,
  advance as advanceTutorial,
  advanceOnce,
  dismiss as dismissTutorial,
  initialTutorial,
  type TutorialState,
  type TutorialTrigger,
} from './game/tutorial.ts'
import {
  autosaveDue,
  latestSlot,
  listSlots,
  loadFrom,
  loadTimeline,
  recordTimelineDay,
  saveTimeline,
  saveTo,
  type LatestSave,
  type SlotInfo,
  type TimelineEntry,
} from './game/saves.ts'
import { autosaveName, writeAutosave, HASH_OMIT_KEYS, type AutosaveState } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'

/**
 * The game, assembled (T-M10-03 … T-M10-12).
 *
 * The simulation runs here in the same thread rather than in the worker: SimHost and
 * the worker shell are built and tested (T-M10-02), but wiring a worker into a Vite
 * build is a packaging question that belongs with T-M11-03, and the interactive
 * speeds hold comfortably either way — a tick on the world map costs 2.8 ms against a
 * 16 ms frame.
 *
 * Every order the player can give comes from `game/actions.ts` as data; this file only
 * turns descriptions into buttons and buttons into commands. An order that needs a
 * place on the map — a march, a bombardment — puts the panel into target mode: the
 * next click on the map (or a pick from the list) names the target, the panel says
 * when the army would arrive, and only then is the order given.
 */

export interface AppProps {
  map: MapData
  rules: Rules
  maps: readonly { id: string; name: string; data: MapData }[]
  /** Wohin Spielstaende gehen. Ohne Angabe waehlt createStorage den dauerhaften Speicher. */
  storage?: StoragePort
  /**
   * Where sound comes from. The browser's own audio by default; a test passes a stand-in
   * so that "the game makes a sound when a battle starts" is something a test can see.
   */
  audio?: () => AudioContext | null
  /** Starts with the guided introduction off — for tests and for a returning player. */
  skipTutorial?: boolean
  /** The wall clock, for the real-time half of the autosave rule. Injectable for tests. */
  now?: () => number
}

interface PendingTarget {
  armyId: string
  kind: 'move' | 'bombard'
  target: string | null
}

const VIEWPORT = { viewportWidth: 960, viewportHeight: 600, minScale: 0.2, maxScale: 8 }

/** Nach so viel Stille trotz eingestelltem Tempo nennt die Uhr sich "Pausiert" (T-M22-05). */
const STALL_AFTER_MS = 2000
/** Wie oft die stehende Uhr nachsieht — oft genug, dass die Meldung nicht nachhinkt. */
const STALL_CHECK_MS = 500

/**
 * Whether this player has seen the introduction before.
 *
 * Local storage is the easiest thing in the game to be missing — a private window, a
 * packaged shell without it — and a game that refuses to start over a remembered
 * preference would be absurd. Anything unreadable counts as "never seen".
 */
function readTutorialSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(TUTORIAL_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberTutorialSeen(): void {
  try {
    globalThis.localStorage?.setItem(TUTORIAL_STORAGE_KEY, 'true')
  } catch {
    // Nothing to do: the introduction simply appears again next time.
  }
}

export function App(props: AppProps) {
  // Die gespeicherten Einstellungen sind der Startzustand, nicht die Vorgaben
  // (T-M14-08, schliesst T-M10-09): parseSettings hatte seit M10 keinen Aufrufer, und
  // Ton, Schriftgroesse und Tempogrenze setzten sich bei jedem Start zurueck.
  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI, (start) => ({
    ...start,
    settings: loadSettings(),
  }))

  // Und zurueckgeschrieben wird, sobald sich etwas aendert.
  useEffect(() => {
    saveSettings(ui.settings)
  }, [ui.settings])
  const [options, setOptions] = useState<NewGameOptions>({
    ...DEFAULT_NEW_GAME,
    nation: props.map.startPositions[0]?.nation ?? '',
  })
  const [state, setState] = useState<GameState | null>(null)
  // Synchron gepflegter Spiegel fuer Ablaeufe ausserhalb des Renderzyklus (Vorspulen):
  // sie duerfen nicht im setState-Updater rechnen (StrictMode ruft Updater doppelt).
  const stateRef = useRef<GameState | null>(null)
  stateRef.current = state

  /**
   * Die Karte der laufenden Partie (T-M12-08).
   *
   * Vorher gab es sie nicht: alles las die feste `props.map`, waehrend der Dialog
   * `options.mapId` schrieb, das niemand las. Die Wahl war ein Blindschalter. Die
   * laufende Karte muss ein Zustand sein, weil sie sich mit jeder Partie aendert — und
   * weil ein geladener Stand seine eigene mitbringt.
   */
  const [activeMap, setActiveMap] = useState<MapData>(props.map)

  /** Die Karte zu einer Kennung; unbekannte Kennung faellt auf die Anfangskarte zurueck. */
  const mapById = useCallback(
    (id: string): MapData => props.maps.find((entry) => entry.id === id)?.data ?? props.map,
    [props.maps, props.map],
  )

  /** Die im Dialog gewaehlte Karte — sie fuellt die Maechteliste, bevor die Partie laeuft. */
  const selectedMap = mapById(options.mapId)
  const [speed, setSpeed] = useState(0)
  /**
   * Der laufende Vorspulvorgang (T-M15-06). `reason` traegt den Grund des Halts in
   * derselben Sprache, die der Kern spricht — Ziel erreicht, Alarm, Obergrenze, Abbruch.
   */
  const [fastForwardState, setFastForward] = useState<{
    running: boolean
    ticksRun: number
    reason: StopReason | 'aborted' | null
    /** Das Ereignis, das den Lauf beendet hat — R-TIME-03/AK1 sagt "stoppen UND melden". */
    trigger: GameEvent | null
  }>({ running: false, ticksRun: 0, reason: null, trigger: null })
  const [dialog, setDialog] = useState<'new' | 'menu' | 'saves' | 'settings' | 'keys' | null>('new')
  const [slots, setSlots] = useState<readonly SlotInfo[]>([])
  /** Der juengste Stand fuer "Weiterspielen (Tag N)" (T-M22-04, Befund V2-04). */
  const [resume, setResume] = useState<LatestSave | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<PendingTarget | null>(null)
  const [victoryAcknowledged, setVictoryAcknowledged] = useState(false)
  const [tutorial, setTutorial] = useState<TutorialState>(() =>
    props.skipTutorial ? TUTORIAL_OFF : initialTutorial(readTutorialSeen()),
  )
  // How far the event log had been read the last time a sound was played. Without it
  // every render would replay the same battle.
  const soundedUpTo = useRef(0)
  /** Wie weit die Fuehrung das Protokoll schon gesehen hat (T-M21-02). */
  const tutoredUpTo = useRef(0)
  const [autosave, setAutosave] = useState<AutosaveState>({
    lastSavedTick: 0,
    lastSavedRealTime: 0,
    nextSlot: 0,
  })
  // A save is a promise; without this guard a second render would start a second one
  // against the same slot before the first has finished.
  const writingAutosave = useRef(false)
  const now = props.now ?? Date.now

  /**
   * Befehle, die abgeschickt und noch nicht angewendet sind (T-M22-05, D24.5,
   * Befund V2-08).
   *
   * Bis zum 2026-09-07 rechnete `send` fuer jeden Befehl sofort einen ganzen Tick —
   * ein Klick bei stehender Uhr bewegte die Spielzeit um eine Stunde, samt KI. Jetzt
   * sammelt die Huelle die Befehle und reicht sie dem NAECHSTEN Tick der laufenden
   * Uhr (oder dem Vorspulen); der ausloesende Knopf zeigt bis dahin die Quittung.
   *
   * Zustand UND Ref: der Zustand zeichnet die Quittung, die Ref uebergibt an den
   * Kern — eine Uebergabe aus dem Zustand heraus hinge einen Render hinterher.
   */
  const [pendingCommands, setPendingCommands] = useState<readonly { actionId: string; command: Command }[]>([])
  const pendingRef = useRef<readonly { actionId: string; command: Command }[]>([])
  const takePending = useCallback((): Command[] => {
    const commands = pendingRef.current.map((entry) => entry.command)
    if (commands.length > 0) {
      pendingRef.current = []
      setPendingCommands([])
    }
    return commands
  }, [])

  /**
   * Wann zuletzt ein Tick lief — fuer die ehrliche Uhr (T-M22-05, Befund V2-09):
   * bei verdecktem Fenster feuert `requestAnimationFrame` nicht, die Anzeige stand
   * auf "100" und die Zeit stand. Laeuft trotz eingestelltem Tempo laenger als zwei
   * Sekunden kein Tick, sagt die Kopfleiste "Pausiert".
   */
  const [stalled, setStalled] = useState(false)
  const lastTickAt = useRef(0)
  const ticksPerDay = props.rules.constants.ticksPerDay
  // Der Speicher der laufenden Anwendung. Bis zum 2026-09-06 stand hier ein stiller
  // Rueckfall auf MemoryStorage, und main.tsx reichte nie etwas herein: die Anwendung
  // meldete 'gespeichert', und nach dem Schliessen des Fensters war alles weg (T-M14-08).
  // Tests geben ihren eigenen Port; sonst entscheidet createStorage.
  const chosen = useMemo(() => (props.storage ? null : createStorage()), [props.storage])
  const storage = props.storage ?? chosen!.storage

  // Mit Regeln, damit die Sicht die Tagesbilanz mitbringt (R-ECON-06).
  const view = useMemo(() => (state ? publicView(state, 'p1', props.rules) : null), [state, props.rules])

  /**
   * Sound for what happened since the last look (T-M13-02, R-UI-04).
   *
   * Only the player's own share of the log is read — the fog of war applies to the ears
   * as well as to the eyes — and one tick produces at most one sound, the most urgent
   * one. Above ten game hours a second `play` stays silent by itself.
   */
  useEffect(() => {
    if (!state) return
    const own = eventsFor(state.eventLog, 'p1')
    // Eine neue Partie faengt mit einem leeren Protokoll an, und ein geladener Stand
    // kann kuerzer sein als der laufende. Ohne diese Zeile bleibt der Merker stehen und
    // die naechste Partie ist stumm, bis sie den alten Stand ueberholt hat (T-M21-02).
    if (own.length < soundedUpTo.current) soundedUpTo.current = 0
    const fresh = own.slice(soundedUpTo.current)
    soundedUpTo.current = own.length
    if (fresh.length === 0) return

    const cue = cueForEvents(fresh)
    if (cue) play(cue, { enabled: ui.settings.sound, speed }, props.audio)
  }, [state, ui.settings.sound, speed, props.audio])

  /**
   * Die Körper der Tagesberichte, je Ereignis-Tick (T-M24-01, D24.4, Befund V2-06).
   *
   * Die Hülle liest den Zustand **am Tageswechsel** — deshalb ein Effekt, der wie der
   * Ton daneben nur die frischen Ereignisse ansieht, und kein Rechnen beim Zeichnen:
   * ein Bericht, der beim Rendern aus dem *aktuellen* Zustand entstünde, beschriebe
   * drei Tage später einen anderen Tag als seine Überschrift. Die Karte ist reiner
   * Oberflächenzustand; ein geladener Stand beginnt ohne Körper für alte Berichte —
   * die kommenden Tage bekommen wieder welche.
   */
  // Seit T-M25-04 trägt der Bericht neben den Textzeilen die Bilanzen als Daten:
  // die Delta-Balken des Protokolls sind dieselbe Komponente wie in der Wirtschaft.
  const [dayBodies, setDayBodies] = useState<
    ReadonlyMap<number, { lines: readonly string[]; deltas: readonly DayReportDelta[] }>
  >(new Map())
  const reportedUpTo = useRef(0)

  /**
   * Die Zeitreihe der Partie (T-M25-01, R-UI-13, D25.1): am Tageswechsel — demselben
   * Effekt-Ort wie der Tagesbericht — je bekannter Macht die Punkte und für die eigene
   * Macht Bestände und Bilanzen. Reiner Oberflächenzustand mit Deckel; sie wandert je
   * Spielstand-Slot in den Speicher mit und beginnt bei einem alten Stand ehrlich leer.
   */
  const [timeline, setTimeline] = useState<readonly TimelineEntry[]>([])

  useEffect(() => {
    if (!state || !view) return
    const own = eventsFor(state.eventLog, 'p1')
    // Dieselbe Rücksetzung wie beim Ton: eine neue Partie beginnt mit leerem Protokoll.
    if (own.length < reportedUpTo.current) {
      reportedUpTo.current = 0
      setDayBodies(new Map())
    }
    const fresh = own.slice(reportedUpTo.current)
    reportedUpTo.current = own.length
    const reports = fresh.filter((event) => event.type === 'DAY_REPORT')
    if (reports.length === 0) return

    // Ein Tageswechsel, ein Eintrag: recordTimelineDay lässt denselben Tag unverändert.
    setTimeline((previous) => recordTimelineDay(previous, view, ticksPerDay))

    setDayBodies((previous) => {
      const next = new Map(previous)
      for (const report of reports) {
        // Die eigenen Ereignisse des zu Ende gegangenen Tages — für "fertig geworden".
        const dayEvents = own.filter(
          (event) => event.tick > report.tick - ticksPerDay && event.tick <= report.tick,
        )
        next.set(report.tick, {
          lines: dayReportBody(view, props.rules, dayEvents),
          deltas: dayReportDeltas(view),
        })
      }
      // Deckel: das Protokoll zeigt die letzten vierzig Zeilen; ältere Körper trägt
      // niemand mehr ab, und ein Speicher, der nur wächst, ist ein Leck mit Absicht.
      while (next.size > 60) {
        const oldest = Math.min(...next.keys())
        next.delete(oldest)
      }
      return next
    })
  }, [state, view, ticksPerDay, props.rules])

  /** A step of the guided start ends because the player did the thing it asked for. */
  const tutor = useCallback((action: TutorialTrigger) => {
    setTutorial((current) => advanceTutorial(current, action))
  }, [])

  // Der Punkteschritt endet, wenn die Lage der Maechte offen ist (T-M24-02) — auf
  // JEDEM Weg dorthin, Taste L wie Kopfleiste. Deshalb haengt die Verdrahtung am
  // geoeffneten Panel und nicht an einer der Stellen, die es oeffnen.
  useEffect(() => {
    if (ui.panel === 'standings') tutor('openStandings')
  }, [ui.panel, tutor])

  /**
   * Und ein Schritt endet, weil das **Spiel** etwas meldet (T-M21-02).
   *
   * Dieselbe Bauart wie der Ton daneben: gelesen wird nur der eigene Anteil des
   * Protokolls, und ein Merker haelt fest, wie weit schon gehoert wurde — sonst liefe die
   * Fuehrung bei jedem Bild ueber dieselben Ereignisse und spraenge durch alle Schritte
   * auf einmal.
   *
   * Nacheinander, nicht in einem Rutsch: `advanceTutorial` geht nur weiter, wenn der
   * Ausloeser zum **aktuellen** Schritt gehoert. Ein Tick, in dem drei Dinge zugleich
   * geschehen, bringt die Fuehrung also hoechstens um einen Schritt voran — sie ist eine
   * Fuehrung und kein Zaehlwerk.
   */
  useEffect(() => {
    if (!state) return
    const own = eventsFor(state.eventLog, 'p1')
    // Dieselbe Ruecksetzung wie beim Ton: sonst wuerde die Fuehrung in einer zweiten
    // Partie genau die Schritte ueberspringen, fuer die sie gebaut ist.
    if (own.length < tutoredUpTo.current) tutoredUpTo.current = 0

    const { state: next, consumed } = advanceOnce(
      tutorial,
      own.slice(tutoredUpTo.current).map((event) => event.type),
    )
    tutoredUpTo.current += consumed
    if (next !== tutorial) setTutorial(next)
    // `tutorial` steht in den Abhaengigkeiten: hat ein Ereignis einen Schritt beendet,
    // laeuft dieser Effekt erneut und bietet den Rest des Stroms dem naechsten Schritt an.
  }, [state, tutorial])

  // Eine entschiedene Partie laeuft nicht weiter: die Uhr haelt an, sobald ein Sieger
  // feststeht (R-UI-13). Das Fenster darf man schliessen, die Uhr bleibt stehen.
  useEffect(() => {
    if (view?.victory.winner || view?.self.alive === false) setSpeed(0)
  }, [view?.victory.winner, view?.self.alive])

  // Once it has run its course it never comes back — the same promise as the button.
  useEffect(() => {
    if (tutorial.seen) rememberTutorialSeen()
  }, [tutorial.seen])

  /**
   * Automatic saving (T-M13-03, R-GAME-04).
   *
   * The core has held the rotation and the two-clock rule since M8 and the settings
   * dialogue has offered an interval since M10; nothing connected the two, so the
   * setting was a decoration. Both clocks have to agree — a game day of play *and* the
   * chosen minutes of real time — which is what keeps a fast-forwarded hour from
   * filling all three slots with near-identical states.
   */
  useEffect(() => {
    if (!state || writingAutosave.current) return
    const at = now()
    if (!autosaveDue(autosave, state, at, ui.settings.autosaveMinutes, ticksPerDay)) return

    writingAutosave.current = true
    // Der Slot, in den writeAutosave gleich schreibt — die Zeitreihe wandert als
    // Nachbarschlüssel mit (T-M25-01). Best effort: scheitert sie, bleibt der Stand gültig.
    const slotName = autosaveName(autosave.nextSlot)
    void writeAutosave(storage, autosave, state, at)
      .then(async (next) => {
        await saveTimeline(storage, slotName, timeline).catch(() => undefined)
        setAutosave(next)
        setSaveNotice(t('saves.autosaved'))
      })
      .finally(() => {
        writingAutosave.current = false
      })
  }, [state, autosave, ui.settings.autosaveMinutes, ticksPerDay, storage, now, timeline])

  /** Everything the order descriptions need, in one place. */
  const ctx: ActionContext | null = useMemo(
    () => (state ? { state, map: activeMap, rules: props.rules, playerId: 'p1', ticksPerDay } : null),
    [state, activeMap, props.rules, ticksPerDay],
  )

  /** Sichtbare Truppenstärke je Provinz, für den Kartenmodus (T-M13-10). */
  const strengths = useMemo(() => strengthByProvince(view?.armies ?? []), [view])

  const provinces = useMemo(
    () =>
      activeMap.provinces.map((province) => {
        const seen = view?.provinces.find((p) => p.id === province.id)
        return {
          id: province.id,
          owner: seen?.owner ?? null,
          morale: seen?.morale === undefined ? undefined : seen.morale / 1000,
          deposits: seen?.deposits as Record<string, number> | undefined,
          // Nur was der Spieler sieht: eine Provinz hinter dem Nebel bleibt unbekannt,
          // statt als "keine Truppen" zu erscheinen.
          strength: seen === undefined ? undefined : (strengths[province.id] ?? 0),
          // Der Beziehungsmodus (T-M26-03): aus dem gemerkten Eigentuemer und der
          // EIGENEN Beziehungslage — auch ein veralteter Eigentuemer traegt die
          // heutige Beziehung, denn die kennt man von sich selbst.
          relation: seen === undefined ? undefined : relationKindFor(seen.owner, 'p1', view?.relations ?? {}),
          polygons: province.polygons,
          bounds: boundsOf(province.polygons),
        }
      }),
    [activeMap.provinces, view, strengths],
  )

  const centres = useMemo(
    () => Object.fromEntries(activeMap.provinces.map((p) => [p.id, p.center])),
    [activeMap.provinces],
  )

  const nameOfProvince = useCallback(
    (id: string): string => activeMap.provinces.find((p) => p.id === id)?.name ?? id,
    [activeMap.provinces],
  )

  /** Gebaeude je Provinz, Art → Stufe — nur die eigenen sind bekannt (R-DIP-04). */
  const buildings = useMemo(() => {
    const byProvince: Record<string, Partial<Record<string, number>>> = {}
    for (const province of view?.provinces ?? []) {
      const known = Object.entries(province.buildings ?? {}).filter(([, level]) => (level ?? 0) > 0)
      if (known.length > 0) byProvince[province.id] = Object.fromEntries(known)
    }
    return byProvince as BuildingsByProvince
  }, [view])

  /** Die Anker je Provinz (T-M30-02): aus der Geometrie, einmal je Karte. */
  const anchors = useMemo(
    () => Object.fromEntries(activeMap.provinces.map((p) => [p.id, anchorsFor(p.polygons, p.center)])),
    [activeMap.provinces],
  )

  const armies: ArmyMarker[] = useMemo(
    () =>
      (view?.armies ?? []).map((army) => {
        // Eigene Armeen tragen das Zeichen ihrer staerksten Gattung; von fremden weiss
        // der Spieler nur die Staerke, also bleibt es dort beim schlichten Kasten.
        const icon = army.units
          ? dominantIcon(army.units.map((stack) => ({ unitKey: stack.unitKey, hp: stack.hpTotal })))
          : undefined
        // Der laufende Marsch, wenn die Sicht ihn kennt: erste Station des Weges,
        // Abmarsch und Ankunft. Fehlt eines davon, bleibt der Marker in der Mitte
        // stehen — eine Armee an einem erfundenen Zwischenort waere schlimmer als eine,
        // die nicht wandert (T-M20-04).
        // Zahl und Zustand des Stapels (T-M30-01) — nur, wo die Sicht die Einheiten kennt.
        const summary = army.units ? stackSummary(army.units, props.rules) : null
        const relation = view?.relations[army.owner]?.state
        const naechste = army.path?.[0]
        const march =
          naechste && army.departureTick != null && army.arrivalTick != null
            ? {
                toProvinceId: naechste,
                departureTick: army.departureTick,
                arrivalTick: army.arrivalTick,
                // Die ganze Restroute, fuer den Marschpfeil (T-M26-01).
                route: army.path!,
              }
            : undefined
        return {
          id: army.id,
          provinceId: army.provinceId,
          owner: army.owner,
          strength: army.strength,
          own: army.owner === 'p1',
          ...(icon ? { icon } : {}),
          ...(summary ? { count: summary.count, condition: summary.condition } : {}),
          ...(relation ? { relation } : {}),
          ...(march ? { march } : {}),
        }
      }),
    [view, props.rules],
  )

  /** Was gerade Aufmerksamkeit braucht: Kampf, Mangel, Aufstandsgefahr (R-UI-14). */
  const alerts = useMemo(() => {
    const aus = alertsFor(view, props.rules)
    // Kein dauerhafter Speicher? Dann erfaehrt es der Spieler jetzt und nicht beim
    // naechsten Start (T-M14-08). Ein stiller Rueckfall auf den Arbeitsspeicher war
    // genau der Zustand, den diese Aufgabe behebt.
    if (chosen?.warning) {
      aus.unshift({ id: 'storage:volatile', kind: 'shortage', icon: 'warning', text: chosen.warning })
    }
    return aus
  }, [view, chosen])

  /** Wo gerade gekaempft wird — so weit der Spieler es sehen darf (R-DIP-04). */
  const battleProvinces = useMemo(() => (view?.battles ?? []).map((battle) => battle.provinceId), [view])

  // Der Weg der gewaehlten Armee war seit T-M20-03 eine gestrichelte Linie; seit
  // T-M26-01 zeichnet die Karte JEDEN sichtbaren Marsch als Pfeil mit Fortschritt —
  // die Route wandert oben als `march.route` in die Armee-Marker, eine eigene
  // Vorschau-Ebene braucht es nicht mehr.

  /** Wie viele Zeilen das Protokoll je Rubrik vorhält. */
  const LOG_LINES = 40

  /** Wie viele Befehlszeilen die Debug-Ansicht vorhält. */
  const TRACE_LINES = 50

  /** Obergrenze eines Vorspulvorgangs: 30 Spieltage, damit ein nie eintretendes Ziel endet. */
  const MAX_FAST_FORWARD_TICKS = 30 * ticksPerDay

  /**
   * Die letzten Befehle und die letzten Begruendungen der KI (T-M12-10, R-AI-05).
   *
   * Beides entstand schon und wurde weggeworfen: `advanceTicks` gibt `applied`
   * zurueck, `advance` reichte nur den Zustand weiter, und die Debug-Ansicht bekam
   * feste leere Listen. Gefuehrt wird nur, solange die Ansicht offen ist — die
   * Begruendungen kosten Zeit, und die Schleife laeuft mit hundert Spielstunden je
   * Sekunde.
   */
  const [trace, setTrace] = useState<{ commands: string[]; goals: DebugInfo['aiGoals'] }>({
    commands: [],
    goals: [],
  })
  const debugOn = ui.settings.debug

  /** Was die KI gerade befohlen hat, in die Spur der Debug-Ansicht. */
  const noteTrace = useCallback(
    (entry: {
      tick: number
      commands: readonly { type: string }[]
      explanations: Record<string, { action: string; reason: string; score: number; alternative?: { action: string } }[]>
    }) => {
      setTrace((old) => ({
        commands: [...old.commands, ...entry.commands.map((command) => `${entry.tick}  ${command.type}`)].slice(
          -TRACE_LINES,
        ),
        goals: Object.entries(entry.explanations).flatMap(([playerId, list]) =>
          list.slice(0, 1).map((explanation) => ({
            player: playerId,
            goal: `${explanation.action} — ${explanation.reason}`,
            utility: explanation.score,
            alternatives: explanation.alternative ? [explanation.alternative.action] : [],
          })),
        ),
      }))
    },
    [],
  )

  /** One game hour, AI included — and the moment the collected orders take effect. */
  const step = useCallback(
    (ticks: number) => {
      // Die gesammelten Befehle gehoeren dem ersten Tick dieses Schritts (T-M22-05).
      const commands = takePending()
      lastTickAt.current = now()
      setStalled((wasStalled) => (wasStalled ? false : wasStalled))
      // Gerechnet wird ausserhalb des Updaters — dieselbe Klasse wie beim Vorspulen
      // (Befund 2026-09-08): ein Updater muss pur sein, StrictMode ruft ihn doppelt.
      // Hier war der Doppellauf ergebnisgleich, aber noteTrace feuerte zweimal.
      const current = stateRef.current
      if (!current) return
      if (!debugOn) {
        setState(advance(current, ticks, { map: activeMap, rules: props.rules }, commands))
        return
      }
      const result = advanceWithTrace(current, ticks, { map: activeMap, rules: props.rules }, commands)
      noteTrace({
        tick: current.tick,
        commands: result.applied.map((entry) => entry.command),
        explanations: result.explanations,
      })
      setState(result.state)
    },
    [activeMap, props.rules, debugOn, noteTrace, takePending, now],
  )

  /**
   * Die ehrliche Uhr (T-M22-05, R-TIME-02, Befund V2-09): laeuft trotz eingestelltem
   * Tempo laenger als zwei Sekunden kein Tick — verdecktes Fenster, stehendes
   * `requestAnimationFrame` —, zeigt die Kopfleiste "Pausiert" statt des Tempos.
   */
  const hasGame = state !== null
  useEffect(() => {
    if (speed === 0 || !hasGame) {
      setStalled(false)
      return
    }
    lastTickAt.current = now()
    const id = setInterval(() => {
      setStalled(now() - lastTickAt.current > STALL_AFTER_MS)
    }, STALL_CHECK_MS)
    return () => clearInterval(id)
  }, [speed, hasGame, now])

  /**
   * Vorspulen bis zum naechsten Ereignis (T-M15-06, R-TIME-02/AK2, R-TIME-03).
   *
   * Ruft **die Schleife des Kerns**, in Haeppchen: zwischen zwei Haeppchen kommt die
   * Ereignisschleife dran, also bleibt die Oberflaeche bedienbar und der Abbruch
   * erreichbar. Bis zum 2026-09-06 rechnete diese Stelle `step(ticksPerDay)` — genau
   * einen Spieltag, ohne Ziel, ohne Alarm, ohne Abbruch.
   */
  const abortFastForward = useRef(false)
  const fastForwardRun = useCallback(
    (target: FastForwardTarget) => {
      const viewerId = 'p1'
      if (!viewerId) return
      abortFastForward.current = false
      setSpeed(0)
      setFastForward({ running: true, ticksRun: 0, reason: null, trigger: null })

      // Die gesammelten Befehle gehoeren dem ERSTEN Tick des Laufs (T-M22-05) —
      // gegeben wurden sie jetzt, nicht in jedem Haeppchen erneut.
      let playerCommands: readonly Command[] = takePending()
      const request = { target, alertsFor: viewerId, maxTicks: MAX_FAST_FORWARD_TICKS }
      let ticksRun = 0

      // Gerechnet wird AUSSERHALB des setState-Updaters, und der Zustand wird von
      // Haeppchen zu Haeppchen explizit weitergereicht. Ein Updater muss pur sein:
      // React ruft ihn unter StrictMode doppelt, und die fruehere Fassung verlor
      // dabei die gesammelten Befehle (der erste Lauf leerte `playerCommands`, der
      // zweite — dessen Ergebnis zaehlt — rechnete ohne sie) und zaehlte `ticksRun`
      // doppelt ("Angehalten nach 2 Tagen" bei einem). Befund vom 2026-09-08.
      const chunk = (current: GameState): void => {
        if (abortFastForward.current) {
          setFastForward({ running: false, ticksRun, reason: 'aborted', trigger: null })
          return
        }

        const result = fastForwardChunk(
          current,
          { ...request, playerCommands },
          { map: activeMap, rules: props.rules },
          MAX_FAST_FORWARD_TICKS - ticksRun,
          debugOn ? noteTrace : undefined,
        )
        playerCommands = []
        ticksRun += result.ticksRun
        setState(result.state)

        // `limit` innerhalb eines Haeppchens heisst nur "Haeppchen zu Ende", nicht
        // "Ziel unerreichbar" — weitergerechnet wird, bis die Gesamtobergrenze steht.
        const weiter = result.stoppedBy === 'limit' && ticksRun < MAX_FAST_FORWARD_TICKS
        if (weiter) {
          setFastForward({ running: true, ticksRun, reason: null, trigger: null })
          setTimeout(() => chunk(result.state), 0)
        } else {
          setFastForward({ running: false, ticksRun, reason: result.stoppedBy, trigger: result.trigger })
        }
      }

      const start = stateRef.current
      if (start) chunk(start)
    },
    [activeMap, props.rules, debugOn, noteTrace, takePending],
  )

  // The clock. Deliberately capped at two ticks per frame: when the machine cannot
  // keep up the rate drops, but no backlog builds that would freeze the game later
  // (design D5).
  useEffect(() => {
    if (speed === 0 || !state) return
    let running = true
    let last = performance.now()
    let owed = 0

    const frame = () => {
      if (!running) return
      const now = performance.now()
      owed = Math.min(2, owed + ((now - last) / 1000) * speed)
      last = now
      const due = Math.floor(owed)
      if (due > 0) {
        owed -= due
        step(due)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return () => {
      running = false
    }
  }, [speed, state, step])

  /**
   * Einen Befehl abschicken (T-M22-05, Befund V2-08).
   *
   * Geprueft wird sofort — eine Absage soll den Spieler jetzt erreichen, nicht im
   * naechsten Tick. Angewendet wird NICHT sofort: bis zum 2026-09-07 rechnete diese
   * Stelle fuer jeden Befehl einen ganzen Tick, ein Klick bei stehender Uhr bewegte
   * also die Spielzeit um eine Stunde, samt KI. Der Befehl geht stattdessen in die
   * Sammlung der Huelle und wirkt im naechsten Tick; die `actionId` laesst den
   * ausloesenden Knopf bis dahin die Quittung zeigen.
   */
  const send = useCallback(
    (command: Command, actionId?: string) => {
      if (!state || !ctx) return
      const result = canApply(state, command, {
        map: activeMap,
        rules: props.rules,
        commands: [command],
        events: [],
      })
      if (!result.ok) {
        dispatch({ type: 'notice', text: describeRejection(result, command, ctx) })
        return
      }
      pendingRef.current = [...pendingRef.current, { actionId: actionId ?? '', command }]
      setPendingCommands(pendingRef.current)
    },
    [state, ctx, activeMap, props.rules],
  )

  /** Welche Knoepfe gerade eine Quittung tragen (T-M22-05): ihr Befehl steht noch aus. */
  const pendingIds = useMemo(() => new Set(pendingCommands.map((entry) => entry.actionId)), [pendingCommands])

  /** A description becomes a button: orders are sent, target orders open target mode. */
  const toAction = useCallback(
    (spec: ActionSpec, armyId?: string): Action => ({
      id: spec.id,
      label: spec.label,
      disabledReason: spec.disabledReason,
      ...(spec.aria ? { aria: spec.aria } : {}),
      ...(spec.icon ? { icon: spec.icon } : {}),
      ...(spec.explainKey ? { explainKey: spec.explainKey } : {}),
      ...(spec.hint ? { hint: spec.hint } : {}),
      // Die Quittung am ausloesenden Knopf (T-M22-05, D24.5): abgeschickt, noch nicht
      // angewendet — bei stehender Uhr mit dem Hinweis, wann es so weit sein wird.
      ...(pendingIds.has(spec.id)
        ? { pendingNotice: speed === 0 ? t('actions.orderedPaused') : t('actions.ordered') }
        : {}),
      onRun: () => {
        if (spec.id.startsWith('build-')) tutor('openBuild')
        if (spec.targetKind && armyId) {
          // The army panel itself says "choose a target" — one notice, not two.
          setTargeting({ armyId, kind: spec.targetKind, target: null })
          dispatch({ type: 'clearNotice' })
        } else if (spec.command) {
          send(spec.command, spec.id)
        }
      },
    }),
    [send, tutor, pendingIds, speed],
  )

  const jumpTo = useCallback(
    (provinceId: string) => {
      const centre = centres[provinceId]
      if (!centre) return
      tutor('openEvents')
      dispatch({ type: 'selectProvince', id: provinceId })
      dispatch({
        type: 'setView',
        view: centreOn(centre, ui.view, { width: activeMap.width, height: activeMap.height, ...VIEWPORT }),
      })
    },
    [centres, ui.view, activeMap, tutor],
  )

  /** A click on the map: a target while an order waits for one, a selection otherwise. */
  const selectOnMap = useCallback(
    (id: string | null) => {
      if (targeting && id) {
        setTargeting({ ...targeting, target: id })
        return
      }
      setTargeting(null)
      if (id) tutor('selectProvince')
      dispatch({ type: 'selectProvince', id })
    },
    [targeting, tutor],
  )

  // Keyboard. One handler, one pure resolver, so every shortcut is testable.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = resolveKey(event, {
        speed,
        mode: ui.mode,
        typing: isTypingTarget(event.target),
        dialogOpen: dialog !== null,
      })
      if (!shortcut) return
      event.preventDefault()

      switch (shortcut.type) {
        case 'togglePause':
          setSpeed((current) => (current === 0 ? 10 : 0))
          break
        case 'speed':
          if (shortcut.hoursPerSecond > 0) tutor('setSpeed')
          setSpeed(Math.min(shortcut.hoursPerSecond, ui.settings.maxSpeed))
          break
        case 'fastForward':
          tutor('fastForward')
          fastForwardRun({ kind: 'days', days: 1 })
          break
        case 'save':
        case 'load':
          setDialog('saves')
          break
        case 'cycleMode':
          dispatch({ type: 'setMode', mode: shortcut.mode })
          break
        case 'openPanel':
          if (state) dispatch({ type: 'openPanel', panel: shortcut.panel })
          break
        case 'help':
          setDialog('keys')
          break
        case 'close':
          // Bis T-M12-07 stand hier eine Ausnahme: vor der ersten Partie lag hinter dem
          // Dialog nichts, zu dem man haette zurueckkehren koennen, also durfte Escape
          // ihn nicht schliessen. Jetzt liegt der Weg zurueck dahinter, und Escape
          // schliesst wieder jeden Dialog — eine Taste mit einer Ausnahme ist eine
          // Taste, die man zweimal erklaeren muss.
          if (dialog) setDialog(null)
          else if (targeting) {
            setTargeting(null)
            dispatch({ type: 'clearNotice' })
          } else dispatch({ type: 'closePanel' })
          break
        case 'zoom':
          // Um die Mitte des Ausschnitts, wie die Knoepfe auf der Karte (T-M30-03).
          dispatch({
            type: 'setView',
            view: zoomAt(
              ui.view,
              { x: VIEWPORT.viewportWidth / 2, y: VIEWPORT.viewportHeight / 2 },
              shortcut.direction > 0 ? 1 / ZOOM_STEP : ZOOM_STEP,
              { width: activeMap.width, height: activeMap.height, ...VIEWPORT },
            ),
          })
          break
        case 'centreCapital':
          if (view?.self.capitalProvinceId) jumpTo(view.self.capitalProvinceId)
          break
        case 'pan':
          dispatch({
            type: 'setView',
            view: clampView(
              {
                x: ui.view.x + shortcut.dx * PAN_STEP * ui.view.scale,
                y: ui.view.y + shortcut.dy * PAN_STEP * ui.view.scale,
                scale: ui.view.scale,
              },
              { width: activeMap.width, height: activeMap.height, ...VIEWPORT },
            ),
          })
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [speed, ui.mode, ui.view, ui.settings.maxSpeed, dialog, step, ticksPerDay, activeMap, state, targeting, tutor])

  useEffect(() => {
    if (dialog !== 'saves') return
    void listSlots(storage, ticksPerDay).then(setSlots)
  }, [dialog, storage, ticksPerDay])

  /**
   * Der juengste Stand, sobald keine Partie laeuft (T-M22-04, Befund V2-04): nach dem
   * Neustart war er zwei Klicks entfernt und wurde nicht angeboten. Er speist den
   * ersten Knopf des Startdialogs, "Weiterspielen (Tag N)".
   */
  useEffect(() => {
    if (state) return
    let active = true
    void latestSlot(storage, ticksPerDay).then((latest) => {
      if (active) setResume(latest)
    })
    return () => {
      active = false
    }
  }, [state, storage, ticksPerDay])

  /**
   * Einen Stand laden — aus der laufenden Partie wie aus dem leeren Fenster (T-M12-07).
   *
   * Der Griff steht hier oben, weil ihn zwei Zweige brauchen: der Befund 26a war, dass
   * genau der zweite fehlte, und wer das Fenster geschlossen hatte, kam an seinen Stand
   * nicht mehr heran.
   */
  const loadSave = useCallback(
    (name: string) => {
      void loadFrom(storage, name).then(async (result) => {
        if (result.ok) {
          // Der Stand bringt seine Karte mit (T-M12-08).
          setActiveMap(mapById(result.state.mapId))
          // Ausstehende Befehle gehoeren zur alten Partie und verfallen (T-M22-05).
          pendingRef.current = []
          setPendingCommands([])
          // Die Zeitreihe des Slots — oder ehrlich leer: ein alter Stand ohne
          // Aufzeichnung beginnt die Kurve am Ladetag (T-M25-01, D25.1).
          setTimeline(await loadTimeline(storage, name))
          setState(result.state)
          setAutosave({ lastSavedTick: result.state.tick, lastSavedRealTime: now(), nextSlot: 0 })
          setSaveNotice(t('saves.loaded'))
          setDialog(null)
        } else {
          // A refused save says why, in a sentence — never an exception and never
          // a silent restart (T-M10-08).
          setSaveNotice(result.message)
        }
        setSlots(await listSlots(storage, ticksPerDay))
      })
    },
    [storage, ticksPerDay, mapById, now],
  )

  /**
   * Eine neue Partie beginnen — aus dem leeren Fenster wie aus der laufenden Partie
   * (T-M22-04, Befund V2-05: das Menue kannte vorher nur die Einstellungen, und der
   * Startdialog wurde ausschliesslich hinter dem Fruehausstieg gezeichnet).
   */
  const startNewGame = useCallback(() => {
    // Die gewaehlte Karte, nicht die Anfangskarte (T-M12-08).
    const chosenMap = mapById(options.mapId)
    const fresh = startGame(options, chosenMap, props.rules)
    setActiveMap(chosenMap)
    // Ausstehende Befehle gehoeren zur alten Partie und verfallen (T-M22-05).
    pendingRef.current = []
    setPendingCommands([])
    // Die Aufzeichnung auch: eine neue Partie beginnt ohne Vergangenheit (T-M25-01).
    setTimeline([])
    setState(fresh)
    // The autosave clock starts now, not at the epoch — otherwise the
    // real-time half of the rule is satisfied before the first day is played
    // and the chosen interval never applies.
    setAutosave({ lastSavedTick: fresh.tick, lastSavedRealTime: now(), nextSlot: 0 })
    // Open on the player's own country rather than on the top-left corner of
    // the world — the first thing they look for is where they are.
    // Die Mitten kommen aus der gewaehlten Karte: der Merker `centres` haelt
    // auf diesem Durchlauf noch die alten und faende die neue Hauptstadt nicht.
    const capital = fresh.players.p1?.capitalProvinceId
    const centre = capital ? chosenMap.provinces.find((province) => province.id === capital)?.center : undefined
    if (centre) {
      dispatch({
        type: 'setView',
        view: centreOn(centre, { x: 0, y: 0, scale: 1.6 }, { width: chosenMap.width, height: chosenMap.height, ...VIEWPORT }),
      })
    }
    setDialog(null)
  }, [options, mapById, props.rules, now])

  /**
   * Der Startdialog, EINMAL beschrieben: vor der ersten Partie steht er hinter dem
   * Fruehausstieg, aus der laufenden Partie oeffnet ihn das Menue (T-M22-04).
   */
  const newGameDialog =
    dialog === 'new' ? (
      <NewGameDialog
        options={options}
        nations={selectedMap.startPositions.map((s) => s.nation)}
        maps={props.maps}
        aiBonus={aiBonusPercent(props.rules, options.difficulty)}
        onChange={(next) => {
          // Mit der Karte wechseln die Maechte. Bleibt die alte Wahl stehen, zeigt
          // der Dialog "Vereinigte Staaten" und die Partie beginnt als "Nordland" —
          // der stille Zwilling des Blindschalters, den toConfig still auffaengt.
          if (next.mapId !== options.mapId) {
            const nations = mapById(next.mapId).startPositions.map((entry) => entry.nation)
            setOptions({
              ...next,
              nation: nations.includes(next.nation) ? next.nation : (nations[0] ?? ''),
            })
            return
          }
          setOptions(next)
        }}
        onStart={startNewGame}
        // Schliessen darf es: der leere Zustand traegt den Weg zurueck (T-M12-07),
        // und aus der laufenden Partie geht es einfach dorthin zurueck.
        onClose={() => setDialog(null)}
        onSaves={() => setDialog('saves')}
        // Weiterspielen nur, solange keine Partie laeuft: mitten in einer Partie
        // hiesse der Knopf "die laufende Partie verwerfen" und truege den falschen Namen.
        resume={state ? null : resume}
        onResume={() => {
          if (resume) loadSave(resume.name)
        }}
      />
    ) : null

  const selected = view?.provinces.find((p) => p.id === ui.selectedProvince) ?? null

  /**
   * Der Tagesabfluss für die Wirtschaftstabelle (T-M28-05, D26.5): Bau + Aushebung +
   * Markt des laufenden Spieltags, gerechnet von `dayExpenses` aus denselben Quellen
   * wie der Tagesbericht — die eigenen Ereignisse im Fenster des Tages plus die
   * frischen Aufträge der Sicht.
   */
  const expenses = useMemo(() => {
    if (!state || !view) return {}
    const own = eventsFor(state.eventLog, 'p1').filter(
      (event) => event.tick > view.tick - ticksPerDay && event.tick <= view.tick,
    )
    return dayExpenses(view, props.rules, own)
  }, [state, view, ticksPerDay, props.rules])

  /** Player ids never reach the screen: the player knows nations, not "p2". */
  const nameOf = useCallback(
    (playerId: string): string => {
      if (!state) return playerId
      return state.players[playerId]?.nation ?? playerId
    },
    [state],
  )
  /** Die Farbe einer Macht — dieselbe, mit der die Karte ihren Besitz fuellt (T-M20-02). */
  const colorOf = useCallback(
    (playerId: string): string | null => state?.players[playerId]?.color ?? null,
    [state],
  )

  /**
   * The log as this player may read it: their own doings and the public ones. The
   * other powers' orders, builds and refusals stay theirs (R-DIP-04) — and every id
   * in a line is swapped for the name it stands for (R-UI-07).
   */
  const events: EventEntry[] = useMemo(() => {
    if (!state) return []
    const naming = {
      player: nameOf,
      army: (id: string) => state.armies[id]?.name ?? id,
      ticksPerDay,
      viewer: 'p1',
    }
    // **Erst deuten, dann zuschneiden** (T-M15-09). Bis zum 2026-09-06 stand hier
    // `.slice(-40)` *vor* allem anderen: das Protokoll wurde auf die letzten vierzig
    // Zeilen gekürzt und der Filter suchte danach in diesem Ausschnitt. Bei fünfhundert
    // Ereignissen, von denen nur die drei ältesten Weltgeschehen sind, fände
    // „Weltgeschehen" **nichts** — und der Knopf wäre ein Knopf, der lügt.
    //
    // Gekürzt wird deshalb auf eine Menge, in der jede Rubrik noch etwas zu zeigen hat:
    // die letzten vierzig Zeilen **und** die letzten vierzig Weltereignisse.
    const alle = eventsFor(state.eventLog, 'p1')
    const jüngste = new Set(alle.slice(-LOG_LINES))
    for (const event of worldEventsIn(alle).slice(-LOG_LINES)) jüngste.add(event)

    return alle
      .filter((event) => jüngste.has(event))
      .reverse()
      .map((event, index) => {
        const entry = describeEvent(event, index, activeMap, naming)
        // Der Tagesbericht trägt seinen Körper (T-M24-01): am Tageswechsel gelesen,
        // hier nur angeheftet. Ohne Körper (geladener Stand) bleibt die Zeile schlicht.
        // Die Bilanzen kommen als Daten dazu — die Balken zeichnet das Protokoll (T-M25-04).
        const report = event.type === 'DAY_REPORT' ? dayBodies.get(event.tick) : undefined
        return report && (report.lines.length > 0 || report.deltas.length > 0)
          ? { ...entry, body: report.lines, deltas: report.deltas }
          : entry
      })
  }, [state, activeMap, nameOf, ticksPerDay, dayBodies])

  /**
   * Der Zustands-Hash der Debug-Ansicht (T-M12-10).
   *
   * Er stand fest auf dem leeren Text und wurde als leeres Feld gezeichnet. Gerechnet
   * wird dieselbe Groesse wie im Spielstand — und nur, wenn die Ansicht offen ist: den
   * ganzen Zustand bei jedem Bild zu hashen waere bei hundert Spielstunden je Sekunde
   * ein echter Preis, und R-TIME-02/AK2 wird gegen genau diese Schleife gemessen.
   */
  const debugHash = useMemo(
    () => (debugOn && state ? hashValue(state, { omitKeys: HASH_OMIT_KEYS }) : ''),
    [debugOn, state],
  )

  /**
   * Warum das Vorspulen anhielt, in einem Satz (T-M12-10, R-TIME-03/AK1).
   *
   * "Stoppen und melden" verlangt die Anforderung. Gestoppt wurde seit M15 richtig, und
   * der Grund lag im Zustand — gemeldet wurde er nie. Beim Alarm wird das ausloesende
   * Ereignis selbst benannt: dass etwas passiert ist, sieht der Spieler ohnehin an der
   * stehenden Uhr; er will wissen, WAS.
   */
  const fastForwardNotice: string | null = useMemo(() => {
    const { running, reason, ticksRun, trigger } = fastForwardState
    if (running || reason === null) return null
    // „Angehalten nach 2 Tagen" — nach verlangt den Dativ (T-M23-02, V2-11).
    const time = durationDative(ticksRun, ticksPerDay)
    if (reason === 'aborted') return t('header.stoppedAborted', { time })
    if (reason === 'limit') return t('header.stoppedLimit', { time })
    if (reason === 'target') return t('header.stoppedTarget', { time })
    if (!trigger || !state) return t('header.stoppedAlertPlain', { time })
    const beschrieben = describeEvent(trigger, 0, activeMap, {
      player: nameOf,
      army: (id: string) => state.armies[id]?.name ?? id,
      ticksPerDay,
      viewer: 'p1',
    })
    return t('header.stoppedAlert', { time, event: beschrieben.text })
  }, [fastForwardState, ticksPerDay, state, activeMap, nameOf])

  /** Build, recruit and capital — for an own province; nothing for anyone else's. */
  const provinceGroups: ActionGroupSpec[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== 'p1') return []
    return [
      { id: 'build', title: t('actions.buildGroup'), actions: buildActions(ctx, selected.id).map((spec) => toAction(spec)) },
      {
        id: 'recruit',
        title: t('actions.recruitGroup'),
        actions: recruitActions(ctx, selected.id).map((spec) => toAction(spec)),
      },
      // Laufende Bauvorhaben abbrechen (T-M14-13, Befund 36). Die Gruppe entfaellt,
      // wenn nichts gebaut wird — ein leerer Kasten ist keine Auskunft.
      ...(cancelActions(ctx, selected.id).length > 0
        ? [
            {
              id: 'cancel',
              title: t('actions.cancelGroup'),
              actions: cancelActions(ctx, selected.id).map((spec) => toAction(spec)),
            },
          ]
        : []),
    ]
  }, [ctx, selected, toAction])

  const provinceActions: Action[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== 'p1') return []
    return [toAction(capitalAction(ctx, selected.id))]
  }, [ctx, selected, toAction])

  const armiesHere = useMemo(() => (ctx && selected ? ownArmiesIn(ctx, selected.id) : []), [ctx, selected])

  const selectedArmy = view?.armies.find((a) => a.id === ui.selectedArmy) ?? null

  /** The chosen army's stacks as symbols with counts (R-UI-10). */
  const armyUnitItems: IconItem[] = useMemo(() => {
    const army = ui.selectedArmy ? state?.armies[ui.selectedArmy] : undefined
    if (!army) return []
    return unitCounts(army, props.rules).map((entry) => ({
      icon: UNIT_ICONS[entry.unitKey] ?? 'warning',
      label: t(`units.${entry.unitKey}`),
      count: entry.count,
    }))
  }, [ui.selectedArmy, state, props.rules])

  const armyActionList: Action[] = useMemo(
    () => (ctx && ui.selectedArmy ? armyActions(ctx, ui.selectedArmy).map((spec) => toAction(spec, ui.selectedArmy!)) : []),
    [ctx, ui.selectedArmy, toAction],
  )

  /**
   * Die Zielwahl-Quittung der gewählten Armee (T-M28-02, D26.2, Befund vom
   * Debugging 2026-09-08): der Bestätigungsknopf der Zielwahl verschwindet mit
   * `setTargeting(null)` im selben Klick — seine `actionId`-Quittung (T-M22-05) hat
   * also nie jemand gesehen. Die Armee-Statuszeile zeigt sie stattdessen, gespeist
   * aus derselben `pendingCommands`-Sammlung; nur für Marsch und Beschuss, denn die
   * übrigen Armee-Befehle behalten ihren sichtbaren Knopf samt Quittung.
   */
  const armyPendingNotice = useMemo(() => {
    if (!ui.selectedArmy) return null
    const waiting = pendingCommands.some(
      (entry) =>
        (entry.command.type === 'MOVE_ARMY' || entry.command.type === 'BOMBARD') &&
        entry.command.armyId === ui.selectedArmy,
    )
    if (!waiting) return null
    return speed === 0 ? t('actions.orderedPaused') : t('actions.ordered')
  }, [pendingCommands, ui.selectedArmy, speed])

  /** Target mode for the selected army: options, the chosen place, and its arrival. */
  const armyTargeting: Targeting | null = useMemo(() => {
    if (!ctx || !targeting || !state || targeting.armyId !== ui.selectedArmy) return null
    const army = state.armies[targeting.armyId]
    if (!army) return null
    const options = activeMap.provinces
      .filter((p) => p.id !== army.locationProvinceId)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const target = targeting.target
      ? {
          id: targeting.target,
          name: nameOfProvince(targeting.target),
          arrivalText: targeting.kind === 'move' ? (planArrival(ctx, army.id, targeting.target)?.text ?? null) : null,
        }
      : null
    const confirmSpec = targeting.target ? targetAction(ctx, army.id, targeting.kind, targeting.target) : null
    const confirm: Action | null = confirmSpec
      ? {
          ...toAction(confirmSpec),
          onRun: () => {
            if (confirmSpec.command) send(confirmSpec.command, confirmSpec.id)
            setTargeting(null)
            dispatch({ type: 'clearNotice' })
          },
        }
      : null
    return {
      kind: targeting.kind,
      target,
      options,
      confirm,
      onChoose: (id) => setTargeting({ ...targeting, target: id }),
      onCancel: () => {
        setTargeting(null)
        dispatch({ type: 'clearNotice' })
      },
    }
  }, [ctx, targeting, state, ui.selectedArmy, activeMap.provinces, nameOfProvince, toAction, send])

  if (!state || !view || !ctx) {
    return (
      <div className="app app--empty" style={fontScaleStyle(ui.settings)}>
        <p>{t('app.loading')}</p>
        {/*
          Der Weg zurueck (T-M12-07, Befund 26a). Vorher war diese Flaeche eine
          Sackgasse: Strg+S ersetzte den Startdialog durch nichts, Escape loeschte ihn
          endgueltig, und nur Neuladen half. Beide Knoepfe sind auch der Grund, warum das
          Kreuz des Startdialogs jetzt schliessen darf.
        */}
        {dialog === null && (
          <p className="app__empty-actions">
            <button type="button" className="button button--primary" onClick={() => setDialog('new')}>
              {t('newGame.title')}
            </button>
            <button type="button" className="button" onClick={() => setDialog('saves')}>
              {t('saves.title')}
            </button>
          </p>
        )}
        {/*
          Die Spielstaende auch ohne Partie: wer das Fenster geschlossen hat, kommt sonst
          an seinen Stand nicht mehr heran. Gespeichert wird hier nichts — es gibt nichts
          zu speichern —, deshalb faellt der Griff onSave weg.
        */}
        {dialog === 'saves' && (
          <SavesDialog
            slots={slots}
            notice={saveNotice}
            onLoad={loadSave}
            onClose={() => {
              setSaveNotice(null)
              setDialog('new')
            }}
          />
        )}
        {newGameDialog}
      </div>
    )
  }

  const ownProvinces = view.provinces.filter((p) => p.owner === 'p1').map((p) => ({ id: p.id, name: p.name }))
  const knownProvinces = view.provinces.filter((p) => p.owner !== 'p1').map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="app" style={fontScaleStyle(ui.settings)}>
      <Header
        view={view}
        ticksPerDay={ticksPerDay}
        speed={speed}
        stalled={stalled}
        fastForwarding={fastForwardState.running}
        fastForwardNotice={fastForwardNotice}
        mode={ui.mode}
        onSpeed={(value) => {
          if (value > 0) tutor('setSpeed')
          setSpeed(Math.min(value, ui.settings.maxSpeed))
        }}
        onFastForward={() => {
          tutor('fastForward')
          fastForwardRun({ kind: 'days', days: 1 })
        }}
        onAbort={() => {
          abortFastForward.current = true
          setSpeed(0)
        }}
        onMode={(mode) => dispatch({ type: 'setMode', mode })}
        // Das Menue mit Wegen statt eines Sprungs in die Einstellungen (T-M22-04, V2-05).
        onMenu={() => setDialog('menu')}
        onSaves={() => setDialog('saves')}
        onPanel={(panel) => dispatch({ type: 'openPanel', panel })}
      />

      <main className="main">
        <div className="map-area">
          <MapCanvas
            provinces={provinces}
            centres={centres}
            armies={armies}
            buildings={buildings}
            anchors={anchors}
            mode={ui.mode}
            width={activeMap.width}
            height={activeMap.height}
            view={ui.view}
            ownershipVersion={ui.ownershipVersion}
            selectedProvince={ui.selectedProvince}
            capitalProvinceId={view.self.capitalProvinceId}
            battleProvinces={battleProvinces}
            speed={speed}
            tick={state.tick}
            ticksPerDay={ticksPerDay}
            onSelect={selectOnMap}
            // Ein Klick nahe einem eigenen Marker waehlt die Armee (T-M22-06, V2-14) —
            // ausser waehrend der Zielwahl: dort ist jeder Klick eine Ortswahl.
            {...(targeting
              ? {}
              : {
                  onSelectArmy: (armyId: string) => {
                    dispatch({ type: 'selectArmy', id: armyId })
                  },
                })}
            onViewChange={(next) => dispatch({ type: 'setView', view: next })}
            labelFor={nameOfProvince}
          />
          {/* Der Schluessel gehoert zu seiner Karte, nicht in die Seitenleiste. */}
          <Legend mode={ui.mode} />
        </div>

        <aside className="side">
          <ProvincePicker
            own={ownProvinces}
            others={knownProvinces}
            value={ui.selectedProvince}
            onChange={(id) => {
              setTargeting(null)
              if (id) tutor('selectProvince')
              dispatch({ type: 'selectProvince', id })
            }}
          />
          <Alerts alerts={alerts} onJump={jumpTo} />
          {ui.notice && <p className={`notice notice--${ui.notice.kind}`}>{ui.notice.text}</p>}
          {ui.panel === 'province' && (
            <ProvincePanel
              province={selected}
              ownerName={selected?.owner ? nameOf(selected.owner) : null}
              ownerColor={selected?.owner ? colorOf(selected.owner) : null}
              actions={provinceActions}
              groups={provinceGroups}
              armies={armiesHere}
              selectedArmy={ui.selectedArmy}
              onSelectArmy={(id) => {
                setTargeting(null)
                dispatch({ type: 'selectArmy', id })
              }}
              isCapital={selected?.id === view.self.capitalProvinceId}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'army' && (
            <ArmyPanel
              army={selectedArmy}
              name={ui.selectedArmy ? state.armies[ui.selectedArmy]?.name : undefined}
              units={armyUnitItems}
              actions={armyActionList}
              targeting={armyTargeting}
              pendingNotice={armyPendingNotice}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'diplomacy' && (
            <DiplomacyPanel
              view={view}
              nameOf={nameOf}
              actionsFor={(playerId) => diplomacyActions(ctx, playerId).map((spec) => toAction(spec))}
            />
          )}
          {ui.panel === 'standings' && <StandingsPanel view={view} nameOf={nameOf} timeline={timeline} />}
          {ui.panel === 'market' && (
            <MarketPanel
              resources={RESOURCE_KEYS}
              stock={view.self.resources}
              preview={(give, giveAmount, want) => {
                const result = tradePreview(ctx, give, giveAmount, want)
                return { text: result.text, action: toAction(result.action) }
              }}
            />
          )}
          <EconomyPanel view={view} timeline={timeline} expenses={expenses} />
          <DebugPanel
            enabled={ui.settings.debug}
            // Auch das Debug spricht Namen (T-M28-04, V2-12): die App kennt sie.
            nameOf={nameOf}
            info={{ tick: state.tick, hash: debugHash, aiGoals: trace.goals, commands: trace.commands }}
          />
        </aside>
      </main>

      <EventLog entries={events} ticksPerDay={ticksPerDay} onJump={jumpTo} />

      <Tutorial
        state={tutorial}
        rules={props.rules}
        ticksPerDay={ticksPerDay}
        onDismiss={() => {
          setTutorial(dismissTutorial())
          rememberTutorialSeen()
        }}
      />

      {/* Das Menue: Neue Partie / Spielstaende / Einstellungen — auch aus der
          laufenden Partie (T-M22-04, Befund V2-05). */}
      {dialog === 'menu' && (
        <MenuDialog
          onNewGame={() => setDialog('new')}
          onSaves={() => setDialog('saves')}
          onSettings={() => setDialog('settings')}
          onClose={() => setDialog(null)}
        />
      )}
      {newGameDialog}
      {dialog === 'settings' && (
        <SettingsDialog
          settings={ui.settings}
          onChange={(settings: Partial<Settings>) => dispatch({ type: 'changeSettings', settings })}
          onReset={() => dispatch({ type: 'resetSettings' })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'saves' && (
        <SavesDialog
          slots={slots}
          notice={saveNotice}
          onSave={(name) => {
            void saveTo(storage, name, state).then(async () => {
              // Die Zeitreihe wandert je Slot mit (T-M25-01) — best effort: ein
              // Fehlschlag hier macht den gespeicherten Stand nicht ungültig.
              await saveTimeline(storage, name, timeline).catch(() => undefined)
              setSaveNotice(t('saves.saved'))
              setSlots(await listSlots(storage, ticksPerDay))
            })
          }}
          onLoad={loadSave}
          onClose={() => {
            setSaveNotice(null)
            setDialog(null)
          }}
        />
      )}
      {dialog === 'keys' && <KeyboardHelp onClose={() => setDialog(null)} />}

      {/* Die Partie ist entschieden: einmal sagen, die Uhr anhalten, und den Blick auf
          die Karte freigeben, wenn der Spieler ihn will (R-UI-13). */}
      {(view.victory.winner !== null || !view.self.alive) && !victoryAcknowledged && (
        <VictoryDialog
          view={view}
          nameOf={nameOf}
          ticksPerDay={ticksPerDay}
          onClose={() => setVictoryAcknowledged(true)}
          onNewGame={() => {
            // Der Weg zurueck zum Startdialog (T-M14-10, Befund 37; berichtigt T-M12-04
            // nach dem Playtest vom 2026-09-06).
            //
            // `setState(null)` ist der Kern der Sache, nicht Aufraeumen: den
            // NewGameDialog zeichnet genau EINE Stelle, und die liegt hinter dem
            // Fruehausstieg `if (!state || !view || !ctx)` weiter oben. Der Hauptbaum
            // kennt nur 'settings', 'saves' und 'keys'. Ohne diese Zeile war
            // `dialog === 'new'` ein Zustandswert, den niemand zeichnet — der
            // Endedialog verschwand, kein Startdialog kam, und der Spieler stand in
            // der beendeten Partie fest.
            //
            // Die Flagge muss zurueck auf false, sonst meldet die ZWEITE Partie ihr
            // eigenes Ende nie: sie wird sonst nirgends zurueckgesetzt.
            setVictoryAcknowledged(false)
            setState(null)
            setDialog('new')
          }}
        />
      )}
    </div>
  )
}
