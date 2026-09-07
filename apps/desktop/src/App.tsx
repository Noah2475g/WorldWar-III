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
import { dominantIcon } from './map/markers.ts'
import { strengthByProvince } from './map/modes.ts'
import { boundsOf, centreOn, clampView } from './map/picking.ts'
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
import { PAN_STEP, isTypingTarget, resolveKey } from './keyboard.ts'
import { describeEvent } from './game/events.ts'
import { advanceWithTrace } from './game/advance.ts'
import { duration } from './ui/format.ts'
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
import { autosaveDue, latestSlot, listSlots, loadFrom, saveTo, type LatestSave, type SlotInfo } from './game/saves.ts'
import { writeAutosave, HASH_OMIT_KEYS, type AutosaveState } from '@worldwar/core'
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

  /** A step of the guided start ends because the player did the thing it asked for. */
  const tutor = useCallback((action: TutorialTrigger) => {
    setTutorial((current) => advanceTutorial(current, action))
  }, [])

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
    void writeAutosave(storage, autosave, state, at)
      .then((next) => {
        setAutosave(next)
        setSaveNotice(t('saves.autosaved'))
      })
      .finally(() => {
        writingAutosave.current = false
      })
  }, [state, autosave, ui.settings.autosaveMinutes, ticksPerDay, storage, now])

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

  /** Gebaeude je Provinz — nur die eigenen sind bekannt (R-DIP-04). */
  const buildings = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const province of view?.provinces ?? []) {
      const total = Object.values(province.buildings ?? {}).reduce((sum, level) => sum + (level ?? 0), 0)
      if (total > 0) counts[province.id] = total
    }
    return counts
  }, [view])

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
        const naechste = army.path?.[0]
        const march =
          naechste && army.departureTick != null && army.arrivalTick != null
            ? { toProvinceId: naechste, departureTick: army.departureTick, arrivalTick: army.arrivalTick }
            : undefined
        return {
          id: army.id,
          provinceId: army.provinceId,
          owner: army.owner,
          strength: army.strength,
          own: army.owner === 'p1',
          ...(icon ? { icon } : {}),
          ...(march ? { march } : {}),
        }
      }),
    [view],
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

  /**
   * Der Weg der gewaehlten Armee, als Linie auf der Karte (R-UI-12).
   *
   * Die Ebene dafuer gibt es in `MapCanvas` seit M10 — befuellt hat sie nie jemand, und
   * damit war der Marschbefehl das einzige, was man gab, ohne zu sehen, wohin.
   */
  /** Wie viele Zeilen das Protokoll je Rubrik vorhält. */
  const LOG_LINES = 40

  /** Wie viele Befehlszeilen die Debug-Ansicht vorhält. */
  const TRACE_LINES = 50

  /** Obergrenze eines Vorspulvorgangs: 30 Spieltage, damit ein nie eintretendes Ziel endet. */
  const MAX_FAST_FORWARD_TICKS = 30 * ticksPerDay

  const selectedPath = useMemo(() => {
    const army = view?.armies.find((a) => a.id === ui.selectedArmy)
    if (!army?.path || army.path.length === 0) return undefined
    return [army.provinceId, ...army.path]
  }, [view, ui.selectedArmy])

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

  /** One game hour, AI included. */
  const step = useCallback(
    (ticks: number) => {
      setState((current) => {
        if (!current) return current
        if (!debugOn) return advance(current, ticks, { map: activeMap, rules: props.rules })

        const result = advanceWithTrace(current, ticks, { map: activeMap, rules: props.rules })
        noteTrace({
          tick: current.tick,
          commands: result.applied.map((entry) => entry.command),
          explanations: result.explanations,
        })
        return result.state
      })
    },
    [activeMap, props.rules, debugOn, noteTrace],
  )

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

      const request = { target, alertsFor: viewerId, maxTicks: MAX_FAST_FORWARD_TICKS }
      let ticksRun = 0

      const chunk = (): void => {
        setState((current) => {
          if (!current) return current
          if (abortFastForward.current) {
            setFastForward({ running: false, ticksRun, reason: 'aborted', trigger: null })
            return current
          }

          const result = fastForwardChunk(
            current,
            request,
            { map: activeMap, rules: props.rules },
            MAX_FAST_FORWARD_TICKS - ticksRun,
            debugOn ? noteTrace : undefined,
          )
          ticksRun += result.ticksRun

          // `limit` innerhalb eines Haeppchens heisst nur "Haeppchen zu Ende", nicht
          // "Ziel unerreichbar" — weitergerechnet wird, bis die Gesamtobergrenze steht.
          const weiter = result.stoppedBy === 'limit' && ticksRun < MAX_FAST_FORWARD_TICKS
          if (weiter) {
            setFastForward({ running: true, ticksRun, reason: null, trigger: null })
            setTimeout(chunk, 0)
          } else {
            setFastForward({ running: false, ticksRun, reason: result.stoppedBy, trigger: result.trigger })
          }
          return result.state
        })
      }

      chunk()
    },
    [activeMap, props.rules, debugOn, noteTrace],
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

  const send = useCallback(
    (command: Command) => {
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
      setState((current) =>
        current ? advance(current, 1, { map: activeMap, rules: props.rules }, [command]) : current,
      )
    },
    [state, ctx, activeMap, props.rules],
  )

  /** A description becomes a button: orders are sent, target orders open target mode. */
  const toAction = useCallback(
    (spec: ActionSpec, armyId?: string): Action => ({
      id: spec.id,
      label: spec.label,
      disabledReason: spec.disabledReason,
      ...(spec.icon ? { icon: spec.icon } : {}),
      ...(spec.explainKey ? { explainKey: spec.explainKey } : {}),
      ...(spec.hint ? { hint: spec.hint } : {}),
      onRun: () => {
        if (spec.id.startsWith('build-')) tutor('openBuild')
        if (spec.targetKind && armyId) {
          // The army panel itself says "choose a target" — one notice, not two.
          setTargeting({ armyId, kind: spec.targetKind, target: null })
          dispatch({ type: 'clearNotice' })
        } else if (spec.command) {
          send(spec.command)
        }
      },
    }),
    [send, tutor],
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
      .map((event, index) => describeEvent(event, index, activeMap, naming))
  }, [state, activeMap, nameOf, ticksPerDay])

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
    const time = duration(ticksRun, ticksPerDay)
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
            if (confirmSpec.command) send(confirmSpec.command)
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
            {...(selectedPath ? { path: selectedPath } : {})}
            onSelect={selectOnMap}
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
          {ui.panel === 'standings' && <StandingsPanel view={view} nameOf={nameOf} />}
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
          <EconomyPanel view={view} />
          <DebugPanel
            enabled={ui.settings.debug}
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
