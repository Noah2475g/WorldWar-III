import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  RESOURCE_KEYS,
  canApply,
  eventsFor,
  worldEventsIn,
  publicView,
  MAX_DEPART_DELAY_DAYS,
  type Command,
  type GameState,
  type MapData,
  type Rules,
  type FastForwardTarget,
  type GameEvent,
  type StopReason,
  type StoragePort,
} from '@worldwar/core'
import { advanceStep } from './game/advance.ts'
import { RESUME_SPEED } from './game/speed.ts'
import { clockStep } from './game/clock.ts'
import { fastForwardChunk } from './game/fastForward.ts'
import {
  armyActions,
  buildActions,
  cancelActions,
  capitalAction,
  diplomacyActions,
  ownArmiesIn,
  planArrival,
  nextUnlock,
  recruitActions,
  targetAction,
  tradePreview,
  unitCounts,
  type ActionContext,
  type ActionSpec,
} from './game/actions.ts'
import { describeRejection } from './game/rejections.ts'
import { t } from './i18n/text.ts'
import { INITIAL_UI, defaultViewer, loadSettings, saveSettings, uiReducer, type Settings } from './state/uiState.ts'
import { MapCanvas, type ArmyMarker } from './map/MapCanvas.tsx'
import { dominantIcon, stackSummary, type BuildingsByProvince } from './map/markers.ts'
import { anchorsFor } from './map/anchors.ts'
import { relationKindFor, strengthByProvince } from './map/modes.ts'
import { boundsOf, centreOn, clampView, toScreen, zoomAt } from './map/picking.ts'
import { Tooltip, tooltipFor } from './ui/Tooltip.tsx'
import { Foot, latestReport } from './ui/Foot.tsx'
import { standingsRows } from './ui/Standings.tsx'
import { Dialog } from './ui/Dialogs.tsx'
import { DeltaBar } from './ui/charts/DeltaBar.tsx'
import { rate } from './ui/format.ts'
import { Header } from './ui/Header.tsx'
import {
  ArmyPanel,
  DiplomacyPanel,
  EconomyPanel,
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
  JoinDialog,
  KeyboardHelp,
  LobbyDialog,
  MenuDialog,
  NewGameDialog,
  SavesDialog,
  SettingsDialog,
  fontScaleStyle,
  type DebugInfo,
} from './ui/Dialogs.tsx'
import {
  DEFAULT_NEW_GAME,
  aiBonusPercent,
  fixedSpeedOf,
  gameModesFor,
  invitationOf,
  startGame,
  toConfig,
  DEFAULT_MULTIPLAYER_SPEED,
  type GameMode,
  type NewGameOptions,
} from './game/newGame.ts'
import { PAN_STEP, ZOOM_STEP, isTypingTarget, resolveKey } from './keyboard.ts'
import type { Transport } from '@worldwar/netplay'
import { guestLinkOf, type NetLink } from './net/link.ts'
import { configOfState, useParty, type PartyView } from './net/party.ts'
import { takeOverSeat, useNetplay, type NetplaySession } from './net/useNetplay.ts'
import {
  adjutantMarchEntries,
  dayExpenses,
  dayReportBody,
  dayReportDeltas,
  describeEvent,
  openIntrusion,
  priceSeries,
} from './game/events.ts'
import { advanceWithTrace } from './game/advance.ts'
import { durationDative } from './ui/format.ts'
import { createStorage } from './storage/createStorage'
import { UNIT_ICONS } from './ui/icons.tsx'
import type { IconItem } from './ui/IconRow.tsx'
import { Tutorial } from './ui/Tutorial.tsx'
import { Legend } from './ui/Legend.tsx'
import { StandingsPanel, VictoryDialog } from './ui/Standings.tsx'
import { Alerts, alertsFor } from './ui/Alerts.tsx'
import { cueForOwnEvents, play } from './ui/sound.ts'
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
  resumeStateFor,
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
  /**
   * Wer an diesem Bildschirm spielt (T-M37-01, R-MP-01, D28.3).
   *
   * Ohne Angabe die erste menschliche Macht des Standes — im Einzelspieler also der
   * Spieler, wie bisher. Im Spiel zu zweit bekommt der Gast hier seinen Platz; ohne
   * diesen Wert sähe er die Welt seines Gegners, mit dessen Rohstoffen und dessen Armeen.
   */
  viewerId?: string
  /** The wall clock, for the real-time half of the autosave rule. Injectable for tests. */
  now?: () => number
  /**
   * Die laufende Partie zu zweit (T-M37-11, D28.4).
   *
   * Ohne Angabe läuft alles wie bisher: die Uhr hängt an `requestAnimationFrame`, das
   * Tempo am Regler. Mit einer Sitzung treibt der **Gleichschritt** die Uhr — ein Tick
   * läuft, wenn beide Befehlslisten da sind, und sonst nicht. Den Transport dahinter baut
   * M38; die Naht liegt hier, damit sie schon jetzt gemessen werden kann.
   */
  netplay?: NetplaySession
  /**
   * Die Einladung aus dem Fragment und die Leitung dahinter (T-M39-02, T-M39-03).
   *
   * Ohne Angabe gibt es keinen Beitritt: das Spiel startet im Einzelspieler, und der
   * Anlegedialog ist der erste Bildschirm. `main.tsx` liest den Link und reicht die
   * Leitung herein — sie ist im ausgelieferten Tauri-Bau gar nicht erst im Buendel
   * (Bauflagge `WORLDWAR_MULTIPLAYER`, T-M39-04).
   */
  party?: { link: NetLink; connect: (url: string) => Transport; origin?: string }
}

interface PendingTarget {
  armyId: string
  kind: 'move' | 'bombard'
  target: string | null
  /** Tage, die der Abmarsch wartet (T-M32-01); 0 ist der alte Befehl ohne das Feld. */
  delayDays: number
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
    // Der Platz kommt von aussen oder bleibt offen (T-M37-01): offen heisst „die erste
    // menschliche Macht dieses Standes", nicht „niemand".
    viewerId: props.viewerId ?? null,
  }))

  // Und zurueckgeschrieben wird, sobald sich etwas aendert.
  useEffect(() => {
    saveSettings(ui.settings)
  }, [ui.settings])
  const [options, setOptions] = useState<NewGameOptions>({
    ...DEFAULT_NEW_GAME,
    nation: props.map.startPositions[0]?.nation ?? '',
    // Wer ueber `#/gastgeben` kommt, will eine Partie zu zweit — die Partieart als
    // Vorgabe zu lassen hiesse, ihn einen Schalter suchen zu lassen, den er gerade
    // beantwortet hat (T-M39-03).
    ...(props.party?.link.role === 'host' ? { mode: 'multiplayer' as const } : {}),
  })
  const [state, setState] = useState<GameState | null>(null)
  // Synchron gepflegter Spiegel fuer Ablaeufe ausserhalb des Renderzyklus (Vorspulen):
  // sie duerfen nicht im setState-Updater rechnen (StrictMode ruft Updater doppelt).
  const stateRef = useRef<GameState | null>(null)
  stateRef.current = state

  /**
   * Einen gerechneten Stand zurueckschreiben — Spiegel UND Zustand (T-M41-17).
   *
   * Bis zum 2026-09-14 schrieb `step` nur `setState(result.state)`. `stateRef.current`
   * wurde ausschliesslich im Render nachgezogen, also erst nach dem naechsten Commit von
   * React. Kam das naechste Bild vorher — im Entwicklungsbau der Regelfall, weil ein
   * Commit dort teuer ist und `StrictMode` doppelt rendert —, rechnete es noch einmal aus
   * demselben Stand und ueberschrieb das Ergebnis des vorigen, statt es fortzusetzen.
   * Gemessen am Dev-Server (Sichtpruefung vom 2026-09-14, Punkt 1): 127 Bilder,
   * `clockStep` verlangte 635 Ticks, angekommen sind 325; 65 Commits, jeder genau 5 Ticks
   * — die Kappe eines einzigen Bildes. Dieselbe Partie im gebauten Buendel verlor nichts.
   *
   * Der Updater `setState((s) => advance(s, …))` waere die andere Reparatur und ist hier
   * die falsche: dieses Haus hat die Rechnung zweimal ABSICHTLICH aus dem Updater geholt
   * (T-M22-05 und der Befund vom 2026-09-08 im Vorspulen). Ein Updater muss pur sein,
   * StrictMode ruft ihn doppelt, und an derselben Rechnung haengen `noteTrace`,
   * `noteMarches` und die eingesammelten Befehle. Der Spiegel, den der Schritt selbst
   * fortschreibt, ist dagegen genau das Muster, das die Huelle schon zweimal fuehrt:
   * `pendingRef` neben `pendingCommands`, und das Vorspulen, das seinen Stand von
   * Haeppchen zu Haeppchen von Hand weiterreicht.
   *
   * Die Zuweisung im Render bleibt: sie ist der Abgleich mit dem, was React wirklich
   * haelt, und schreibt denselben Wert noch einmal.
   */
  const commitState = useCallback((next: GameState | null) => {
    stateRef.current = next
    setState(next)
  }, [])

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

  /**
   * Die laufende Partie, so weit die Hülle sie kennt (T-M37-03, R-MP-02, C-11, D28.4).
   *
   * Partieart und feste Rate stehen **hier** und nicht im `GameState`: der Zustand ist die
   * Welt, nicht die Betrachtung der Welt. C-11 hat die Geschwindigkeit am 2026-09-04 aus
   * dem Kern verbannt, R-ARCH-04/AK2 hält das grün — läge sie im Zustand, wanderte sie in
   * jeden Spielstand und in jede Prüfsumme, und zwei Spieler mit demselben Stand bekämen
   * verschiedene Hashes, weil einer schneller zusieht.
   *
   * Getrennt von `options`: das Formular darf sich ändern, die laufende Partie nicht.
   */
  const [party, setParty] = useState<{ mode: GameMode; fixedSpeed: number | null }>({
    mode: 'single',
    fixedSpeed: null,
  })
  const multiplayer = party.mode === 'multiplayer'
  /**
   * Laeuft eine Partie zu zweit ueber den Gleichschritt (T-M37-11)?
   *
   * Frueh und aus den Eigenschaften gelesen, nicht aus dem Haken: die ehrliche Uhr und
   * die Bildschleife weiter unten muessen es wissen, und beide stehen vor ihm.
   */
  /**
   * Die Partie zu zweit ist vorbei — abgebrochen oder übernommen (T-M38-10, R-MP-08).
   *
   * Eine Eigenschaft lässt sich nicht zurücknehmen, ein Zustand schon. Ab hier läuft alles
   * wieder wie im Einzelspieler: die Bildschleife, das Tempo, das Vorspulen — und der
   * Gleichschritt bekommt `session: null`, hört auf zu senden und lässt die Uhr los.
   */
  const [netplayOver, setNetplayOver] = useState(false)

  /**
   * Vom Link zur laufenden Partie (T-M39-02, T-M39-03).
   *
   * Der Haken baut die Leitung, fuehrt den Handschlag und uebergibt danach an
   * `useNetplay`. Ohne Link im Fragment ruht er vollstaendig — `phase: 'idle'`.
   */
  /**
   * Der eigene gespeicherte Stand — die Haelfte des Vergleichs beim Fortsetzen
   * (T-M39-06, R-MP-13/AK1).
   *
   * Nur geladen, wenn ueberhaupt ein Link im Fragment steht; im Einzelspieler gibt es
   * nichts zu vergleichen. `null` heisst „ich habe keinen" und ist keine Stoerung: dann
   * rechnet diese Seite vom Anfang, der Unterschied faellt im Handschlag auf, und der
   * Stand des Gastgebers wird uebertragen.
   */
  const [partySaved, setPartySaved] = useState<GameState | null>(null)

  const netParty: PartyView = useParty({
    link: props.party?.link ?? null,
    connect: props.party?.connect ?? null,
    origin: props.party?.origin ?? globalThis.location?.origin ?? '',
    mapById: (id) => mapById(id),
    rules: props.rules,
    savedState: partySaved,
  })

  const netplaySession = netplayOver ? null : (props.netplay ?? netParty.session)
  const netplayActive = netplaySession != null
  /**
   * Die Partie ist verabredet, aber noch nicht freigegeben (T-M39-03).
   *
   * Zwischen „der Gastgeber hat angelegt" und „beide rechnen" darf die Uhr **nicht**
   * laufen: der Host haette sonst schon Ticks hinter sich, wenn der Gast beitritt, und der
   * Handschlag verglichen zwei Startzustaende, von denen einer keiner mehr ist.
   */
  const partyPending = netParty.active && netParty.phase !== 'playing' && netParty.phase !== 'idle'

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
  const [dialog, setDialog] = useState<
    'new' | 'menu' | 'saves' | 'settings' | 'keys' | 'report' | 'netplayEnd' | null
  >('new')
  /** Bis zu welchem Tick der Spieler das Protokoll zuletzt gesehen hat — die Neu-Marke (T-M31-03). */
  const [seenTick, setSeenTick] = useState(-1)
  /** Bis zu welchem Tick Einmarsch-Alarme quittiert sind (T-M28-06). */
  const [alarmSeenTick, setAlarmSeenTick] = useState(-1)
  /**
   * Weggeklickte Ankuendigungen und Freischaltungen (T-M41-12): Kennung → Tick des Klicks.
   * Ein Klick gilt bis zum Ende dieses Spieltags und nur ab dem Tick, an dem er fiel — ein
   * frueherer Stand, geladen oder neu, zeigt die Meldung wieder.
   */
  const [dismissedAlerts, setDismissedAlerts] = useState<ReadonlyMap<string, number>>(() => new Map())
  /**
   * Was die Automatik zuletzt von selbst marschieren liess (T-M40-13, Befund M3 der Durchsicht von M40).
   *
   * Aus den Befehlen, die `commandsForTick` der Automatik zuschreibt — ueber die Uhr wie ueber das
   * Vorspulen —, nicht aus einem Ereignis des Kerns: der Zustand, sein Hash und die Golden-Master
   * sehen davon nichts. Deshalb auch kein Teil des Spielstands; Laden und neue Partie leeren es.
   */
  const [adjutantMarches, setAdjutantMarches] = useState<readonly { tick: number; command: Command }[]>([])
  const noteMarches = useCallback((entries: readonly { tick: number; command: Command }[]) => {
    if (entries.length === 0) return
    // So viele wie das Protokoll Zeilen vorhaelt (LOG_LINES) — aeltere fielen dort ohnehin heraus.
    setAdjutantMarches((old) => [...old, ...entries].slice(-40))
  }, [])
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

  /**
   * Wer am Bildschirm sitzt (T-M37-01, R-MP-01, D28.3).
   *
   * Der eine Wert, der die neunzehn festen p1 dieser Datei abgeloest hat. Ohne ausdrueckliche
   * Wahl die erste menschliche Macht des Standes — im Einzelspieler dasselbe wie frueher,
   * im Spiel zu zweit fuer den Gast das Gegenteil von falsch.
   */
  const viewerId = useMemo(() => (state ? (ui.viewerId ?? defaultViewer(state)) : null), [state, ui.viewerId])

  // Mit Regeln, damit die Sicht die Tagesbilanz mitbringt (R-ECON-06).
  const view = useMemo(
    () => (state && viewerId ? publicView(state, viewerId, props.rules) : null),
    [state, viewerId, props.rules],
  )

  /**
   * Sound for what happened since the last look (T-M13-02, R-UI-04).
   *
   * Only the player's own share of the log is read — the fog of war applies to the ears
   * as well as to the eyes — and one tick produces at most one sound, the most urgent
   * one. Above ten game hours a second `play` stays silent by itself.
   */
  useEffect(() => {
    if (!state || !viewerId) return
    const own = eventsFor(state.eventLog, viewerId)
    // Eine neue Partie faengt mit einem leeren Protokoll an, und ein geladener Stand
    // kann kuerzer sein als der laufende. Ohne diese Zeile bleibt der Merker stehen und
    // die naechste Partie ist stumm, bis sie den alten Stand ueberholt hat (T-M21-02).
    if (own.length < soundedUpTo.current) soundedUpTo.current = 0
    const fresh = own.slice(soundedUpTo.current)
    soundedUpTo.current = own.length
    if (fresh.length === 0) return

    // Nur die eigenen Gefechte klingen (T-M28-08): oeffentliche Ereignisse sind lesbar,
    // aber nicht deshalb meine Sache.
    const cue = cueForOwnEvents(fresh, viewerId)
    if (cue) play(cue, { enabled: ui.settings.sound, speed }, props.audio)
  }, [state, viewerId, ui.settings.sound, speed, props.audio])

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
    if (!state || !view || !viewerId) return
    const own = eventsFor(state.eventLog, viewerId)
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
  }, [state, view, viewerId, ticksPerDay, props.rules])

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
    if (!state || !viewerId) return
    const own = eventsFor(state.eventLog, viewerId)
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
  }, [state, viewerId, tutorial])

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

  /**
   * Die gesammelten Befehle als Liste (T-M40-19, Befund N-5): der Folgebefehl der Garnison sieht einen Klick auf
   * „Verteidigung", der bei stehender Uhr noch wartet.
   */
  const pendingOrders = useMemo(() => pendingCommands.map((entry) => entry.command), [pendingCommands])

  /** Everything the order descriptions need, in one place. */
  const ctx: ActionContext | null = useMemo(
    () =>
      state && viewerId
        ? { state, map: activeMap, rules: props.rules, playerId: viewerId, ticksPerDay, pending: pendingOrders }
        : null,
    [state, viewerId, activeMap, props.rules, ticksPerDay, pendingOrders],
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
          relation:
            seen === undefined || !viewerId
              ? undefined
              : relationKindFor(seen.owner, viewerId, view?.relations ?? {}),
          polygons: province.polygons,
          bounds: boundsOf(province.polygons),
        }
      }),
    [activeMap.provinces, view, viewerId, strengths],
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
          own: army.owner === viewerId,
          ...(icon ? { icon } : {}),
          ...(summary ? { count: summary.count, condition: summary.condition } : {}),
          ...(relation ? { relation } : {}),
          ...(march ? { march } : {}),
        }
      }),
    [view, viewerId, props.rules],
  )

  /** Was gerade Aufmerksamkeit braucht: Kampf, Mangel, Aufstandsgefahr (R-UI-14). */
  const alerts = useMemo(() => {
    const aus = alertsFor(view, props.rules).filter((alert) => {
      const weggeklickt = dismissedAlerts.get(alert.id)
      if (weggeklickt === undefined || !view) return true
      // Nur am selben Spieltag und nicht vor dem Klick (T-M41-12).
      return view.tick < weggeklickt || Math.floor(view.tick / ticksPerDay) !== Math.floor(weggeklickt / ticksPerDay)
    })
    // Kein dauerhafter Speicher? Dann erfaehrt es der Spieler jetzt und nicht beim
    // naechsten Start (T-M14-08). Ein stiller Rueckfall auf den Arbeitsspeicher war
    // genau der Zustand, den diese Aufgabe behebt.
    if (chosen?.warning) {
      aus.unshift({ id: 'storage:volatile', kind: 'shortage', icon: 'warning', text: chosen.warning })
    }
    return aus
  }, [view, chosen, props.rules, dismissedAlerts, ticksPerDay])

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
        const result = advanceStep(current, ticks, { map: activeMap, rules: props.rules }, commands)
        noteMarches(result.adjutant)
        // Ueber `commitState`, nicht `setState`: das naechste Bild kann kommen, bevor React
        // eingespielt hat, und muss auf DIESEM Stand weiterrechnen (T-M41-17).
        commitState(result.state)
        return
      }
      const result = advanceWithTrace(current, ticks, { map: activeMap, rules: props.rules }, commands)
      noteTrace({
        tick: current.tick,
        commands: result.applied.map((entry) => entry.command),
        explanations: result.explanations,
      })
      noteMarches(result.adjutant)
      commitState(result.state)
    },
    [activeMap, props.rules, debugOn, noteTrace, noteMarches, takePending, now, commitState],
  )

  /**
   * Die ehrliche Uhr (T-M22-05, R-TIME-02, Befund V2-09): laeuft trotz eingestelltem
   * Tempo laenger als zwei Sekunden kein Tick — verdecktes Fenster, stehendes
   * `requestAnimationFrame` —, zeigt die Kopfleiste "Pausiert" statt des Tempos.
   */
  const hasGame = state !== null
  useEffect(() => {
    // Zu zweit sagt der Gleichschritt, warum die Uhr steht (T-M37-11): „warte auf
    // Mitspieler" ist die genauere Auskunft als „Pausiert", und zwei Meldungen
    // nebeneinander waeren eine zu viel.
    if (speed === 0 || !hasGame || netplayActive || partyPending) {
      setStalled(false)
      return
    }
    lastTickAt.current = now()
    const id = setInterval(() => {
      setStalled(now() - lastTickAt.current > STALL_AFTER_MS)
    }, STALL_CHECK_MS)
    return () => clearInterval(id)
  }, [speed, hasGame, netplayActive, partyPending, now])

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
      // Bis zum 2026-09-14 stand hier ein fest verdrahteter Platz samt einer toten
      // Pruefung darunter (T-M37-01). Jetzt kommt er von oben, und die Pruefung lebt.
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

        // Der Stand reist mit (T-M41-15): ein Zählziel gilt für den ganzen Lauf, nicht je Häppchen.
        const result = fastForwardChunk(
          current,
          { ...request, playerCommands, ticksRunBefore: ticksRun },
          { map: activeMap, rules: props.rules },
          MAX_FAST_FORWARD_TICKS - ticksRun,
          debugOn ? noteTrace : undefined,
        )
        playerCommands = []
        ticksRun += result.ticksRun
        // Was die Automatik in diesem Häppchen befahl, ins Protokoll (T-M40-13).
        noteMarches(result.adjutant)
        // Der Spiegel zieht mit (T-M41-17). Das naechste Haeppchen bekommt seinen Stand
        // ohnehin von Hand; aber ein Vorspulen, das mitten im Lauf endet, darf `stateRef`
        // nicht auf dem Stand vor dem letzten Haeppchen zuruecklassen.
        commitState(result.state)

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
    [viewerId, activeMap, props.rules, debugOn, noteTrace, noteMarches, takePending, commitState],
  )

  // The clock (design D5, T-M41-04). `clockStep` caps what a single frame may credit, so
  // when the machine cannot keep up the rate drops, but no backlog builds that would
  // freeze the game later — and, unlike the old `Math.min(2, …)`, the fraction of a tick
  // survives the cap: speed 100 is 100 ticks per second at 30, 60 or 144 frames.
  //
  // The loop must not restart on every tick. Until 2026-09-13 it depended on `state`:
  // every step set a new state, the effect restarted, and `owed` began again at zero.
  // Measured under jsdom (App.test.tsx, T-M41-04), speed 100 at 60 frames ran 60 game
  // hours per second and speed 50 at 30 frames ran 30. It now depends only on the speed
  // and on whether a game runs, and reaches the current `step` through a ref.
  // `hasGame` is the same flag the stall display above uses.
  /**
   * Der Gleichschritt treibt die Uhr, sobald eine Partie zu zweit läuft (T-M37-11, D28.4).
   *
   * Im Einzelspieler ist `session` null, der Haken tut nichts, und die Schleife darunter
   * bleibt Zeile für Zeile, wie sie war.
   */
  /**
   * Der Hinweis „Ihr Mitspieler ist fort" wurde weggeklickt (T-M38-09, R-MP-07/AK2).
   *
   * Nur bis zum nächsten Tick: kommt die Gegenseite zurück und steht die Uhr danach
   * wieder, ist das eine neue Lage und verdient eine neue Meldung. Ein „Weiter warten",
   * das für immer gilt, wäre ein Schalter zum Abschalten der einzigen Auskunft.
   */
  const [peerLostDismissed, setPeerLostDismissed] = useState(false)

  const netplay = useNetplay({
    session: netplaySession,
    speed: party.fixedSpeed ?? 0,
    now,
    onTick: (next, applied) => {
      commitState(next)
      setPeerLostDismissed(false)
      // Die Quittung am Knopf endet, wenn der Befehl wirklich gewirkt hat (T-M22-05) —
      // nicht schon beim naechsten Tick: zu zweit liegen zwei Ticks dazwischen.
      if (applied.length > 0) {
        pendingRef.current = pendingRef.current.filter((entry) => !applied.includes(entry.command))
        setPendingCommands(pendingRef.current)
      }
    },
  })

  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    // Zu zweit gibt es keine zweite Uhr daneben (T-M37-11): der Gleichschritt gibt den
    // Takt, und ein rAF-Lauf darueber rechnete Ticks, die niemand freigegeben hat.
    if (speed === 0 || !hasGame || netplay.active || partyPending) return
    let running = true
    let last = performance.now()
    let owed = 0

    const frame = () => {
      if (!running) return
      const now = performance.now()
      const next = clockStep(owed, now - last, speed)
      last = now
      owed = next.owed
      if (next.due > 0) stepRef.current(next.due)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return () => {
      running = false
    }
  }, [speed, hasGame, netplay.active, partyPending])

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
    (command: Command, actionId?: string): boolean => {
      if (!state || !ctx) return false
      const result = canApply(state, command, {
        map: activeMap,
        rules: props.rules,
        commands: [command],
        events: [],
      })
      if (!result.ok) {
        dispatch({ type: 'notice', text: describeRejection(result, command, ctx) })
        return false
      }
      // Zu zweit geht der Befehl in den Gleichschritt und gilt fuer tick + 2 (T-M37-11).
      // Die Quittung am Knopf funktioniert unveraendert — sie endet, wenn der Befehl
      // wirklich gewirkt hat, statt nach dem naechsten Tick.
      if (netplay.active) netplay.give(command)
      pendingRef.current = [...pendingRef.current, { actionId: actionId ?? '', command }]
      setPendingCommands(pendingRef.current)
      return true
    },
    [state, ctx, activeMap, props.rules, netplay],
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
      // Das Bild, wo die Aktion eines fuehrt (T-M33-02): der Knopf zeichnet dann den
      // Schattenriss statt der Glyphe.
      ...(spec.art ? { art: spec.art } : {}),
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
          setTargeting({ armyId, kind: spec.targetKind, target: null, delayDays: 0 })
          dispatch({ type: 'clearNotice' })
        } else if (spec.command) {
          // Ein Knopf mit zwei Befehlen (T-M40-11): „Anhalten" einer Verteidigung stellt sie auch auf
          // Garnison. Beide gehen in denselben naechsten Tick, in der Reihenfolge des Knopfs — der zweite
          // nur, wenn die Vorpruefung in `send` den ersten annimmt (T-M40-14). Der Kern kann den ersten im
          // Tick trotzdem ablehnen; der zweite gilt dann allein (Befund N-4, PROBLEME.md).
          if (send(spec.command, spec.id) && spec.followUp) send(spec.followUp, spec.id)
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
        // Waehrend eines Laufs keine Uhr und kein zweiter Lauf (T-M41-13).
        fastForwarding: fastForwardState.running,
        // Zu zweit gehoert die Zeit dem Gleichschritt (T-M37-04, R-MP-02/AK2).
        multiplayer,
      })
      if (!shortcut) return
      event.preventDefault()

      switch (shortcut.type) {
        case 'togglePause':
          // Fortsetzen achtet die eingestellte Hoechstgeschwindigkeit (T-M28-09,
          // Befund 11): fest 10 lief bei einem Maximum von 2 fuenffach zu schnell.
          setSpeed((current) => (current === 0 ? Math.min(RESUME_SPEED, ui.settings.maxSpeed) : 0))
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
          // Der Tooltip geht zuerst (T-M31-01); die Kaskade darunter bleibt, wie sie war.
          setTooltipHidden(true)
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
        case 'multiplayerLocked':
          // Die Leertaste wird zum Pausenantrag, sobald wirklich ein Mitspieler da ist
          // (T-M37-11, D28.7). Ohne Sitzung bleibt es beim Hinweis.
          if (shortcut.control === 'pause' && netplay.active) {
            netplay.requestPause()
            break
          }
          // Die Taste tut nichts — aber sie verschwindet nicht stillschweigend
          // (T-M37-04, R-MP-02/AK2). Wer drueckt, bekommt den Grund zu lesen.
          dispatch({
            type: 'notice',
            kind: 'info',
            text:
              shortcut.control === 'fastForward'
                ? t('header.fastForwardLockedMultiplayer')
                : shortcut.control === 'pause'
                  ? t('header.pauseNeedsConsent')
                  : t('header.speedLockedMultiplayer'),
          })
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
  }, [
    speed,
    ui.mode,
    ui.view,
    ui.settings.maxSpeed,
    dialog,
    step,
    ticksPerDay,
    activeMap,
    state,
    targeting,
    tutor,
    fastForwardState.running,
    multiplayer,
    netplay,
    // Der Effekt ruft `fastForwardRun` (Taste F). Ohne diese Zeile hinge die Mitschrift der
    // Debug-Ansicht daran, dass zufaellig eine andere Abhaengigkeit den Effekt neu bindet (T-M41-16).
    fastForwardRun,
  ])

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
          // Quittierte Alarme und gelesene Protokollzeilen gehoeren zur alten Partie.
          // Ohne das Zuruecksetzen vergleicht die Oberflaeche Ticks aus zwei Partien:
          // ein Einmarsch an Tag 5 des geladenen Standes bliebe stumm, weil in der
          // vorigen Partie schon Tag 30 quittiert war (Durchsicht vom 2026-09-11).
          setAlarmSeenTick(-1)
          setSeenTick(-1)
          setDismissedAlerts(new Map())
          // Die Zeilen der Automatik gehoeren zur alten Partie (T-M40-13).
          setAdjutantMarches([])
          // Ein geladener Stand ist eine Einzelspielerpartie — es sei denn, dieser
          // Bildschirm ist ein Gastgeber (T-M39-06, R-MP-13). Dann wird der Stand
          // ANGEBOTEN: der Gast vergleicht ihn mit seinem eigenen, und nur bei einer
          // Abweichung geht er ueber die Leitung (D28.11).
          const alsGastgeber = netParty.active && netParty.role === 'host'
          if (alsGastgeber) {
            netParty.offer(configOfState(result.state), DEFAULT_MULTIPLAYER_SPEED, result.state)
            setParty({ mode: 'multiplayer', fixedSpeed: DEFAULT_MULTIPLAYER_SPEED })
          } else {
            setParty({ mode: 'single', fixedSpeed: null })
          }
          setSpeed(0)
          commitState(result.state)
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
    [storage, ticksPerDay, mapById, now, commitState, netParty],
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
    // Partieart und feste Rate wandern aus dem Formular in die laufende Partie
    // (T-M37-03): ab hier ist die Rate im Mehrspieler unveraenderlich, und die Uhr
    // startet mit ihr, statt bei null zu stehen.
    const feste = fixedSpeedOf(options)
    setParty({ mode: options.mode, fixedSpeed: feste })
    // Zu zweit ueber einen Link legt der Gastgeber die Partie nur AN; laufen tut sie
    // erst, wenn er startet und der Handschlag durch ist (T-M39-03, R-MP-12/AK2). Bis
    // dahin bleibt die Uhr bei null, sonst haette er schon Ticks hinter sich, wenn der
    // Gast beitritt - und der Handschlag verglicht zwei Startzustaende, von denen einer
    // keiner mehr ist.
    const alsGastgeber = netParty.active && netParty.role === 'host'
    setSpeed(alsGastgeber ? 0 : (feste ?? 0))
    if (alsGastgeber) netParty.offer(toConfig(options, chosenMap), feste ?? DEFAULT_MULTIPLAYER_SPEED)
    // Ausstehende Befehle gehoeren zur alten Partie und verfallen (T-M22-05).
    pendingRef.current = []
    setPendingCommands([])
    // Die Aufzeichnung auch: eine neue Partie beginnt ohne Vergangenheit (T-M25-01).
    setTimeline([])
    // Und die Merker der Oberflaeche: quittierte Alarme und gelesene Protokollzeilen
    // zaehlen in Ticks, und die beginnen in der neuen Partie wieder vorne.
    setAlarmSeenTick(-1)
    setSeenTick(-1)
    setDismissedAlerts(new Map())
    setAdjutantMarches([])
    commitState(fresh)
    // The autosave clock starts now, not at the epoch — otherwise the
    // real-time half of the rule is satisfied before the first day is played
    // and the chosen interval never applies.
    setAutosave({ lastSavedTick: fresh.tick, lastSavedRealTime: now(), nextSlot: 0 })
    // Open on the player's own country rather than on the top-left corner of
    // the world — the first thing they look for is where they are.
    // Die Mitten kommen aus der gewaehlten Karte: der Merker `centres` haelt
    // auf diesem Durchlauf noch die alten und faende die neue Hauptstadt nicht.
    // Die eigene Hauptstadt — ueber `defaultViewer` und nicht ueber `players.p1`
    // (T-M37-01): im Spiel zu zweit wuerde der Gast sonst auf den Gegner blicken.
    const host = defaultViewer(fresh)
    const capital = host ? fresh.players[host]?.capitalProvinceId : undefined
    const centre = capital ? chosenMap.provinces.find((province) => province.id === capital)?.center : undefined
    if (centre) {
      dispatch({
        type: 'setView',
        view: centreOn(centre, { x: 0, y: 0, scale: 1.6 }, { width: chosenMap.width, height: chosenMap.height, ...VIEWPORT }),
      })
    }
    setDialog(null)
  }, [options, mapById, props.rules, now, commitState, netParty])

  // Den eigenen gespeicherten Stand einmal holen, sobald ein Link im Fragment steht
  // (T-M39-06). `ticksPerDay` und `storage` stehen weiter oben; geladen wird der juengste.
  useEffect(() => {
    if (!props.party) return
    let aktiv = true
    void resumeStateFor(storage, ticksPerDay).then((stand) => {
      if (aktiv) setPartySaved(stand)
    })
    return () => {
      aktiv = false
    }
  }, [props.party, storage, ticksPerDay])

  /**
   * Der Handschlag ist durch: beide Seiten legen mit demselben Stand los (T-M39-02/03).
   *
   * **Der Zustand geht nicht über die Leitung** (D28.2) — beide rechnen ihn aus derselben
   * Partiedefinition, und dass dabei bitgleich dasselbe herauskommt, hat die Probe gerade
   * gemessen. Was der Gastgeber hier bekommt, ist wertgleich mit dem, was `startNewGame`
   * ihm schon gegeben hat; der Gast bekommt seinen ersten Stand überhaupt.
   *
   * Einmal und nicht bei jedem Bild: `startedRef` merkt sich den Stand, mit dem es losging.
   */
  const startedRef = useRef<GameState | null>(null)
  useEffect(() => {
    const beginn = netParty.start
    if (!beginn || startedRef.current === beginn.state) return
    startedRef.current = beginn.state

    const karte = mapById(beginn.mapId)
    setActiveMap(karte)
    // Wer ich bin, kommt vom Platz im Raum und nicht von der Annahme p1 (T-M37-01):
    // der Gast saehe sonst die Welt seines Gegners.
    dispatch({ type: 'setViewer', id: beginn.seat })
    setParty({ mode: 'multiplayer', fixedSpeed: beginn.fixedSpeed })
    setSpeed(beginn.fixedSpeed)
    pendingRef.current = []
    setPendingCommands([])
    setTimeline([])
    setAlarmSeenTick(-1)
    setSeenTick(-1)
    setDismissedAlerts(new Map())
    setAdjutantMarches([])
    commitState(beginn.state)
    setAutosave({ lastSavedTick: beginn.state.tick, lastSavedRealTime: now(), nextSlot: 0 })
    setDialog(null)

    // Und der Blick auf die eigene Hauptstadt, wie beim Anlegen: das Erste, was ein
    // Spieler sucht, ist, wo er ist.
    const hauptstadt = beginn.state.players[beginn.seat]?.capitalProvinceId
    const mitte = hauptstadt ? karte.provinces.find((province) => province.id === hauptstadt)?.center : undefined
    if (mitte) {
      dispatch({
        type: 'setView',
        view: centreOn(mitte, { x: 0, y: 0, scale: 1.6 }, { width: karte.width, height: karte.height, ...VIEWPORT }),
      })
    }
  }, [netParty.start, mapById, now, commitState])

  /**
   * Der Beitritt und die Lobby (T-M39-02, T-M39-03, R-MP-12).
   *
   * Der Beitrittsbildschirm ist ein **zweiter Einstieg** in die Anwendung und kein
   * Sonderfall des ersten: der Gast hat keinen Spielstand, er hat einen Link. Der
   * Gastgeber sieht daneben, wer wartet, und startet — beides hört auf, sobald die Partie
   * läuft (`phase === 'playing'`).
   */
  const partyDialog =
    netParty.active && netParty.phase !== 'playing' && netParty.phase !== 'idle' ? (
      netParty.role === 'guest' ? (
        <JoinDialog
          terms={netParty.terms}
          mapName={netParty.terms ? mapById(netParty.terms.mapId).name : ''}
          phase={netParty.phase}
          reason={netParty.reason}
          joined={netParty.guestName !== null}
          onJoin={(name) => netParty.join(name)}
          onLeave={netParty.leave}
        />
      ) : netParty.offered || netParty.phase === 'refused' ? (
        <LobbyDialog
          guestLink={guestLinkOf(globalThis.location?.href ?? '')}
          guestName={netParty.guestName}
          offered={netParty.offered}
          phase={netParty.phase}
          reason={netParty.reason}
          onBegin={netParty.begin}
          onLeave={netParty.leave}
        />
      ) : null
    ) : null

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
        // Die Partiearten, die DIESER Bau herstellen kann (T-M39-11, Befund V-1).
        // Hier — und nur hier — wird die Bauflagge fuer die Oberflaeche gelesen: sie
        // deckte bis zum 2026-09-18 allein den Beitrittsweg in main.tsx, waehrend der
        // Waehler daneben in jedem Bau beide Arten anbot.
        modes={gameModesFor(__MULTIPLAYER__)}
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
        // Was ein Gast vor dem Beitritt saehe — samt der festen Rate (T-M37-03,
        // R-MP-02/AK1). Im Einzelspieler null: dort gibt es niemanden einzuladen.
        invitation={invitationOf(options, selectedMap)}
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
    if (!state || !view || !viewerId) return {}
    const own = eventsFor(state.eventLog, viewerId).filter(
      (event) => event.tick > view.tick - ticksPerDay && event.tick <= view.tick,
    )
    return dayExpenses(view, props.rules, own)
  }, [state, view, viewerId, ticksPerDay, props.rules])

  /**
   * Der Kursverlauf des Marktes (T-M32-02): aus den eigenen `TRADE_EXECUTED` im
   * Ereignisprotokoll, je Spieltag gemittelt. Das Protokoll ist ein Ringpuffer — die
   * Reihe reicht so weit zurück wie er, und das ist für eine Richtung genug.
   */
  const prices = useMemo(() => {
    if (!state || !viewerId) return {}
    return priceSeries(eventsFor(state.eventLog, viewerId), ticksPerDay)
  }, [state, viewerId, ticksPerDay])

  /**
   * Der offene Einmarsch-Alarm (T-M28-06, R-TIME-06): der jüngste `ARMY_INTRUDED`,
   * den der Spieler noch nicht quittiert hat.
   *
   * Der Kern hält das Vorspulen dort ohnehin an (`severity: 'alert'` plus `concerns`);
   * die Oberfläche sagt dazu, **wo** — Chip im Kopf, Zinnober-Ring auf der Karte.
   */
  const alarm = useMemo(() => {
    if (!state || !viewerId) return null
    const offen = openIntrusion(eventsFor(state.eventLog, viewerId), alarmSeenTick, state.tick)
    if (!offen) return null
    return {
      provinceId: offen.provinceId,
      provinceName: activeMap.provinces.find((p) => p.id === offen.provinceId)?.name ?? offen.provinceId,
      intruder: state.players[offen.intruderId]?.nation ?? offen.intruderId,
    }
  }, [state, viewerId, alarmSeenTick, activeMap.provinces])

  /** Player ids never reach the screen: the player knows nations, not "p2". */
  const nameOf = useCallback(
    (playerId: string): string => {
      if (!state) return playerId
      return state.players[playerId]?.nation ?? playerId
    },
    [state],
  )

  /**
   * Der Provinz-Tooltip (T-M31-01, D27.6): folgt dem Zeiger, sonst der Auswahl —
   * dieselbe Auskunft fuer Maus und Tastatur. Escape blendet ihn aus, bis sich
   * Auswahl oder Zeiger aendern.
   */
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [tooltipHidden, setTooltipHidden] = useState(false)
  const tooltipId = hover?.id ?? ui.selectedProvince
  const tooltip = useMemo(
    () =>
      tooltipHidden
        ? null
        : tooltipFor(tooltipId, view, { nameOf: nameOfProvince, playerName: nameOf, ticksPerDay }),
    [tooltipHidden, tooltipId, view, nameOfProvince, nameOf, ticksPerDay],
  )
  const tooltipAt = useMemo(() => {
    if (hover) return { x: hover.x, y: hover.y }
    const centre = ui.selectedProvince ? centres[ui.selectedProvince] : undefined
    return centre ? toScreen(centre, ui.view) : null
  }, [hover, ui.selectedProvince, centres, ui.view])
  useEffect(() => {
    setTooltipHidden(false)
  }, [tooltipId])
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
    if (!state || !viewerId) return []
    const naming = {
      player: nameOf,
      army: (id: string) => state.armies[id]?.name ?? id,
      ticksPerDay,
      viewer: viewerId,
    }
    // **Erst deuten, dann zuschneiden** (T-M15-09). Bis zum 2026-09-06 stand hier
    // `.slice(-40)` *vor* allem anderen: das Protokoll wurde auf die letzten vierzig
    // Zeilen gekürzt und der Filter suchte danach in diesem Ausschnitt. Bei fünfhundert
    // Ereignissen, von denen nur die drei ältesten Weltgeschehen sind, fände
    // „Weltgeschehen" **nichts** — und der Knopf wäre ein Knopf, der lügt.
    //
    // Gekürzt wird deshalb auf eine Menge, in der jede Rubrik noch etwas zu zeigen hat:
    // die letzten vierzig Zeilen **und** die letzten vierzig Weltereignisse.
    const alle = eventsFor(state.eventLog, viewerId)
    const jüngste = new Set(alle.slice(-LOG_LINES))
    for (const event of worldEventsIn(alle).slice(-LOG_LINES)) jüngste.add(event)

    const zeilen = alle
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

    // Die Märsche der Automatik als leise Zeilen (T-M40-13, Befund M3): Rubrik Kampf, Sprung auf das
    // Ziel, keine Alarmfarbe. Sie stammen aus den Befehlen der Schleife, nicht aus dem Protokoll des Kerns.
    const maersche: EventEntry[] = adjutantMarchEntries(adjutantMarches, {
      army: (armyId) => state.armies[armyId]?.name ?? armyId,
      province: (provinceId) => activeMap.provinces.find((province) => province.id === provinceId)?.name ?? provinceId,
    })
    // Neueste zuerst wie das Protokoll; `sort` ist stabil, bei gleichem Tick stehen die Ereignisse vorn.
    return [...zeilen, ...maersche.reverse()].sort((a, b) => b.tick - a.tick)
  }, [state, viewerId, activeMap, nameOf, ticksPerDay, dayBodies, adjutantMarches])

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
    if (!trigger || !state || !viewerId) return t('header.stoppedAlertPlain', { time })
    const beschrieben = describeEvent(trigger, 0, activeMap, {
      player: nameOf,
      army: (id: string) => state.armies[id]?.name ?? id,
      ticksPerDay,
      viewer: viewerId,
    })
    return t('header.stoppedAlert', { time, event: beschrieben.text })
  }, [fastForwardState, ticksPerDay, state, viewerId, activeMap, nameOf])

  /** Build, recruit and capital — for an own province; nothing for anyone else's. */
  const provinceGroups: ActionGroupSpec[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== ctx.playerId) return []
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

  /**
   * Die naechste Freischaltung fuer den Kopf der Aushebeliste (T-M34-08, D34.5).
   *
   * Haengt am Spieltag und nicht an der gewaehlten Provinz — die Achse ist fuer das
   * ganze Reich dieselbe. Deshalb auch nicht an `selected`: die Zeile duerfte sonst beim
   * Provinzwechsel neu gerechnet werden, ohne sich je zu aendern.
   */
  const naechsteFreischaltung = useMemo(() => (ctx ? nextUnlock(ctx) : null), [ctx])

  const provinceActions: Action[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== ctx.playerId) return []
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
    const delayTicks = targeting.kind === 'move' ? targeting.delayDays * ticksPerDay : 0
    const target = targeting.target
      ? {
          id: targeting.target,
          name: nameOfProvince(targeting.target),
          arrivalText:
            targeting.kind === 'move' ? (planArrival(ctx, army.id, targeting.target, delayTicks)?.text ?? null) : null,
        }
      : null
    const confirmSpec = targeting.target
      ? targetAction(ctx, army.id, targeting.kind, targeting.target, delayTicks)
      : null
    const confirm: Action | null = confirmSpec
      ? {
          ...toAction(confirmSpec),
          onRun: () => {
            // Ein eigener Marschbefehl haelt fest (T-M40-14): eine Verteidigung geht mit dem Marsch auf
            // Garnison — der zweite Befehl nur, wenn die Vorpruefung in `send` den Marsch annimmt (Befund N-4).
            if (confirmSpec.command && send(confirmSpec.command, confirmSpec.id) && confirmSpec.followUp) {
              send(confirmSpec.followUp, confirmSpec.id)
            }
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
      delayDays: targeting.delayDays,
      onDelay: (days: number) =>
        setTargeting({ ...targeting, delayDays: Math.min(Math.max(0, days), MAX_DEPART_DELAY_DAYS) }),
      onCancel: () => {
        setTargeting(null)
        dispatch({ type: 'clearNotice' })
      },
    }
  }, [ctx, targeting, state, ui.selectedArmy, activeMap.provinces, nameOfProvince, toAction, send, ticksPerDay])

  if (!state || !view || !ctx || !viewerId) {
    return (
      <div className="app app--empty" style={fontScaleStyle(ui.settings)}>
        <p>{t('app.loading')}</p>
        {/*
          Der Weg zurueck (T-M12-07, Befund 26a). Vorher war diese Flaeche eine
          Sackgasse: Strg+S ersetzte den Startdialog durch nichts, Escape loeschte ihn
          endgueltig, und nur Neuladen half. Beide Knoepfe sind auch der Grund, warum das
          Kreuz des Startdialogs jetzt schliessen darf.
        */}
        {!netParty.active && dialog === null && (
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
        {partyDialog ?? newGameDialog}
      </div>
    )
  }

  const ownProvinces = view.provinces.filter((p) => p.owner === viewerId).map((p) => ({ id: p.id, name: p.name }))
  const knownProvinces = view.provinces.filter((p) => p.owner !== viewerId).map((p) => ({ id: p.id, name: p.name }))

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
        // Zu zweit zeigt die Kopfleiste die feste Rate als Text statt einer Tempogruppe
        // (T-M37-04, R-MP-02/AK3); im Einzelspieler bleibt alles, wie es war.
        fixedSpeed={party.fixedSpeed}
        // Die ehrliche Uhr des Gleichschritts und der Pausenvertrag (T-M37-11).
        waitingForPeer={netplay.waiting}
        peerLost={netplay.lost && !peerLostDismissed}
        paused={netplay.status === 'paused'}
        {...(netplay.active
          ? {
              onPauseRequest: netplay.requestPause,
              onResume: netplay.resume,
              onKeepWaiting: () => setPeerLostDismissed(true),
              onEndGame: () => setDialog('netplayEnd'),
            }
          : {})}
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
        alarm={alarm}
        onAlarm={(provinceId) => {
          // Quittieren heisst hinsehen: die Provinz kommt in die Mitte, der Chip geht.
          jumpTo(provinceId)
          setAlarmSeenTick(state.tick)
        }}
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
            alarmProvince={alarm?.provinceId ?? null}
            capitalProvinceId={view.self.capitalProvinceId}
            battleProvinces={battleProvinces}
            speed={speed}
            tick={state.tick}
            ticksPerDay={ticksPerDay}
            onHover={(id, at) => setHover(id && at ? { id, x: at.x, y: at.y } : null)}
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
          <Legend mode={ui.mode} {...(colorOf(viewerId) ? { ownColor: colorOf(viewerId)! } : {})} />
          {tooltip && tooltipAt && <Tooltip data={tooltip} x={tooltipAt.x} y={tooltipAt.y} />}
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
          <Alerts
            alerts={alerts}
            onJump={jumpTo}
            onDismiss={(id) => setDismissedAlerts((old) => new Map(old).set(id, view.tick))}
          />
          {ui.notice && <p className={`notice notice--${ui.notice.kind}`}>{ui.notice.text}</p>}
          {ui.panel === 'province' && (
            <ProvincePanel
              province={selected}
              ownerName={selected?.owner ? nameOf(selected.owner) : null}
              ownerColor={selected?.owner ? colorOf(selected.owner) : null}
              actions={provinceActions}
              groups={provinceGroups}
              nextUnlock={naechsteFreischaltung}
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
              condition={selectedArmy?.units ? stackSummary(selectedArmy.units, props.rules).condition : undefined}
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
              prices={prices}
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

      {/* Der Fuss (T-M31-03, D27.6): Protokoll, Rangliste, drei Knoepfe. */}
      <Foot
        entries={events}
        ticksPerDay={ticksPerDay}
        rows={standingsRows(view, nameOf)}
        seenTick={seenTick}
        onJump={jumpTo}
        onDispatch={() => setDialog('report')}
        onPanel={(panel) => {
          // Die Lage oeffnen heisst: gesehen. Die Marke faellt auf null.
          if (panel === 'standings') setSeenTick(state.tick)
          dispatch({ type: 'openPanel', panel })
        }}
      />

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
      {partyDialog}
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
      {/* Die Depesche (T-M31-03): der juengste Tagesbericht, wie er im Protokoll steht. */}
      {dialog === 'report' &&
        (() => {
          const report = latestReport(events)
          return (
            <Dialog title={t('foot.dispatch')} onClose={() => setDialog(null)}>
              {report ? (
                <div className="dispatch">
                  <p className="dispatch__head">{report.text}</p>
                  {report.deltas && report.deltas.length > 0 && (
                    <ul className="log__deltas" aria-label={t('dayReport.balance')}>
                      {report.deltas.map((delta) => (
                        <li key={delta.label}>
                          <span>{delta.label}</span>
                          <span className="log__delta-value">
                            {rate(delta.balance)}
                            <DeltaBar value={delta.balance} max={Math.max(...report.deltas!.map((d) => Math.abs(d.balance)), 1)} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.body && report.body.length > 0 && (
                    <ul className="dispatch__lines">
                      {report.body.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="muted">{t('foot.none')}</p>
              )}
            </Dialog>
          )
        })()}

      {/* Der Pausenantrag des Mitspielers (T-M37-11, R-MP-05/AK1, D28.7): zwei Knoepfe,
          und bis einer gedrueckt ist, laeuft die Partie weiter. Ein Antrag, den man
          selbst gestellt hat, bekommt keinen Dialog — er wartet auf die andere Seite. */}
      {netplay.pause.request && netplay.pause.request.by !== viewerId && (
        <Dialog title={t('netplay.title')} onClose={() => netplay.answerPause(false)}>
          <p>{t('netplay.pauseAsked', { player: nameOf(netplay.pause.request.by) })}</p>
          <p className="dialog__actions">
            <button type="button" className="button button--primary" onClick={() => netplay.answerPause(true)}>
              {t('netplay.pauseAccept')}
            </button>
            <button type="button" className="button" onClick={() => netplay.answerPause(false)}>
              {t('netplay.pauseDecline')}
            </button>
          </p>
        </Dialog>
      )}

      {/*
        Die Partie zu zweit beenden (T-M38-09, R-MP-07/AK2, D28.8 Stufe 2).

        Der zweite Knopf des Hinweises fuehrt hierher. Bewusst ein eigener Schritt und
        kein sofortiges Ende: „beenden" ist die Entscheidung, die man nicht aus Versehen
        trifft, waehrend man auf jemanden wartet.
      */}
      {dialog === 'netplayEnd' && (
        <Dialog title={t('netplay.endTitle')} onClose={() => setDialog(null)}>
          <p>{t('netplay.endBody')}</p>
          {/*
            Der Ausweg (T-M38-10, R-MP-08/AK1, D28.8 Stufe 3): kein Abend geht verloren,
            weil jemand ins Bett gegangen ist. Die Partie laeuft als Einzelspielerpartie
            weiter, der abwesende Mitspieler als Computergegner — und das geht nur, weil
            der Zustand derselbe ist (D28.2). Es ist ein bewusster Klick und geschieht nie
            von selbst (AK2).
          */}
          <p>{t('netplay.takeOverBody')}</p>
          <p className="dialog__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                const session = props.netplay
                const stand = stateRef.current
                if (session && stand) commitState(takeOverSeat(stand, session.peer))
                session?.transport.close('Der Mitspieler wurde uebernommen.')
                // Ab hier ist es eine Einzelspielerpartie, mit allem, was dazugehoert:
                // Tempo, Vorspulen, Tastenkuerzel (R-MP-08/AK1).
                setNetplayOver(true)
                setParty({ mode: 'single', fixedSpeed: null })
                setPeerLostDismissed(true)
                setDialog(null)
              }}
            >
              {t('netplay.takeOver')}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                props.netplay?.transport.close('Die Partie wurde beendet.')
                setNetplayOver(true)
                setDialog('new')
                commitState(null)
              }}
            >
              {t('netplay.endLeave')}
            </button>
            <button type="button" className="button" onClick={() => setDialog(null)}>
              {t('netplay.endStay')}
            </button>
          </p>
        </Dialog>
      )}

      {/*
        Das Auseinanderlaufen (T-M37-11, R-MP-04/AK1, D28.6).

        **Kein Dialog, kein Kreuz, kein Escape.** Zwei Welten, die sich trennen, sind
        schlimmer als ein Abbruch; eine Meldung, die man wegklicken kann, waere eine
        Einladung, genau das zu tun und weiterzuspielen. Der einzige Knopf sichert den
        Stand, damit der Fehler untersuchbar bleibt (R-MP-04/AK2).
      */}
      {netplay.desync && (
        <div className="dialog-backdrop dialog-backdrop--locked">
          <div className="dialog" role="alertdialog" aria-label={t('netplay.desyncTitle')}>
            <header className="dialog__head">
              <h2>{t('netplay.desyncTitle')}</h2>
            </header>
            <div className="dialog__body">
              <p>{t('netplay.desync', { tick: netplay.desync.tick })}</p>
              <p className="muted">
                {t('netplay.desyncHashes', { own: netplay.desync.own, other: netplay.desync.other })}
              </p>
              <p className="dialog__actions">
                <button type="button" className="button" onClick={() => setDialog('saves')}>
                  {t('netplay.desyncSave')}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

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
            // `commitState(null)` ist der Kern der Sache, nicht Aufraeumen: den
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
            commitState(null)
            setDialog('new')
          }}
        />
      )}
    </div>
  )
}
